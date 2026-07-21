"use server";

import { z } from "zod";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { PERMISSIONS, can } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";

const OrgSettingsSchema = z.object({
  name:             z.string().min(1).max(120),
  shortName:        z.string().min(1).max(40),
  legalName:        z.string().optional().or(z.literal("")),
  email:            z.string().email().optional().or(z.literal("")),
  phone:            z.string().optional().or(z.literal("")),
  whatsapp:         z.string().optional().or(z.literal("")),
  website:          z.string().url().optional().or(z.literal("")),
  address:          z.string().optional().or(z.literal("")),
  description:      z.string().optional().or(z.literal("")),
  emailFromName:    z.string().optional().or(z.literal("")),
  emailFromAddress: z.string().email().optional().or(z.literal("")),
  emailReplyTo:     z.string().email().optional().or(z.literal("")),
});

export async function updateOrgSettings(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ORG_SETTINGS)) throw new Error("Permission denied");

  const raw = Object.fromEntries(formData.entries());
  const data = OrgSettingsSchema.parse(raw);

  const clean = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
  );

  await dbRetry(() =>
    prisma.organization.update({
      where: { id: ctx.organization.id },
      data: clean,
    })
  );

  revalidatePath(`/${orgSlug}/settings`);
}
