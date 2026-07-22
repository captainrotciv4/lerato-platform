"use server";

import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";
import crypto from "crypto";

export async function requestPasswordReset(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Always return the same message to avoid revealing account existence
  const okMsg = "If that email is registered, a reset link has been sent. Check your inbox.";

  if (!user || !user.active) return { ok: true, message: okMsg };

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://leratoplatform.netlify.app";
  const resetUrl = `${baseUrl}/sign-in/reset/${token}`;

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Lerato Platform <noreply@leratofoundation.org>",
      to: email,
      subject: "Reset your Lerato Platform password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin-bottom:4px">Password reset</h2>
          <p>Hi ${user.name},</p>
          <p>Someone requested a password reset for your Lerato Platform account.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#ED1C24;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Reset password
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you didn't request this, ignore this email — your password won't change.</p>
          <p style="color:#9ca3af;font-size:11px">Or copy this link: ${resetUrl}</p>
        </div>
      `,
    }).catch(() => null);
  }

  return { ok: true, message: okMsg };
}
