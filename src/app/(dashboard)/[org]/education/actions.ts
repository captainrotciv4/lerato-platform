"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ProgramSchema = z.object({
  type: z.enum(["EDUCATION", "LIFE_PROGRAM", "SPORTS_DARAJANI", "MENTORSHIP", "COMMUNITY_DEV", "AGAPE_MISSION", "OTHER"]),
  name: z.string().min(2),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
});

export async function createProgram(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.PROGRAM_WRITE)) throw new Error("Permission denied");
  const data = ProgramSchema.parse(Object.fromEntries(formData.entries()));

  const p = await prisma.$transaction(async (tx) => {
    const created = await tx.program.create({
      data: {
        organizationId: ctx.organization.id,
        type: data.type,
        name: data.name,
        description: data.description || null,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
    await tx.auditLog.create({
      data: { organizationId: ctx.organization.id, actorId: ctx.user.id, action: "CREATE", entity: "Program", entityId: created.id, after: created as any },
    });
    return created;
  });

  revalidatePath(`/${orgSlug}/education`);
  redirect(`/${orgSlug}/education`);
}
