"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DonorSchema = z.object({
  type: z.enum(["INDIVIDUAL", "ORGANIZATION", "ANONYMOUS"]),
  firstName: z.string().optional().or(z.literal("")),
  lastName: z.string().optional().or(z.literal("")),
  organizationName: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM", "PATRON"]).default("BRONZE"),
  taxExempt: z.coerce.boolean().optional(),
  taxId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  shareWithOrgs: z.string().optional(),       // comma-separated org slugs in addition to current
});

export async function createDonor(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.DONOR_WRITE)) {
    throw new Error("Permission denied");
  }
  const raw = Object.fromEntries(formData.entries());
  const data = DonorSchema.parse(raw);

  // Resolve which orgs to link the donor with (always the current one; optionally more)
  const otherSlugs = (data.shareWithOrgs || "").split(",").map((s) => s.trim()).filter(Boolean);
  const orgsToLink = await prisma.organization.findMany({
    where: { OR: [{ slug: orgSlug }, { slug: { in: otherSlugs } }] },
  });

  const donor = await prisma.$transaction(async (tx) => {
    const created = await tx.donor.create({
      data: {
        type: data.type,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        organizationName: data.organizationName || null,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        country: data.country || "Kenya",
        tier: data.tier,
        taxExempt: data.taxExempt || false,
        taxId: data.taxId || null,
        notes: data.notes || null,
        sharedWith: {
          create: orgsToLink.map((o) => ({
            organizationId: o.id,
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "CREATE",
        entity: "Donor",
        entityId: created.id,
        after: created as any,
      },
    });

    return created;
  });

  revalidatePath(`/${orgSlug}/donors`);
  redirect(`/${orgSlug}/donors/${donor.id}`);
}

const DonationSchema = z.object({
  donorId: z.string().cuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().default("KES"),
  channel: z.enum(["MPESA", "BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "CRYPTO", "OTHER"]),
  reference: z.string().optional().or(z.literal("")),
  designatedFor: z.string().optional().or(z.literal("")),
  receivedAt: z.string().refine((d) => !isNaN(Date.parse(d))),
  notes: z.string().optional().or(z.literal("")),
});

export async function recordDonation(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.FINANCE_WRITE)) {
    throw new Error("Permission denied");
  }
  const raw = Object.fromEntries(formData.entries());
  const data = DonationSchema.parse(raw);

  // Confirm the donor is linked to this org before recording
  const link = await prisma.donorShare.findUnique({
    where: {
      donorId_organizationId: { donorId: data.donorId, organizationId: ctx.organization.id },
    },
  });
  if (!link) throw new Error("Donor is not linked to this organization");

  const donation = await prisma.$transaction(async (tx) => {
    const d = await tx.donation.create({
      data: {
        donorId: data.donorId,
        organizationId: ctx.organization.id,
        amount: data.amount,
        currency: data.currency,
        channel: data.channel,
        reference: data.reference || null,
        designatedFor: data.designatedFor || null,
        receivedAt: new Date(data.receivedAt),
        notes: data.notes || null,
      },
    });

    // Also record as a Transaction (income)
    await tx.transaction.create({
      data: {
        organizationId: ctx.organization.id,
        type: "INCOME",
        amount: data.amount,
        currency: data.currency,
        description: `Donation from donor ${data.donorId}`,
        category: "Donations",
        reference: data.reference || null,
        occurredAt: new Date(data.receivedAt),
        donationId: d.id,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "CREATE",
        entity: "Donation",
        entityId: d.id,
        after: d as any,
      },
    });

    return d;
  });

  revalidatePath(`/${orgSlug}/donors/${data.donorId}`);
  revalidatePath(`/${orgSlug}/donors`);
  revalidatePath(`/${orgSlug}/finance`);
  redirect(`/${orgSlug}/donors/${data.donorId}`);
}
