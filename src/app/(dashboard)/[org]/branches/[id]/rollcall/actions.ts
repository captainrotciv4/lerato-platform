"use server";

import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
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

/** Approve a pending rollcall. Requires BRANCH_WRITE (Admin / Programme Manager). */
export async function approveRollcall(
  orgSlug: string,
  branchId: string,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await requireTenant(orgSlug);
    if (!can(ctx.role, ctx.permissions, PERMISSIONS.BRANCH_WRITE)) {
      return { ok: false, error: "You don't have permission to approve rollcalls." };
    }

    await dbRetry(() =>
      prisma.trainingSession.update({
        where: { id: sessionId },
        data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date() },
      })
    );

    revalidatePath(`/${orgSlug}/branches/${branchId}`);
    revalidatePath(`/${orgSlug}/branches/${branchId}/rollcall`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Approval failed" };
  }
}

/** Sync an offline-queued rollcall draft — same logic but no redirect. */
export async function syncRollcallRecord(
  orgSlug: string,
  branchId: string,
  payload: {
    date: string;
    sessionType: string;
    notes: string;
    allPlayerIds: string[];
    presentPlayerIds: string[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await requireTenant(orgSlug);

    const session = await dbRetry(() =>
      prisma.trainingSession.create({
        data: {
          branchId,
          date:        new Date(payload.date),
          sessionType: payload.sessionType,
          notes:       payload.notes || null,
          capturedById: ctx.user.id,
        },
      })
    );

    const presentSet = new Set(payload.presentPlayerIds);
    await Promise.all(
      payload.allPlayerIds.map((bId) =>
        dbRetry(() =>
          prisma.trainingAttendance.create({
            data: { sessionId: session.id, beneficiaryId: bId, present: presentSet.has(bId) },
          })
        )
      )
    );

    revalidatePath(`/${orgSlug}/branches/${branchId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Sync failed" };
  }
}
