"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const CommSchema = z.object({
  type: z.enum(["SMS", "EMAIL", "WHATSAPP", "PUSH_NOTIFICATION", "INTERNAL_ANNOUNCEMENT"]),
  subject: z.string().optional().or(z.literal("")),
  body: z.string().min(2),
  audience: z.enum(["ALL_BENEFICIARIES", "ALL_DONORS", "ALL_STAFF", "DRAFT_ONLY"]).default("DRAFT_ONLY"),
});

export async function createCommunication(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.COMM_SEND)) throw new Error("Permission denied");
  const data = CommSchema.parse(Object.fromEntries(formData.entries()));

  // Count recipients without actually sending (sending hooks into Africa's Talking / Resend later)
  let recipientCount = 0;
  if (data.audience === "ALL_BENEFICIARIES") {
    recipientCount = await prisma.beneficiary.count({
      where: { organizationId: ctx.organization.id, deletedAt: null },
    });
  } else if (data.audience === "ALL_DONORS") {
    recipientCount = await prisma.donorShare.count({ where: { organizationId: ctx.organization.id } });
  } else if (data.audience === "ALL_STAFF") {
    recipientCount = await prisma.staffVolunteer.count({
      where: { organizationId: ctx.organization.id, active: true, deletedAt: null },
    });
  }

  await prisma.$transaction(async (tx) => {
    const c = await tx.communication.create({
      data: {
        organizationId: ctx.organization.id,
        type: data.type,
        subject: data.subject || null,
        body: data.body,
        status: "DRAFT",
        recipientCount,
        createdBy: ctx.user.id,
      },
    });
    await tx.auditLog.create({
      data: { organizationId: ctx.organization.id, actorId: ctx.user.id, action: "CREATE", entity: "Communication", entityId: c.id, after: c as any },
    });
  });

  revalidatePath(`/${orgSlug}/communications`);
  redirect(`/${orgSlug}/communications`);
}
