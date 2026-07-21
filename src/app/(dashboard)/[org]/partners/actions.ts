"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PartnerSchema = z.object({
  partnerName: z.string().min(2),
  partnerType: z.enum(["STRATEGIC", "COMMUNITY", "SUPPORTING", "OTHER"]),
  contactName: z.string().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});

export async function createPartner(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.PARTNER_WRITE)) {
    throw new Error("Permission denied");
  }
  const data = PartnerSchema.parse(Object.fromEntries(formData.entries()));

  await prisma.$transaction(async (tx) => {
    const p = await tx.partnership.create({
      data: {
        organizationId: ctx.organization.id,
        partnerName: data.partnerName,
        partnerType: data.partnerType,
        contactName: data.contactName || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        website: data.website || null,
        description: data.description || null,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "CREATE",
        entity: "Partnership",
        entityId: p.id,
        after: p as any,
      },
    });
  });

  revalidatePath(`/${orgSlug}/partners`);
  redirect(`/${orgSlug}/partners`);
}
