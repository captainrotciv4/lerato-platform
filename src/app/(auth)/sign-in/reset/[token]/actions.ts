"use server";

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function resetPassword(
  token: string,
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const password = formData.get("password") as string;
  const confirm  = formData.get("confirm")  as string;

  if (!password || password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords do not match." };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { ok: false, message: "This reset link is invalid or has expired. Please request a new one." };
  }

  const hashed = await hashPassword(password);

  // Sequential updates — NeonHttp forbids nested writes
  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { hashedPassword: hashed },
  });

  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, message: "Password updated. You can now sign in with your new password." };
}
