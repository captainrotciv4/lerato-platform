"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { compare } from "bcryptjs";
import { hashPassword } from "@/lib/auth/password";
import { validatePassword } from "@/lib/auth/password-rules";

export async function changePassword(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Not authenticated." };
  }

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword     = formData.get("newPassword")     as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword) {
    return { ok: false, message: "All fields are required." };
  }
  const pwdError = validatePassword(newPassword ?? "");
  if (pwdError) return { ok: false, message: pwdError + "." };
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New passwords do not match." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.hashedPassword) {
    return { ok: false, message: "Cannot change password for this account type." };
  }

  const valid = await compare(currentPassword, user.hashedPassword);
  if (!valid) {
    return { ok: false, message: "Current password is incorrect." };
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { hashedPassword: hashed },
  });

  return { ok: true, message: "Password updated successfully." };
}
