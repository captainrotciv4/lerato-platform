import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { formatDate, formatKES } from "@/lib/utils";

export const metadata = { title: "Account Ledger — Finance" };

const TYPE_BADGE: Record<string, string> = {
  ASSET:     "bg-blue-100 text-blue-800",
  LIABILITY: "bg-red-100 text-red-800",
  EQUITY:    "bg-purple-100 text-purple-800",
  INCOME:    "bg-emerald-100 text-emerald-800",
  EXPENSE:   "bg-amber-100 text-amber-800",
};

export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  const account = await dbRetry(() =>
    prisma.account.findFirst({
      where: { id, organizationId: ctx.organization.id },
    })
  );
  if (!account) notFound();

  // All posted transactions affecting this account
  const transactions = await dbRetry(() =>
    prisma.transaction.findMany({
      where: {
        organizationId: ctx.organization.id,
        approvalStatus: "POSTED",
        OR: [{ fromAccountId: id }, { toAccountId: id }],
      },
      orderBy: { occurredAt: "asc" },
      include: {
        fromAccount: { select: { code: true, name: true } },
        toAccount:   { select: { code: true, name: true } },
      },
    })
  );

  // Compute running balance (debit increases, credit decreases)
  let running = 0;
  const entries = transactions.map((tx) => {
    const amount = Number(tx.amount);
    let debit = 0, credit = 0;
    if (tx.toAccountId === id)   { debit  = amount; }
    if (tx.fromAccountId === id) { credit = amount; }
    running += debit - credit;
    return { tx, debit, credit, balance: running };
  });

  const totalDebits  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredits = entries.reduce((s, e) => s + e.credit, 0);

  return (
    <div className="space-y-6">
      <Link
        href={`/${org}/finance/accounts` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to accounts
      </Link>

      {/* Account header */}
      <div className="card flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-[var(--fg)]">{account.code}</span>
            <span className={`badge ${TYPE_BADGE[account.type]}`}>{account.type}</span>
            {account.subtype && (
              <span className="badge bg-[var(--bg-muted)] text-[var(--fg-muted)]">{account.subtype}</span>
            )}
          </div>
          <h1 className="font-display mt-1 text-2xl font-bold text-[var(--fg)]">{account.name}</h1>
          {account.description && (
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{account.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--fg-muted)]">Current balance</div>
          <div className={`font-display text-2xl font-bold ${Number(account.balance) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatKES(Number(account.balance))}
          </div>
          <div className="text-xs text-[var(--fg-muted)]">{transactions.length} transactions</div>
        </div>
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <TrendingUp className="mx-auto h-5 w-5 text-emerald-500" />
          <div className="font-display mt-1 text-xl font-bold text-emerald-600">{formatKES(totalDebits)}</div>
          <div className="text-xs text-[var(--fg-muted)]">Total debits</div>
        </div>
        <div className="card text-center">
          <TrendingDown className="mx-auto h-5 w-5 text-red-500" />
          <div className="font-display mt-1 text-xl font-bold text-red-600">{formatKES(totalCredits)}</div>
          <div className="text-xs text-[var(--fg-muted)]">Total credits</div>
        </div>
        <div className="card text-center">
          <div className="text-[var(--fg-muted)] text-xs">Net movement</div>
          <div className={`font-display mt-1 text-xl font-bold ${totalDebits - totalCredits >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatKES(totalDebits - totalCredits)}
          </div>
          <div className="text-xs text-[var(--fg-muted)]">Debit − Credit</div>
        </div>
      </div>

      {/* Ledger table */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Account statement
          </h2>
        </div>
        {entries.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No posted transactions for this account yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Date</th>
                  <th className="px-6 py-3 text-left font-medium">Description</th>
                  <th className="px-6 py-3 text-left font-medium hidden md:table-cell">Contra account</th>
                  <th className="px-6 py-3 text-left font-medium hidden md:table-cell">Ref</th>
                  <th className="px-6 py-3 text-right font-medium text-emerald-700">Debit</th>
                  <th className="px-6 py-3 text-right font-medium text-red-700">Credit</th>
                  <th className="px-6 py-3 text-right font-medium">Balance</th>
                  <th className="px-6 py-3 text-center font-medium hidden md:table-cell">Rec.</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ tx, debit, credit, balance }) => {
                  const contraAccount = tx.toAccountId === id ? tx.fromAccount : tx.toAccount;
                  return (
                    <tr key={tx.id} className={`border-t border-[var(--border)] hover:bg-[var(--bg-muted)] ${tx.reconciledAt ? "opacity-70" : ""}`}>
                      <td className="px-6 py-3 text-[var(--fg-muted)] whitespace-nowrap">{formatDate(tx.occurredAt)}</td>
                      <td className="px-6 py-3">
                        <Link href={`/${org}/finance/${tx.id}` as any} className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)] hover:underline">
                          {tx.description}
                        </Link>
                        {tx.payee && <div className="text-xs text-[var(--fg-muted)]">{tx.payee}</div>}
                      </td>
                      <td className="px-6 py-3 text-[var(--fg-muted)] hidden md:table-cell">
                        {contraAccount ? (
                          <span className="font-mono text-xs">{contraAccount.code} — {contraAccount.name}</span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-[var(--fg-muted)] hidden md:table-cell">{tx.reference ?? "—"}</td>
                      <td className="px-6 py-3 text-right font-mono text-emerald-700">
                        {debit > 0 ? formatKES(debit) : ""}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-red-700">
                        {credit > 0 ? formatKES(credit) : ""}
                      </td>
                      <td className={`px-6 py-3 text-right font-mono font-semibold ${balance >= 0 ? "text-[var(--fg)]" : "text-red-600"}`}>
                        {formatKES(balance)}
                      </td>
                      <td className="px-6 py-3 text-center hidden md:table-cell">
                        {tx.reconciledAt ? (
                          <span className="text-emerald-500" title={`Reconciled ${formatDate(tx.reconciledAt)}`}>✓</span>
                        ) : (
                          <span className="text-[var(--border)]">○</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-[var(--border)] bg-[var(--bg-muted)] font-semibold">
                <tr>
                  <td colSpan={4} className="px-6 py-3 text-right text-xs uppercase tracking-wide text-[var(--fg-muted)]">Totals</td>
                  <td className="px-6 py-3 text-right font-mono text-emerald-700">{formatKES(totalDebits)}</td>
                  <td className="px-6 py-3 text-right font-mono text-red-700">{formatKES(totalCredits)}</td>
                  <td className="px-6 py-3 text-right font-mono text-[var(--fg)]">{formatKES(Number(account.balance))}</td>
                  <td className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
