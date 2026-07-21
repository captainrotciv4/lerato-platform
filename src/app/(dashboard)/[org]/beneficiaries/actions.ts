"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbRetry } from "@/lib/db/prisma";
import { Resend } from "resend";

const BeneficiarySchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  middleName: z.string().optional().or(z.literal("")),
  lastName: z.string().min(2, "Last name is required"),
  dateOfBirth: z.string().refine((d) => !isNaN(Date.parse(d)), "Valid date of birth required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
  nationalId: z.string().optional().or(z.literal("")),
  birthCertNo: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  county: z.string().optional().or(z.literal("")),
  guardianName: z.string().optional().or(z.literal("")),
  guardianPhone: z.string().optional().or(z.literal("")),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianRelationship: z.string().optional().or(z.literal("")),
  isAthlete: z.coerce.boolean().optional(),
  isStudent: z.coerce.boolean().optional(),
  // Initial athlete fields (captured at registration)
  position: z.string().optional().or(z.literal("")),
  preferredFoot: z.string().optional().or(z.literal("")),
  currentClub: z.string().optional().or(z.literal("")),
  // Initial student fields
  school: z.string().optional().or(z.literal("")),
  grade: z.string().optional().or(z.literal("")),
});

export type BeneficiaryActionResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string[]> };

/** Create a new beneficiary scoped to the current tenant. */
export async function createBeneficiary(orgSlug: string, formData: FormData): Promise<BeneficiaryActionResult> {
  const ctx = await requireTenant(orgSlug);

  if (!can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE)) {
    return { ok: false, errors: { _form: ["You don't have permission to create beneficiaries."] } };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = BeneficiarySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const data = parsed.data;

  // ── Duplicate check ───────────────────────────────────────────────
  const dupeChecks: { birthCertNo?: string; nationalId?: string }[] = [];
  if (data.birthCertNo) dupeChecks.push({ birthCertNo: data.birthCertNo });
  if (data.nationalId)  dupeChecks.push({ nationalId:  data.nationalId });
  if (dupeChecks.length > 0) {
    const existing = await dbRetry(() =>
      prisma.beneficiary.findFirst({
        where: { organizationId: ctx.organization.id, deletedAt: null, OR: dupeChecks },
        select: { id: true, firstName: true, lastName: true, admissionNo: true, birthCertNo: true, nationalId: true },
      })
    );
    if (existing) {
      const field = existing.birthCertNo === data.birthCertNo ? `birth certificate ${data.birthCertNo}` : `national ID ${data.nationalId}`;
      const ref   = existing.admissionNo ? ` (${existing.admissionNo})` : "";
      return { ok: false, errors: { _form: [`Duplicate: ${existing.firstName} ${existing.lastName}${ref} is already registered with the same ${field}.`] } };
    }
  }

  // ── Auto-generate admission number ────────────────────────────────
  const prefix  = orgSlug.slice(0, 3).toUpperCase();
  const yr      = new Date().getFullYear().toString().slice(2);
  const count   = await dbRetry(() => prisma.beneficiary.count({ where: { organizationId: ctx.organization.id } }));
  const admissionNo = `${prefix}${yr}-${String(count + 1).padStart(4, "0")}`;

  const beneficiary = await dbRetry(() => prisma.beneficiary.create({
    data: {
      organizationId: ctx.organization.id,
      admissionNo,
      firstName: data.firstName,
      middleName: data.middleName || null,
      lastName: data.lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      nationalId: data.nationalId || null,
      birthCertNo: data.birthCertNo || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      county: data.county || null,
      guardianName: data.guardianName || null,
      guardianPhone: data.guardianPhone || null,
      guardianEmail: data.guardianEmail || null,
      guardianRelationship: data.guardianRelationship || null,
    },
  }));

  // NeonHttp: no nested creates — sequential inserts
  if (data.isAthlete) {
    await dbRetry(() => prisma.athleteProfile.create({
      data: {
        beneficiaryId: beneficiary.id,
        position: data.position || null,
        preferredFoot: (data.preferredFoot as "RIGHT" | "LEFT" | "BOTH" | null) || null,
        currentClub: data.currentClub || null,
      },
    }));
  }
  if (data.isStudent) {
    await dbRetry(() => prisma.studentProfile.create({
      data: {
        beneficiaryId: beneficiary.id,
        school: data.school || null,
        grade: data.grade || null,
      },
    }));
  }

  prisma.auditLog.create({
    data: {
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "CREATE",
      entity: "Beneficiary",
      entityId: beneficiary.id,
      after: beneficiary as any,
    },
  }).catch(() => null);

  revalidatePath(`/${orgSlug}/beneficiaries`);
  revalidatePath(`/${orgSlug}`);
  redirect(`/${orgSlug}/beneficiaries/${beneficiary.id}`);
}

/** Sync an offline-queued beneficiary draft — same logic as createBeneficiary but no redirect. */
export async function syncBeneficiaryRecord(
  orgSlug: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; admissionNo: string } | { ok: false; error: string }> {
  const ctx = await requireTenant(orgSlug);

  if (!can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE)) {
    return { ok: false, error: "Permission denied." };
  }

  const parsed = BeneficiarySchema.safeParse(payload);
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat();
    return { ok: false, error: msgs.join("; ") || "Validation failed." };
  }
  const data = parsed.data;

  const dupeChecks: { birthCertNo?: string; nationalId?: string }[] = [];
  if (data.birthCertNo) dupeChecks.push({ birthCertNo: data.birthCertNo });
  if (data.nationalId)  dupeChecks.push({ nationalId:  data.nationalId });
  if (dupeChecks.length > 0) {
    const existing = await dbRetry(() =>
      prisma.beneficiary.findFirst({
        where: { organizationId: ctx.organization.id, deletedAt: null, OR: dupeChecks },
        select: { firstName: true, lastName: true, admissionNo: true, birthCertNo: true, nationalId: true },
      })
    );
    if (existing) {
      const field = existing.birthCertNo === data.birthCertNo
        ? `birth certificate ${data.birthCertNo}`
        : `national ID ${data.nationalId}`;
      const ref = existing.admissionNo ? ` (${existing.admissionNo})` : "";
      return { ok: false, error: `Duplicate: ${existing.firstName} ${existing.lastName}${ref} already registered with the same ${field}.` };
    }
  }

  const prefix      = orgSlug.slice(0, 3).toUpperCase();
  const yr          = new Date().getFullYear().toString().slice(2);
  const count       = await dbRetry(() => prisma.beneficiary.count({ where: { organizationId: ctx.organization.id } }));
  const admissionNo = `${prefix}${yr}-${String(count + 1).padStart(4, "0")}`;

  const beneficiary = await dbRetry(() => prisma.beneficiary.create({
    data: {
      organizationId: ctx.organization.id,
      admissionNo,
      firstName:            data.firstName,
      middleName:           data.middleName   || null,
      lastName:             data.lastName,
      dateOfBirth:          new Date(data.dateOfBirth),
      gender:               data.gender,
      nationalId:           data.nationalId   || null,
      birthCertNo:          data.birthCertNo  || null,
      phone:                data.phone        || null,
      email:                data.email        || null,
      address:              data.address      || null,
      county:               data.county       || null,
      guardianName:         data.guardianName || null,
      guardianPhone:        data.guardianPhone || null,
      guardianEmail:        data.guardianEmail || null,
      guardianRelationship: data.guardianRelationship || null,
    },
  }));

  if (data.isAthlete) {
    await dbRetry(() => prisma.athleteProfile.create({
      data: {
        beneficiaryId: beneficiary.id,
        position:      data.position     || null,
        preferredFoot: (data.preferredFoot as any) || null,
        currentClub:   data.currentClub  || null,
      },
    }));
  }
  if (data.isStudent) {
    await dbRetry(() => prisma.studentProfile.create({
      data: {
        beneficiaryId: beneficiary.id,
        school: data.school || null,
        grade:  data.grade  || null,
      },
    }));
  }

  revalidatePath(`/${orgSlug}/beneficiaries`);
  return { ok: true, admissionNo };
}

/** Soft-delete a beneficiary. */
export async function deleteBeneficiary(orgSlug: string, beneficiaryId: string) {
  const ctx = await requireTenant(orgSlug);

  if (!can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_DELETE)) {
    throw new Error("Permission denied");
  }

  const existing = await dbRetry(() => prisma.beneficiary.findFirst({
    where: { id: beneficiaryId, organizationId: ctx.organization.id, deletedAt: null },
  }));
  if (!existing) throw new Error("Not found");

  // NeonHttp: sequential, no prisma.$transaction
  await dbRetry(() => prisma.beneficiary.update({
    where: { id: beneficiaryId },
    data: { deletedAt: new Date() },
  }));
  prisma.auditLog.create({
    data: {
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "DELETE",
      entity: "Beneficiary",
      entityId: beneficiaryId,
      before: existing as any,
    },
  }).catch(() => null);

  revalidatePath(`/${orgSlug}/beneficiaries`);
  redirect(`/${orgSlug}/beneficiaries`);
}

// ── Athlete profile actions ────────────────────────────────────────────────

const AthleteProfileSchema = z.object({
  jerseyNumber:       z.coerce.number().int().min(1).max(99).optional().or(z.literal("")),
  position:           z.string().optional().or(z.literal("")),
  preferredFoot:      z.string().optional().or(z.literal("")),
  heightCm:           z.coerce.number().min(100).max(250).optional().or(z.literal("")),
  weightKg:           z.coerce.number().min(30).max(150).optional().or(z.literal("")),
  registrationStatus: z.string().optional().or(z.literal("")),
  fifaPlayerId:       z.string().optional().or(z.literal("")),
  fkfRegistrationNo:  z.string().optional().or(z.literal("")),
  passportNo:         z.string().optional().or(z.literal("")),
  currentClub:        z.string().optional().or(z.literal("")),
  playingStrengths:   z.string().optional().or(z.literal("")),
  areasToImprove:     z.string().optional().or(z.literal("")),
  characterNotes:     z.string().optional().or(z.literal("")),
});

export async function updateAthleteProfile(orgSlug: string, beneficiaryId: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE)) throw new Error("Permission denied");

  const data = AthleteProfileSchema.parse(Object.fromEntries(formData.entries()));

  const fields = {
    jerseyNumber:       data.jerseyNumber ? Number(data.jerseyNumber) : null,
    position:           data.position || null,
    preferredFoot:      data.preferredFoot || null,
    heightCm:           data.heightCm ? Number(data.heightCm) : null,
    weightKg:           data.weightKg ? Number(data.weightKg) : null,
    registrationStatus: data.registrationStatus || null,
    fifaPlayerId:       data.fifaPlayerId || null,
    fkfRegistrationNo:  data.fkfRegistrationNo || null,
    passportNo:         data.passportNo || null,
    currentClub:        data.currentClub || null,
    playingStrengths:   data.playingStrengths || null,
    areasToImprove:     data.areasToImprove || null,
    characterNotes:     data.characterNotes || null,
  };

  await dbRetry(() =>
    prisma.athleteProfile.upsert({
      where:  { beneficiaryId },
      update: fields,
      create: { beneficiaryId, ...fields },
    })
  );

  revalidatePath(`/${orgSlug}/beneficiaries/${beneficiaryId}`);
}

const SeasonStatsSchema = z.object({
  matchesPlayed: z.coerce.number().int().min(0),
  goals:         z.coerce.number().int().min(0),
  assists:       z.coerce.number().int().min(0),
  cleanSheets:   z.coerce.number().int().min(0),
  yellowCards:   z.coerce.number().int().min(0),
  redCards:      z.coerce.number().int().min(0),
});

export async function updateSeasonStats(orgSlug: string, beneficiaryId: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE)) throw new Error("Permission denied");

  const data = SeasonStatsSchema.parse(Object.fromEntries(formData.entries()));

  await dbRetry(() =>
    prisma.athleteProfile.update({
      where: { beneficiaryId },
      data,
    })
  );

  revalidatePath(`/${orgSlug}/beneficiaries/${beneficiaryId}`);
}

// ── Student profile actions ────────────────────────────────────────────────

const StudentProfileSchema = z.object({
  school:          z.string().optional().or(z.literal("")),
  grade:           z.string().optional().or(z.literal("")),
  scholarshipType: z.string().optional().or(z.literal("")),
  academicScore:   z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  academicNotes:   z.string().optional().or(z.literal("")),
  notes:           z.string().optional().or(z.literal("")),
});

export async function updateStudentProfile(orgSlug: string, beneficiaryId: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE)) throw new Error("Permission denied");

  const data = StudentProfileSchema.parse(Object.fromEntries(formData.entries()));

  const fields = {
    school:          data.school || null,
    grade:           data.grade || null,
    scholarshipType: data.scholarshipType || null,
    academicScore:   data.academicScore ? Number(data.academicScore) : null,
    academicNotes:   data.academicNotes || null,
    notes:           data.notes || null,
  };

  await dbRetry(() =>
    prisma.studentProfile.upsert({
      where:  { beneficiaryId },
      update: fields,
      create: { beneficiaryId, ...fields },
    })
  );

  revalidatePath(`/${orgSlug}/beneficiaries/${beneficiaryId}`);
}

// ── Scout report actions ───────────────────────────────────────────────────

const ScoutReportSchema = z.object({
  recommendation: z.enum(["SIGN", "MONITOR", "DECLINE", "REVIEW_LATER"]),
  strengths:      z.string().optional().or(z.literal("")),
  areasToImprove: z.string().optional().or(z.literal("")),
  characterNotes: z.string().optional().or(z.literal("")),
  academicNotes:  z.string().optional().or(z.literal("")),
  notes:          z.string().optional().or(z.literal("")),
});

export async function createScoutReport(orgSlug: string, beneficiaryId: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE)) throw new Error("Permission denied");

  // Verify beneficiary belongs to this org
  const existing = await dbRetry(() => prisma.beneficiary.findFirst({
    where: { id: beneficiaryId, organizationId: ctx.organization.id, deletedAt: null },
    select: { id: true },
  }));
  if (!existing) throw new Error("Not found");

  const data = ScoutReportSchema.parse(Object.fromEntries(formData.entries()));

  await dbRetry(() =>
    prisma.scoutReport.create({
      data: {
        beneficiaryId,
        scoutId:        ctx.user.id,
        recommendation: data.recommendation,
        strengths:      data.strengths || null,
        areasToImprove: data.areasToImprove || null,
        characterNotes: data.characterNotes || null,
        academicNotes:  data.academicNotes || null,
        notes:          data.notes || null,
      },
    })
  );

  revalidatePath(`/${orgSlug}/beneficiaries/${beneficiaryId}`);
}

// ── Report email action ────────────────────────────────────────────────────

const AGE_BRACKET_RANGES: Record<string, [number, number]> = {
  U10: [0, 10], U12: [10, 12], U14: [12, 14],
  U16: [14, 16], U18: [16, 18], Senior: [18, 120],
};

export async function emailReport(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);

  const emailTo        = (formData.get("emailTo") as string)?.trim();
  const subject        = (formData.get("subject") as string)?.trim() || `Player Registry Report — ${ctx.organization.name}`;
  const position       = (formData.get("position") as string) || "";
  const ageBracket     = (formData.get("ageBracket") as string) || "";
  const county         = (formData.get("county") as string) || "";
  const recommendation = (formData.get("recommendation") as string) || "";

  if (!emailTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const where: Record<string, unknown> = { organizationId: ctx.organization.id, deletedAt: null };
  if (position) where.athleteProfile = { position };
  if (county)   where.county = { contains: county, mode: "insensitive" };
  if (ageBracket && AGE_BRACKET_RANGES[ageBracket]) {
    const [min, max] = AGE_BRACKET_RANGES[ageBracket];
    const today = new Date();
    where.dateOfBirth = {
      gte: new Date(today.getFullYear() - max, today.getMonth(), today.getDate()),
      lt:  new Date(today.getFullYear() - min, today.getMonth(), today.getDate()),
    };
  }

  const players = await dbRetry(() =>
    prisma.beneficiary.findMany({
      where: where as any,
      include: {
        athleteProfile: true,
        studentProfile: true,
        scoutReports: { orderBy: { reportDate: "desc" }, take: 1 },
      },
      orderBy: { lastName: "asc" },
    })
  );

  let filtered = players;
  if (recommendation === "NOT_ASSESSED") filtered = players.filter(p => p.scoutReports.length === 0);
  else if (recommendation)              filtered = players.filter(p => p.scoutReports[0]?.recommendation === recommendation);

  const REC_LABELS: Record<string, string> = { SIGN: "Sign", MONITOR: "Monitor", DECLINE: "Decline", REVIEW_LATER: "Review Later" };
  const tableRows = filtered.map(p => {
    const dob = p.dateOfBirth;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "—";
    const rec = p.scoutReports[0]?.recommendation;
    return `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:8px 12px;font-family:monospace;font-size:12px">${p.admissionNo ?? "—"}</td>
      <td style="padding:8px 12px">${p.lastName}, ${p.firstName}</td>
      <td style="padding:8px 12px;text-align:center">${age}</td>
      <td style="padding:8px 12px">${p.athleteProfile?.position ?? "—"}</td>
      <td style="padding:8px 12px">${p.studentProfile?.school ?? "—"}</td>
      <td style="padding:8px 12px">${p.county ?? "—"}</td>
      <td style="padding:8px 12px">${rec ? REC_LABELS[rec] ?? rec : "Not assessed"}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:900px;margin:0 auto;padding:24px">
    <h2 style="margin-bottom:4px">${ctx.organization.name} — Player Registry Report</h2>
    <p style="color:#6b7280;margin-top:0">Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${filtered.length} player(s)</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#f3f4f6;text-align:left">
        <th style="padding:8px 12px">Reg No.</th><th style="padding:8px 12px">Name</th>
        <th style="padding:8px 12px;text-align:center">Age</th><th style="padding:8px 12px">Position</th>
        <th style="padding:8px 12px">School</th><th style="padding:8px 12px">County</th>
        <th style="padding:8px 12px">Status</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Lerato Platform · Confidential</p>
  </body></html>`;

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, message: "Email sending is not configured (RESEND_API_KEY not set). Add it in Vercel environment variables." };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from:    process.env.EMAIL_FROM ?? "Lerato Platform <noreply@leratofoundation.org>",
      to:      emailTo,
      subject,
      html,
    });
    return { ok: true, message: `Report sent to ${emailTo}` };
  } catch (e: any) {
    return { ok: false, message: (e as Error)?.message ?? "Failed to send email." };
  }
}
