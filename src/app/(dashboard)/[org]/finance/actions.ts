"use server";

import { z } from "zod";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const TxSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.coerce.number().positive(),
  currency: z.string().default("KES"),
  description: z.string().min(2),
  category: z.string().optional().or(z.literal("")),
  reference: z.string().optional().or(z.literal("")),
  occurredAt: z.string().refine((d) => !isNaN(Date.parse(d))),
  fromAccountId: z.string().optional().or(z.literal("")),
  toAccountId: z.string().optional().or(z.literal("")),
  payee: z.string().optional().or(z.literal("")),
  budgetLine: z.string().optional().or(z.literal("")),
  programId: z.string().optional().or(z.literal("")),
});

export async function createTransaction(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.FINANCE_WRITE)) throw new Error("Permission denied");

  const data = TxSchema.parse(Object.fromEntries(formData.entries()));

  const canPostDirectly = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";
  const approvalStatus = canPostDirectly ? "POSTED" : "PENDING_APPROVAL";

  const t = await dbRetry(() =>
    prisma.transaction.create({
      data: {
        organizationId: ctx.organization.id,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        category: data.category || null,
        reference: data.reference || null,
        occurredAt: new Date(data.occurredAt),
        approvalStatus,
        createdById: ctx.user.id,
        fromAccountId: data.fromAccountId || null,
        toAccountId: data.toAccountId || null,
        payee: data.payee || null,
        budgetLine: data.budgetLine || null,
      },
    })
  );

  // Update account balances when posted directly
  if (approvalStatus === "POSTED") {
    await updateAccountBalances(t.type, data.amount, data.fromAccountId || null, data.toAccountId || null, {
      txId: t.id, orgId: ctx.organization.id, date: t.occurredAt, memo: data.description, postedById: ctx.user.id,
    });
  }

  // Audit log (non-blocking)
  dbRetry(() =>
    prisma.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "CREATE",
        entity: "Transaction",
        entityId: t.id,
        after: { ...t, amount: t.amount.toString() } as any,
      },
    })
  ).catch(() => null);

  revalidatePath(`/${orgSlug}/finance`);
  redirect(`/${orgSlug}/finance`);
}

async function createJournalEntry(
  orgId: string, txId: string, type: string, amount: number,
  date: Date, description: string,
  fromAccountId: string | null, toAccountId: string | null, postedById: string | null,
) {
  const year = date.getFullYear();
  const entryNumber = `JE-${year}-${txId.slice(-6).toUpperCase()}`;

  const lines: { accountId: string | null; description: string; debit: number; credit: number }[] = [];
  if (type === "INCOME") {
    lines.push({ accountId: toAccountId,   description: "Cash/bank receipt",        debit: amount, credit: 0      });
    lines.push({ accountId: null,          description: `Income — ${description}`,  debit: 0,      credit: amount });
  } else if (type === "EXPENSE") {
    lines.push({ accountId: null,          description: `Expense — ${description}`, debit: amount, credit: 0      });
    lines.push({ accountId: fromAccountId, description: "Cash/bank payment",        debit: 0,      credit: amount });
  } else if (type === "TRANSFER" && fromAccountId && toAccountId) {
    lines.push({ accountId: toAccountId,   description: "Transfer in",              debit: amount, credit: 0      });
    lines.push({ accountId: fromAccountId, description: "Transfer out",             debit: 0,      credit: amount });
  } else {
    return;
  }

  const journal = await dbRetry(() =>
    prisma.journalEntry.create({
      data: { organizationId: orgId, transactionId: txId, entryNumber, date, memo: description, postedById },
    })
  );
  await Promise.all(
    lines.map((l) =>
      dbRetry(() =>
        prisma.journalLine.create({
          data: { journalId: journal.id, accountId: l.accountId || null, description: l.description, debit: l.debit, credit: l.credit },
        })
      )
    )
  );
}

async function updateAccountBalances(
  type: string, amount: number,
  fromAccountId: string | null, toAccountId: string | null,
  opts?: { txId?: string; date?: Date; memo?: string; orgId?: string; postedById?: string | null },
) {
  if (type === "INCOME" && toAccountId) {
    await dbRetry(() =>
      prisma.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      })
    );
  } else if (type === "EXPENSE" && fromAccountId) {
    await dbRetry(() =>
      prisma.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      })
    );
  } else if (type === "TRANSFER") {
    if (fromAccountId) {
      await dbRetry(() =>
        prisma.account.update({
          where: { id: fromAccountId },
          data: { balance: { decrement: amount } },
        })
      );
    }
    if (toAccountId) {
      await dbRetry(() =>
        prisma.account.update({
          where: { id: toAccountId },
          data: { balance: { increment: amount } },
        })
      );
    }
  }

  // Auto-create journal entry if opts provided
  if (opts?.txId && opts.orgId) {
    createJournalEntry(
      opts.orgId, opts.txId, type, amount,
      opts.date ?? new Date(), opts.memo ?? type,
      fromAccountId, toAccountId, opts.postedById ?? null,
    ).catch(() => null);
  }
}

export async function approveTransaction(orgSlug: string, txId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  const tx = await dbRetry(() =>
    prisma.transaction.update({
      where: { id: txId, organizationId: ctx.organization.id },
      data: { approvalStatus: "POSTED" },
    })
  );

  // Update balances now that it's approved
  await updateAccountBalances(tx.type, Number(tx.amount), tx.fromAccountId, tx.toAccountId, {
    txId: tx.id, orgId: ctx.organization.id, date: tx.occurredAt, memo: tx.description, postedById: ctx.user.id,
  });

  prisma.auditLog.create({
    data: {
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "UPDATE",
      entity: "Transaction",
      entityId: txId,
      after: { approvalStatus: "POSTED" } as any,
    },
  }).catch(() => null);

  revalidatePath(`/${orgSlug}/finance`);
}

export async function rejectTransaction(orgSlug: string, txId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.transaction.update({
      where: { id: txId, organizationId: ctx.organization.id },
      data: { approvalStatus: "REJECTED" },
    })
  );

  prisma.auditLog.create({
    data: {
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "UPDATE",
      entity: "Transaction",
      entityId: txId,
      after: { approvalStatus: "REJECTED" } as any,
    },
  }).catch(() => null);

  revalidatePath(`/${orgSlug}/finance`);
}

// ── Bulk import ──────────────────────────────────────────────────────────────

const BulkRowSchema = z.object({
  date:         z.string().refine((d) => !isNaN(Date.parse(d))),
  type:         z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  description:  z.string().min(1),
  amount:       z.coerce.number().positive(),
  category:     z.string().optional().or(z.literal("")),
  reference:    z.string().optional().or(z.literal("")),
});

export async function bulkImportTransactions(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.FINANCE_WRITE)) throw new Error("Permission denied");

  const raw = (formData.get("csv") as string ?? "").trim();
  if (!raw) throw new Error("No CSV data provided");

  const lines = raw.split(/\r?\n/).filter(Boolean);
  // Skip header line if present
  const dataLines = lines[0]?.toLowerCase().includes("date") ? lines.slice(1) : lines;

  const rows: z.infer<typeof BulkRowSchema>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const cols = dataLines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [date, type, description, amount, category = "", reference = ""] = cols;
    const parsed = BulkRowSchema.safeParse({ date, type, description, amount, category, reference });
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      errors.push(`Row ${i + 2}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
    }
  }

  if (rows.length === 0) throw new Error(`No valid rows found. ${errors.slice(0, 3).join(" | ")}`);

  // createMany — NeonHttp supports bulk inserts; transactions start as PENDING_APPROVAL for review
  await dbRetry(() =>
    prisma.transaction.createMany({
      data: rows.map((r) => ({
        organizationId: ctx.organization.id,
        type: r.type,
        amount: r.amount,
        currency: "KES",
        description: r.description,
        category: r.category || null,
        reference: r.reference || null,
        occurredAt: new Date(r.date),
        approvalStatus: "PENDING_APPROVAL",
        createdById: ctx.user.id,
      })),
      skipDuplicates: false,
    })
  );

  revalidatePath(`/${orgSlug}/finance`);
  redirect(`/${orgSlug}/finance`);
}

// ── Chart of Accounts actions ─────────────────────────────────────────────

const AccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
  subtype: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  currency: z.string().default("KES"),
  parentId: z.string().optional().or(z.literal("")),
  isRestricted: z.string().optional(),
  restrictionNote: z.string().optional().or(z.literal("")),
});

export async function createAccount(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  const data = AccountSchema.parse(Object.fromEntries(formData.entries()));

  await dbRetry(() =>
    prisma.account.create({
      data: {
        organizationId: ctx.organization.id,
        code: data.code,
        name: data.name,
        type: data.type as any,
        subtype: data.subtype || null,
        description: data.description || null,
        currency: data.currency,
        parentId: data.parentId || null,
        isRestricted: data.isRestricted === "true",
        restrictionNote: data.restrictionNote || null,
      },
    })
  );

  revalidatePath(`/${orgSlug}/finance/accounts`);
  redirect(`/${orgSlug}/finance/accounts`);
}

export async function toggleAccountActive(orgSlug: string, accountId: string, active: boolean) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.account.updateMany({
      where: { id: accountId, organizationId: ctx.organization.id, isSystem: false },
      data: { active },
    })
  );

  revalidatePath(`/${orgSlug}/finance/accounts`);
}

// ── Reconciliation ────────────────────────────────────────────────────────────

export async function reconcileTransaction(orgSlug: string, txId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.transaction.updateMany({
      where: { id: txId, organizationId: ctx.organization.id, approvalStatus: "POSTED" },
      data: { reconciledAt: new Date(), reconciledById: ctx.user.id },
    })
  );

  revalidatePath(`/${orgSlug}/finance/reconcile`);
}

export async function unreconcileTransaction(orgSlug: string, txId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.transaction.updateMany({
      where: { id: txId, organizationId: ctx.organization.id },
      data: { reconciledAt: null, reconciledById: null },
    })
  );

  revalidatePath(`/${orgSlug}/finance/reconcile`);
}
