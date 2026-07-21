"use server";

import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createRollcall(
  orgSlug: string,
  branchId: string,
  formData: FormData,
) {
  const ctx = await requireTenant(orgSlug);

  const dateStr = formData.get("date") as string;
  const sessionType = (formData.get("sessionType") as string) || "TRAINING";
  const notes = (formData.get("notes") as string) || null;

  // Parse attendance: form fields named "present_<beneficiaryId>"
  const presentIds = new Set<string>();
  const allIds: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("player_")) {
      const bId = key.replace("player_", "");
      allIds.push(bId);
    }
    if (key.startsWith("present_") && value === "on") {
      presentIds.add(key.replace("present_", ""));
    }
  }

  // Create session first (NeonHttp doesn't support nested creates inside implicit transactions)
  const session = await dbRetry(() =>
    prisma.trainingSession.create({
      data: {
        branchId,
        date: new Date(dateStr),
        sessionType,
        notes,
        capturedById: ctx.user.id,
      },
    })
  );

  // Create attendance records individually in parallel
  await Promise.all(
    allIds.map((bId) =>
      dbRetry(() =>
        prisma.trainingAttendance.create({
          data: {
            sessionId: session.id,
            beneficiaryId: bId,
            present: presentIds.has(bId),
          },
        })
      )
    )
  );

  revalidatePath(`/${orgSlug}/branches/${branchId}`);
  redirect(`/${orgSlug}/branches/${branchId}`);
}
