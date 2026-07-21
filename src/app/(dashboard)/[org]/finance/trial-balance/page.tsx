import React from "react";
import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { formatKES, formatDate } from "@/lib/utils";

export const metadata = { title: "Trial Balance — Finance" };

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
const TYPE_BADGE: Record<string, string> = {
  ASSET:     "bg-blue-100 text-blue-800",
  LIABILITY: "bg-red-100 text-red-800",
  EQUITY:    "bg-purple-100 text-purple-800",
  INCOME:    "bg-emerald-100 text-emerald-800",
  EXPENSE:   "bg-amber-100 text-amber-800",
};

export default async function TrialBalancePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const accounts = await dbRetry(() =>
    prisma.account.findMany({
      where: { organizationId: ctx.organization.id, active: true },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    })
  );

  // Build trial balance rows
  const rows = accounts.map((acc) => {
    const bal = Number(acc.balance);
    // ASSET + EXPENSE have natural debit balances; LIABILITY + EQUITY + INCOME have credit balances
    let debit = 0, credit = 0;
    if (["ASSET", "EXPENSE"].includes(acc.type)) {
      if (bal >= 0) debit  = bal;
      else          credit = Math.abs(bal);
    } else {
      if (bal >= 0) credit = bal;
      else          debit  = Math.abs(bal);
    }
    return { acc, debit, credit };
  });

  const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  // Group by type for display
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: rows.filter((r) => r.acc.type === type),
  })).filter((g) => g.rows.length > 0);

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Trial Balance</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {ctx.organization.shortName} · As at {formatDate(today)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge text-sm px-4 py-2 ${isBalanced ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
            {isBalanced ? "✓ Balanced" : "⚠ Out of balance"}
          </span>
          <button
            onClick={undefined}
            className="btn-secondary text-sm"
            style={{ cursor: "pointer" }}
            title="Use Ctrl+P to print"
          >
            Print
          </button>
        </div>
      </div>

      {!isBalanced && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Out of balance:</strong> Difference of {formatKES(Math.abs(totalDebit - totalCredit))}.
          Check for unposted transactions or missing journal entries.
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--border)] bg-[var(--bg-muted)] px-6 py-4 text-center">
          <div className="font-display text-xl font-bold text-[var(--fg)]">{ctx.organization.name}</div>
          <div className="mt-0.5 text-sm text-[var(--fg-muted)]">Trial Balance as at {formatDate(today)}</div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Code</th>
              <th className="px-6 py-3 text-left font-medium">Account name</th>
              <th className="px-6 py-3 text-left font-medium hidden md:table-cell">Type</th>
              <th className="px-6 py-3 text-right font-medium text-emerald-700">Debit (KES)</th>
              <th className="px-6 py-3 text-right font-medium text-red-700">Credit (KES)</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ type, rows: typeRows }) => (
              <React.Fragment key={type}>
                <tr className="bg-[var(--bg-muted)]/50">
                  <td colSpan={5} className="px-6 py-2">
                    <span className={`badge text-xs ${TYPE_BADGE[type]}`}>{type}</span>
                  </td>
                </tr>
                {typeRows.map(({ acc, debit, credit }) => (
                  <tr key={acc.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-2.5 font-mono text-xs text-[var(--fg-muted)]">{acc.code}</td>
                    <td className="px-6 py-2.5 text-[var(--fg)]">{acc.name}</td>
                    <td className="px-6 py-2.5 hidden md:table-cell">
                      <span className={`badge text-xs ${TYPE_BADGE[acc.type]}`}>{acc.type}</span>
                    </td>
                    <td className="px-6 py-2.5 text-right font-mono text-emerald-700">
                      {debit > 0 ? formatKES(debit) : ""}
                    </td>
                    <td className="px-6 py-2.5 text-right font-mono text-red-700">
                      {credit > 0 ? formatKES(credit) : ""}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[var(--border)] bg-[var(--bg-muted)]">
            <tr>
              <td colSpan={3} className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--fg)]">
                TOTALS
              </td>
              <td className={`px-6 py-3 text-right font-mono font-bold text-base ${isBalanced ? "text-emerald-700" : "text-red-600"}`}>
                {formatKES(totalDebit)}
              </td>
              <td className={`px-6 py-3 text-right font-mono font-bold text-base ${isBalanced ? "text-red-700" : "text-red-600"}`}>
                {formatKES(totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
