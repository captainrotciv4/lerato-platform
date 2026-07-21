"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const MissionSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["EVANGELISM", "HUMANITARIAN", "ENGAGEMENT_PROGRAMME", "CAPACITY_BUILDING", "PARTNERSHIP_VISIT", "OTHER"]),
  destination: z.string().min(2),
  countries: z.string().optional().or(z.literal("")),     // comma-separated
  departureDate: z.string().optional().or(z.literal("")),
  returnDate: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  budget: z.coerce.number().optional(),
});

export async function createMission(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.MISSION_WRITE)) throw new Error("Permission denied");
  const data = MissionSchema.parse(Object.fromEntries(formData.entries()));

  const mission = await prisma.$transaction(async (tx) => {
    const m = await tx.mission.create({
      data: {
        organizationId: ctx.organization.id,
        name: data.name,
        type: data.type,
        destination: data.destination,
        countries: (data.countries || "").split(",").map(s => s.trim()).filter(Boolean),
        departureDate: data.departureDate ? new Date(data.departureDate) : null,
        returnDate: data.returnDate ? new Date(data.returnDate) : null,
        description: data.description || null,
        budget: data.budget || null,
      },
    });
    await tx.auditLog.create({
      data: { organizationId: ctx.organization.id, actorId: ctx.user.id, action: "CREATE", entity: "Mission", entityId: m.id, after: m as any },
    });
    return m;
  });

  revalidatePath(`/${orgSlug}/missions`);
  redirect(`/${orgSlug}/missions/${mission.id}`);
}

const DelegateSchema = z.object({
  missionId: z.string().cuid(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  role: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  passportNo: z.string().optional().or(z.literal("")),
  passportExpiry: z.string().optional().or(z.literal("")),
  visaStatus: z.enum(["NOT_STARTED", "APPLIED", "PROCESSING", "APPROVED", "REJECTED", "EXEMPT"]).default("NOT_STARTED"),
});

export async function addDelegate(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.MISSION_WRITE)) throw new Error("Permission denied");
  const data = DelegateSchema.parse(Object.fromEntries(formData.entries()));

  // Confirm mission belongs to this org
  const m = await prisma.mission.findFirst({
    where: { id: data.missionId, organizationId: ctx.organization.id },
  });
  if (!m) throw new Error("Mission not found");

  await prisma.$transaction(async (tx) => {
    const d = await tx.missionDelegate.create({
      data: {
        missionId: data.missionId,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || null,
        email: data.email || null,
        phone: data.phone || null,
        passportNo: data.passportNo || null,
        passportExpiry: data.passportExpiry ? new Date(data.passportExpiry) : null,
        visaStatus: data.visaStatus,
      },
    });
    await tx.auditLog.create({
      data: { organizationId: ctx.organization.id, actorId: ctx.user.id, action: "CREATE", entity: "MissionDelegate", entityId: d.id, after: d as any },
    });
  });

  revalidatePath(`/${orgSlug}/missions/${data.missionId}`);
}
