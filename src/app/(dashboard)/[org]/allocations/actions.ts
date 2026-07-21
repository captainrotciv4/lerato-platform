"use server";

import { z } from "zod";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

const AllocationSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive(),
  currency: z.string().default("KES"),
  category: z.string().optional().or(z.literal("")),
  sourceOrgSlug: z.string().min(1),                   // resolved to ID server-side
  destinationOrgSlug: z.string().min(1),
  sourceProgramId: z.string().optional().or(z.literal("")),
  destinationProgramId: z.string().optional().or(z.literal("")),
});

/**
 * Resolve how many approvers are required for a given amount in a given org,
 * by reading ApprovalRule rows. Returns the highest-threshold rule that applies
 * (so a 300K allocation in an org with 0/50K/250K rules picks the 250K rule).
 */
async function resolveApprovalRequirement(organizationId: string, amount: number) {
  const rules = await dbRetry(() =>
    prisma.approvalRule.findMany({
      where: { organizationId, active: true },
      orderBy: { thresholdAmount: "desc" },
    })
  );
  for (const rule of rules) {
    if (amount >= Number(rule.thresholdAmount)) return rule;
  }
  return null;
}

/** Create an allocation in DRAFT state. */
export async function createAllocation(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_WRITE)) {
    throw new Error("Permission denied");
  }
  const data = AllocationSchema.parse(Object.fromEntries(formData.entries()));

  const [sourceOrg, destOrg] = await dbRetry(() =>
    Promise.all([
      prisma.organization.findUnique({ where: { slug: data.sourceOrgSlug } }),
      prisma.organization.findUnique({ where: { slug: data.destinationOrgSlug } }),
    ])
  );
  if (!sourceOrg || !destOrg) throw new Error("Invalid org slug");

  // Allocations are anchored to the source org for permission purposes;
  // confirm the current user has at least allocation:write in source org.
  if (sourceOrg.id !== ctx.organization.id) {
    throw new Error("You can only create allocations from your current organization");
  }

  const rule = await resolveApprovalRequirement(sourceOrg.id, data.amount);
  const requiredApprovers = rule?.requiredApprovers ?? 1;

  const created = await prisma.$transaction(async (tx) => {
    const a = await tx.fundAllocation.create({
      data: {
        title: data.title,
        description: data.description || null,
        amount: data.amount,
        currency: data.currency,
        category: data.category || null,
        sourceOrgId: sourceOrg.id,
        destinationOrgId: destOrg.id,
        sourceProgramId: data.sourceProgramId || null,
        destinationProgramId: data.destinationProgramId || null,
        status: "DRAFT",
        requiredApprovers,
        createdById: ctx.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "CREATE",
        entity: "FundAllocation",
        entityId: a.id,
        after: a as any,
      },
    });
    return a;
  });

  revalidatePath(`/${orgSlug}/allocations`);
  redirect(`/${orgSlug}/allocations/${created.id}`);
}

/** Submit a draft for approval — creates pending Approval rows. */
export async function submitAllocation(orgSlug: string, allocationId: string) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_WRITE)) {
    throw new Error("Permission denied");
  }

  const allocation = await dbRetry(() =>
    prisma.fundAllocation.findFirst({
      where: { id: allocationId, sourceOrgId: ctx.organization.id, status: "DRAFT" },
    })
  );
  if (!allocation) throw new Error("Draft allocation not found");

  const rule = await resolveApprovalRequirement(ctx.organization.id, Number(allocation.amount));
  const eligibleRoles: Role[] = (rule?.requiredRoles ?? ["FINANCE_LEAD", "ADMIN"]) as Role[];

  await prisma.$transaction(async (tx) => {
    // Create pending approval slots
    const slots = Array.from({ length: allocation.requiredApprovers }).map((_, i) => ({
      allocationId: allocation.id,
      approverId: "",                            // pending — actual approver assigned at decision time
      approverRole: eligibleRoles[Math.min(i, eligibleRoles.length - 1)],
      level: i + 1,
    }));
    // Approval slots use approverId at decision time; for the pending slot we leave
    // approverId blank and rely on role match. This is the simplest model — any user
    // with allocation:approve and matching role can take a slot.
    // Schema requires approverId though — we'll mark these with a sentinel and fix at decide time.
    // SIMPLER: only create the Approval row when an approver actually decides.
    // So here: just flip status to PENDING_APPROVAL.

    await tx.fundAllocation.update({
      where: { id: allocation.id },
      data: { status: "PENDING_APPROVAL", submittedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "SUBMIT",
        entity: "FundAllocation",
        entityId: allocation.id,
        after: { status: "PENDING_APPROVAL", requiredApprovers: allocation.requiredApprovers } as any,
      },
    });
  });

  revalidatePath(`/${orgSlug}/allocations`);
  revalidatePath(`/${orgSlug}/allocations/${allocationId}`);
}

/** Record an approval (or rejection) decision. */
export async function decideAllocation(
  orgSlug: string,
  allocationId: string,
  decision: "APPROVED" | "REJECTED",
  notes?: string,
) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_APPROVE)) {
    throw new Error("You don't have approval permission");
  }

  const allocation = await dbRetry(() =>
    prisma.fundAllocation.findFirst({
      where: { id: allocationId, sourceOrgId: ctx.organization.id, status: "PENDING_APPROVAL" },
      include: { approvals: true },
    })
  );
  if (!allocation) throw new Error("Allocation not found or not pending");

  // Prevent self-approval
  if (allocation.createdById === ctx.user.id) {
    throw new Error("You cannot approve an allocation you created");
  }
  // Prevent double-approval
  if (allocation.approvals.some((a) => a.approverId === ctx.user.id)) {
    throw new Error("You have already decided on this allocation");
  }

  await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.create({
      data: {
        allocationId: allocation.id,
        approverId: ctx.user.id,
        approverRole: ctx.role,
        level: allocation.approvals.length + 1,
        decision,
        decidedAt: new Date(),
        notes: notes || null,
      },
    });

    if (decision === "REJECTED") {
      // Any rejection terminates the approval chain
      await tx.fundAllocation.update({
        where: { id: allocation.id },
        data: { status: "REJECTED", rejectedAt: new Date() },
      });
    } else {
      // Count approvals so far
      const approvedCount = allocation.approvals.filter((a) => a.decision === "APPROVED").length + 1;
      if (approvedCount >= allocation.requiredApprovers) {
        await tx.fundAllocation.update({
          where: { id: allocation.id },
          data: { status: "APPROVED", approvedAt: new Date() },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: decision,
        entity: "FundAllocation",
        entityId: allocation.id,
        after: { decision, notes, approvalId: approval.id } as any,
      },
    });
  });

  revalidatePath(`/${orgSlug}/allocations`);
  revalidatePath(`/${orgSlug}/allocations/${allocationId}`);
}

/** Execute a fully-approved allocation — creates Transaction rows and updates balances. */
export async function executeAllocation(
  orgSlug: string,
  allocationId: string,
  fromAccountId?: string,
) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_EXECUTE)) {
    throw new Error("Permission denied");
  }

  const allocation = await dbRetry(() =>
    prisma.fundAllocation.findFirst({
      where: { id: allocationId, sourceOrgId: ctx.organization.id, status: "APPROVED" },
      include: { sourceOrg: true, destinationOrg: true },
    })
  );
  if (!allocation) throw new Error("Allocation not found or not approved");

  const amount = Number(allocation.amount);
  const ref = `ALLOC-${allocation.id.slice(-8).toUpperCase()}`;

  // Find first ASSET account on destination org for the income side
  const destAccount = await dbRetry(() =>
    prisma.account.findFirst({
      where: { organizationId: allocation.destinationOrgId, type: "ASSET", active: true },
      orderBy: { code: "asc" },
    })
  );

  // Create source expense transaction
  const sourceTx = await dbRetry(() =>
    prisma.transaction.create({
      data: {
        organizationId: allocation.sourceOrgId,
        type: "EXPENSE",
        amount: allocation.amount,
        currency: allocation.currency,
        description: `Allocation to ${allocation.destinationOrg.shortName}: ${allocation.title}`,
        category: allocation.category || "Allocation",
        reference: ref,
        occurredAt: new Date(),
        approvalStatus: "POSTED",
        createdById: ctx.user.id,
        fromAccountId: fromAccountId || null,
      },
    })
  );

  // Deduct from source account balance
  if (fromAccountId) {
    await dbRetry(() =>
      prisma.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      })
    );
  }

  // Create destination income transaction
  const destTx = await dbRetry(() =>
    prisma.transaction.create({
      data: {
        organizationId: allocation.destinationOrgId,
        type: "INCOME",
        amount: allocation.amount,
        currency: allocation.currency,
        description: `Allocation from ${allocation.sourceOrg.shortName}: ${allocation.title}`,
        category: allocation.category || "Allocation",
        reference: ref,
        occurredAt: new Date(),
        approvalStatus: "POSTED",
        createdById: ctx.user.id,
        toAccountId: destAccount?.id ?? null,
      },
    })
  );

  // Credit destination account balance
  if (destAccount) {
    await dbRetry(() =>
      prisma.account.update({
        where: { id: destAccount.id },
        data: { balance: { increment: amount } },
      })
    );
  }

  // Mark allocation EXECUTED
  await dbRetry(() =>
    prisma.fundAllocation.update({
      where: { id: allocation.id },
      data: {
        status: "EXECUTED",
        executedAt: new Date(),
        executedById: ctx.user.id,
        sourceTransactionId: sourceTx.id,
        destinationTransactionId: destTx.id,
      },
    })
  );

  dbRetry(() =>
    prisma.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "EXECUTE",
        entity: "FundAllocation",
        entityId: allocation.id,
        after: { sourceTransactionId: sourceTx.id, destinationTransactionId: destTx.id } as any,
      },
    })
  ).catch(() => null);

  revalidatePath(`/${orgSlug}/allocations`);
  revalidatePath(`/${orgSlug}/allocations/${allocationId}`);
  revalidatePath(`/${orgSlug}/finance`);
}
