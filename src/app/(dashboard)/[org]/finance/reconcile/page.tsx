import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { formatDate, formatKES } from "@/lib/utils";
import { reconcileTransaction, unreconcileTransaction } from "../actions";

export const metadata = { title: "Bank Reconciliation — Finance" };

export default async function ReconcilePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ accountId?: string; status?: string }>;
}) {
  const { org } = await params;
  const { accountId, status = "unreconciled" } = await searchParams;
  const ctx = await requireTenant(org);

  const accounts = await dbRetry(() =>
    prisma.account.findMany({
      where: { organizationId: ctx.organization.id, active: true, type: { in: ["ASSET", "LIABILITY"] } },
      orderBy: { code: "asc" },
    })
  );

  const selectedAccount = accountId
    ? accounts.find((a) => a.id === accountId) ?? null
    : null;

  const transactions = accountId
    ? await dbRetry(() =>
        prisma.transaction.findMany({
          where: {
            organizationId: ctx.organization.id,
            approvalStatus: "POSTED",
            OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
            ...(status === "unreconciled" ? { reconciledAt: null } : {}),
            ...(status === "reconciled"   ? { reconciledAt: { not: null } } : {}),
          },
          orderBy: { occurredAt: "desc" },
          include: {
            fromAccount: { select: { code: true, name: true } },
            toAccount:   { select: { code: true, name: true } },
          },
        })
      )
    : [];

  const unreconciledCount = accountId
    ? await dbRetry(() =>
        prisma.transaction.count({
          where: { organizationId: ctx.organization.id, approvalStatus: "POSTED", reconciledAt: null,
            OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] },
        })
      )
    : 0;

  const reconciledCount = accountId
    ? await dbRetry(() =>
        prisma.transaction.count({
          where: { organizationId: ctx.organization.id, approvalStatus: "POSTED", reconciledAt: { not: null },
            OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] },
        })
      )
    : 0;

  const reconciledTotal = transactions
    .filter((t) => t.reconciledAt)
    .reduce((s, t) => s + Number(t.amount), 0);

  const unreconciledTotal = transactions
    .filter((t) => !t.reconciledAt)
    .reduce((s, t) => s + Number(t.amount), 0);

  const canReconcile = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";

  return (
    <div className="space-y-6">
      <Link
        href={`/${org}/finance` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to finance
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Bank Reconciliation</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Match posted transactions against your bank or M-Pesa statement
          </p>
        </div>
      </div>

      {/* Account selector */}
      <div className="card">
        <form method="GET" className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="text-xs font-medium text-[var(--fg-muted)]">Select account</label>
            <select name="accountId" defaultValue={accountId ?? ""} className="mt-1 w-full text-sm">
              <option value="">— choose account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--fg-muted)]">Status</label>
            <select name="status" defaultValue={status} className="mt-1 w-full text-sm">
              <option value="unreconciled">Unreconciled</option>
              <option value="reconciled">Reconciled</option>
              <option value="all">All</option>
            </select>
          </div>
          <button type="submit" className="btn-primary text-sm">View</button>
        </form>
      </div>

      {selectedAccount && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold font-display text-[var(--fg)]">{unreconciledCount}</div>
              <div className="text-xs text-[var(--fg-muted)] mt-0.5">Unreconciled</div>
              <div className="text-sm font-mono font-semibold text-amber-600 mt-1">{formatKES(unreconciledTotal)}</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold font-display text-emerald-600">{reconciledCount}</div>
              <div className="text-xs text-[var(--fg-muted)] mt-0.5">Reconciled</div>
              <div className="text-sm font-mono font-semibold text-emerald-600 mt-1">{formatKES(reconciledTotal)}</div>
            </div>
            <div className="card col-span-2 flex items-center justify-between px-5">
              <div>
                <div className="text-xs text-[var(--fg-muted)]">Account balance</div>
                <div className="font-display text-xl font-bold text-[var(--fg)] mt-0.5">
                  {formatKES(Number(selectedAccount.balance))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--fg-muted)]">Account</div>
                <div className="font-mono text-sm font-semibold text-[var(--fg)]">{selectedAccount.code}</div>
                <div className="text-xs text-[var(--fg-muted)]">{selectedAccount.name}</div>
              </div>
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1 w-fit text-sm">
            {(["unreconciled", "reconciled", "all"] as const).map((s) => (
              <Link
                key={s}
                href={`/${org}/finance/reconcile?accountId=${accountId}&status=${s}` as any}
                className={`px-4 py-1.5 rounded-lg font-medium capitalize transition-all ${
                  status === s
                    ? "bg-[var(--bg)] text-[var(--fg)] shadow-sm"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>

          {/* Transactions table */}
          <div className="card !p-0 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-sm text-[var(--fg-muted)]">
                No {status === "all" ? "" : status} transactions for this account.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium w-8">Rec.</th>
                      <th className="px-5 py-3 text-left font-medium">Date</th>
                      <th className="px-5 py-3 text-left font-medium">Description</th>
                      <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Contra</th>
                      <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Ref</th>
                      <th className="px-5 py-3 text-right font-medium">Amount</th>
                      <th className="px-5 py-3 text-left font-medium hidden lg:table-cell">Reconciled on</th>
                      {canReconcile && <th className="px-5 py-3 text-center font-medium">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const contra = tx.toAccountId === accountId ? tx.fromAccount : tx.toAccount;
                      const isReconciled = !!tx.reconciledAt;
                      return (
                        <tr
                          key={tx.id}
                          className={`border-t border-[var(--border)] transition-colors ${
                            isReconciled ? "bg-emerald-50/30 hover:bg-emerald-50/50" : "hover:bg-[var(--bg-muted)]"
                          }`}
                        >
                          <td className="px-5 py-3 text-center">
                            {isReconciled ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-[var(--border)] mx-auto" />
                            )}
                          </td>
                          <td className="px-5 py-3 text-[var(--fg-muted)] whitespace-nowrap">{formatDate(tx.occurredAt)}</td>
                          <td className="px-5 py-3">
                            <Link
                              href={`/${org}/finance/${tx.id}` as any}
                              className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)] hover:underline"
                            >
                              {tx.description}
                            </Link>
                            {tx.payee && <div className="text-xs text-[var(--fg-muted)]">{tx.payee}</div>}
                          </td>
                          <td className="px-5 py-3 text-xs text-[var(--fg-muted)] font-mono hidden md:table-cell">
                            {contra ? `${contra.code} — ${contra.name}` : "—"}
                          </td>
                          <td className="px-5 py-3 text-xs font-mono text-[var(--fg-muted)] hidden md:table-cell">
                            {tx.reference ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-semibold text-[var(--fg)]">
                            {formatKES(Number(tx.amount))}
                          </td>
                          <td className="px-5 py-3 text-xs text-[var(--fg-muted)] hidden lg:table-cell">
                            {isReconciled ? formatDate(tx.reconciledAt!) : "—"}
                          </td>
                          {canReconcile && (
                            <td className="px-5 py-3 text-center">
                              {isReconciled ? (
                                <form action={async () => {
                                  "use server";
                                  await unreconcileTransaction(org, tx.id);
                                }}>
                                  <button
                                    type="submit"
                                    className="text-xs text-amber-600 hover:text-amber-700 hover:underline"
                                  >
                                    Undo
                                  </button>
                                </form>
                              ) : (
                                <form action={async () => {
                                  "use server";
                                  await reconcileTransaction(org, tx.id);
                                }}>
                                  <button
                                    type="submit"
                                    className="badge bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer text-xs"
                                  >
                                    Reconcile
                                  </button>
                                </form>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-[var(--border)] bg-[var(--bg-muted)]">
                    <tr>
                      <td colSpan={canReconcile ? 5 : 4} className="px-5 py-3 text-right text-xs uppercase tracking-wide font-bold text-[var(--fg-muted)]">
                        Total shown
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-[var(--fg)]">
                        {formatKES(transactions.reduce((s, t) => s + Number(t.amount), 0))}
                      </td>
                      <td colSpan={canReconcile ? 2 : 1} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
