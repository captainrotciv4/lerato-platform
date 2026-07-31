"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth/password";
import { validatePassword } from "@/lib/auth/password-rules";
import { Resend } from "resend";
import crypto from "crypto";

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().refine(
    (p) => validatePassword(p) === null,
    (p) => ({ message: validatePassword(p) ?? "Password too weak" })
  ),
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

/** Admin: generate a password-reset link for a team member and email it (or return it if email is unconfigured). */
export async function sendResetLink(
  orgSlug: string,
  userId: string,
): Promise<{ ok: boolean; message: string; resetUrl?: string }> {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ORG_SETTINGS)) {
    return { ok: false, message: "Permission denied." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active || !user.email) {
    return { ok: false, message: "User not found or inactive." };
  }

  // Invalidate any existing unused tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.create({ data: { userId, token, expiresAt } });

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "https://lerato-platform.netlify.app";
  const resetUrl = `${baseUrl}/sign-in/reset/${token}`;

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Lerato Platform <noreply@leratofoundation.org>",
      to: user.email,
      subject: "Set your Lerato Platform password",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:4px">Password reset</h2>
        <p>Hi ${user.name},</p>
        <p>An administrator has sent you a password reset link. Click below to set a new password for your Lerato Platform account.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="display:inline-block;background:#ED1C24;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Set new password
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you weren't expecting this, ignore it — your password won't change.</p>
      </div>`,
    }).catch(() => null);
    return { ok: true, message: `Reset link emailed to ${user.email}.` };
  }

  // Email not configured — return URL for admin to share manually
  return {
    ok: true,
    message: `Email not configured. Share this link with ${user.name} (expires in 1 hour):`,
    resetUrl,
  };
}
