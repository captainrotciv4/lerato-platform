"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbRetry } from "@/lib/db/prisma";

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

  const beneficiary = await dbRetry(() => prisma.beneficiary.create({
    data: {
      organizationId: ctx.organization.id,
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
