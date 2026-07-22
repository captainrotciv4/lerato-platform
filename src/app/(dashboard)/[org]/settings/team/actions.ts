"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth/password";

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "PROGRAMME_MANAGER", "FINANCE", "FINANCE_LEAD", "COMMUNICATIONS", "FIELD_STAFF", "BOARD_OBSERVER", "BOARD_MEMBER"]),
  title: z.string().optional().or(z.literal("")),
  branchId: z.string().optional().or(z.literal("")),
});

export async function createTeamMember(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ORG_SETTINGS)) {
    throw new Error("Permission denied");
  }

  const data = CreateUserSchema.parse(Object.fromEntries(formData.entries()));
  const hashed = await hashPassword(data.password);

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email: data.email } });

  if (existing) {
    // User exists — just add membership to this org if not already a member
    const alreadyMember = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: existing.id, organizationId: ctx.organization.id } },
    });
    if (alreadyMember) throw new Error(`${data.email} is already a member of this organisation.`);

    await prisma.membership.create({
      data: {
        userId: existing.id,
        organizationId: ctx.organization.id,
        role: data.role as any,
        branchId: data.branchId || null,
        invitedById: ctx.user.id,
      },
    });
  } else {
    // Create new user then membership (two separate operations — NeonHttp forbids nested creates)
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        hashedPassword: hashed,
        title: data.title || null,
        active: true,
      },
    });

    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: ctx.organization.id,
        role: data.role as any,
        branchId: data.branchId || null,
        invitedById: ctx.user.id,
      },
    });
  }

  revalidatePath(`/${orgSlug}/settings/team`);
  redirect(`/${orgSlug}/settings/team` as any);
}

export async function removeMember(orgSlug: string, membershipId: string) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ORG_SETTINGS)) {
    throw new Error("Permission denied");
  }
  // Don't allow removing yourself
  const m = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (m?.userId === ctx.user.id) throw new Error("Cannot remove yourself.");

  await prisma.membership.update({
    where: { id: membershipId },
    data: { active: false, revokedAt: new Date() },
  });

  revalidatePath(`/${orgSlug}/settings/team`);
}
