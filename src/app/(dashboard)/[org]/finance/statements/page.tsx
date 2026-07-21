import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { formatKES, formatDate } from "@/lib/utils";

export const metadata = { title: "Financial Statements — Finance" };

export default async function StatementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const { org } = await params;
  const { tab = "pl", from, to } = await searchParams;
  const ctx = await requireTenant(org);

  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const periodStart = from ? new Date(from) : yearStart;
  const periodEnd   = to   ? new Date(to)   : today;

  const accounts = await dbRetry(() =>
    prisma.account.findMany({
      where: { organizationId: ctx.organization.id, active: true },
      orderBy: { code: "asc" },
    })
  );

  // P&L: sum transactions within the period grouped by category
  const [incomeTxs, expenseTxs] = await dbRetry(() =>
    Promise.all([
      prisma.transaction.findMany({
        where: {
          organizationId: ctx.organization.id,
          type: "INCOME",
          approvalStatus: "POSTED",
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
        select: { amount: true, category: true },
      }),
      prisma.transaction.findMany({
        where: {
          organizationId: ctx.organization.id,
          type: "EXPENSE",
          approvalStatus: "POSTED",
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
        select: { amount: true, category: true },
      }),
    ])
  );

  // Aggregate by category
  const incomeByCategory: Record<string, number> = {};
  for (const tx of incomeTxs) {
    const key = tx.category || "General Income";
    incomeByCategory[key] = (incomeByCategory[key] ?? 0) + Number(tx.amount);
  }
  const expenseByCategory: Record<string, number> = {};
  for (const tx of expenseTxs) {
    const key = tx.category || "General Expenses";
    expenseByCategory[key] = (expenseByCategory[key] ?? 0) + Number(tx.amount);
  }

  // Income statement rows — sorted descending by amount
  const incomeRows = Object.entries(incomeByCategory)
    .map(([cat, amount]) => ({ cat, amount }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const expenseRows = Object.entries(expenseByCategory)
    .map(([cat, amount]) => ({ cat, amount }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalIncome   = incomeRows.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);
  const surplus       = totalIncome - totalExpenses;

  // Balance sheet: use current account balances
  const assetAccounts     = accounts.filter((a) => a.type === "ASSET");
  const liabilityAccounts = accounts.filter((a) => a.type === "LIABILITY");
  const equityAccounts    = accounts.filter((a) => a.type === "EQUITY");

  const totalAssets      = assetAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalLiabilities = liabilityAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalEquity      = equityAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const isBalanced       = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

  const tabClass = (t: string) =>
    `px-5 py-2 text-sm font-medium rounded-lg transition-all ${
      tab === t
        ? "bg-[var(--bg)] text-[var(--fg)] shadow-sm"
        : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Financial Statements</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{ctx.organization.shortName}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1 w-fit">
        <Link href={`/${org}/finance/statements?tab=pl&from=${periodStart.toISOString().slice(0,10)}&to=${periodEnd.toISOString().slice(0,10)}` as any} className={tabClass("pl")}>
          Income Statement
        </Link>
        <Link href={`/${org}/finance/statements?tab=bs&from=${periodStart.toISOString().slice(0,10)}&to=${periodEnd.toISOString().slice(0,10)}` as any} className={tabClass("bs")}>
          Balance Sheet
        </Link>
      </div>

      {/* Period selector (for P&L) */}
      {tab === "pl" && (
        <form method="GET" className="flex items-center gap-3 flex-wrap">
          <input type="hidden" name="tab" value="pl" />
          <div className="flex items-center gap-2 text-sm">
            <label className="text-[var(--fg-muted)]">From</label>
            <input type="date" name="from" defaultValue={periodStart.toISOString().slice(0,10)} className="w-40" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-[var(--fg-muted)]">To</label>
            <input type="date" name="to" defaultValue={periodEnd.toISOString().slice(0,10)} className="w-40" />
          </div>
          <button type="submit" className="btn-secondary text-sm">Apply</button>
        </form>
      )}

      {/* ── Income Statement (P&L) ──────────────────────────────────────── */}
      {tab === "pl" && (
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--bg-muted)] px-6 py-4 text-center">
            <div className="font-display text-xl font-bold text-[var(--fg)]">{ctx.organization.name}</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--fg)]">Income Statement</div>
            <div className="text-xs text-[var(--fg-muted)]">For the period {formatDate(periodStart)} to {formatDate(periodEnd)}</div>
          </div>

          <table className="w-full text-sm">
            <tbody>
              {/* Income */}
              <tr className="bg-emerald-50/50">
                <td colSpan={2} className="px-6 py-3 font-display font-bold text-emerald-800 uppercase tracking-wide text-xs">
                  Income
                </td>
              </tr>
              {incomeRows.length === 0 && (
                <tr><td colSpan={2} className="px-6 py-3 text-[var(--fg-muted)] text-xs italic">No income recorded for this period.</td></tr>
              )}
              {incomeRows.map(({ cat, amount }) => (
                <tr key={cat} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                  <td className="px-6 py-2.5 text-[var(--fg)]">{cat}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-[var(--fg)]">{formatKES(amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-[var(--border)] bg-emerald-50">
                <td className="px-6 py-3 font-semibold text-emerald-800">Total Income</td>
                <td className="px-6 py-3 text-right font-mono font-bold text-emerald-700">{formatKES(totalIncome)}</td>
              </tr>

              {/* Expenses */}
              <tr className="border-t-2 border-[var(--border)] bg-red-50/50">
                <td colSpan={2} className="px-6 py-3 font-display font-bold text-red-800 uppercase tracking-wide text-xs">
                  Expenditure
                </td>
              </tr>
              {expenseRows.length === 0 && (
                <tr><td colSpan={2} className="px-6 py-3 text-[var(--fg-muted)] text-xs italic">No expenses recorded for this period.</td></tr>
              )}
              {expenseRows.map(({ cat, amount }) => (
                <tr key={cat} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                  <td className="px-6 py-2.5 text-[var(--fg)]">{cat}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-[var(--fg)]">{formatKES(amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-[var(--border)] bg-red-50">
                <td className="px-6 py-3 font-semibold text-red-800">Total Expenditure</td>
                <td className="px-6 py-3 text-right font-mono font-bold text-red-700">{formatKES(totalExpenses)}</td>
              </tr>

              {/* Surplus / Deficit */}
              <tr className={`border-t-2 border-[var(--border)] ${surplus >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                <td className="px-6 py-4 font-display font-bold text-[var(--fg)]">
                  {surplus >= 0 ? "Net Surplus" : "Net Deficit"}
                </td>
                <td className={`px-6 py-4 text-right font-mono font-bold text-xl ${surplus >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {surplus < 0 ? "(" : ""}{formatKES(Math.abs(surplus))}{surplus < 0 ? ")" : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Balance Sheet ───────────────────────────────────────────────── */}
      {tab === "bs" && (
        <div className="card !p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--bg-muted)] px-6 py-4 text-center">
            <div className="font-display text-xl font-bold text-[var(--fg)]">{ctx.organization.name}</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--fg)]">Balance Sheet (Statement of Financial Position)</div>
            <div className="text-xs text-[var(--fg-muted)]">As at {formatDate(today)}</div>
          </div>

          <div className="grid md:grid-cols-2 divide-x divide-[var(--border)]">
            {/* Assets */}
            <table className="w-full text-sm">
              <tbody>
                <tr className="bg-blue-50/50">
                  <td colSpan={2} className="px-6 py-3 font-display font-bold text-blue-800 uppercase tracking-wide text-xs">
                    Assets
                  </td>
                </tr>
                {assetAccounts.filter(a => Number(a.balance) !== 0).map((acc) => (
                  <tr key={acc.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-2.5 text-[var(--fg)]">
                      <span className="font-mono text-xs text-[var(--fg-muted)] mr-2">{acc.code}</span>
                      {acc.name}
                    </td>
                    <td className="px-6 py-2.5 text-right font-mono text-[var(--fg)]">{formatKES(Number(acc.balance))}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--border)] bg-blue-50">
                  <td className="px-6 py-3 font-bold text-blue-800">Total Assets</td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-blue-700">{formatKES(totalAssets)}</td>
                </tr>
              </tbody>
            </table>

            {/* Liabilities + Equity */}
            <table className="w-full text-sm">
              <tbody>
                <tr className="bg-red-50/50">
                  <td colSpan={2} className="px-6 py-3 font-display font-bold text-red-800 uppercase tracking-wide text-xs">
                    Liabilities
                  </td>
                </tr>
                {liabilityAccounts.filter(a => Number(a.balance) !== 0).map((acc) => (
                  <tr key={acc.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-2.5 text-[var(--fg)]">
                      <span className="font-mono text-xs text-[var(--fg-muted)] mr-2">{acc.code}</span>
                      {acc.name}
                    </td>
                    <td className="px-6 py-2.5 text-right font-mono text-[var(--fg)]">{formatKES(Number(acc.balance))}</td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--border)] bg-red-50">
                  <td className="px-6 py-3 font-semibold text-red-800">Total Liabilities</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-red-700">{formatKES(totalLiabilities)}</td>
                </tr>

                <tr className="bg-purple-50/50">
                  <td colSpan={2} className="px-6 py-3 font-display font-bold text-purple-800 uppercase tracking-wide text-xs">
                    Equity / Funds
                  </td>
                </tr>
                {equityAccounts.filter(a => Number(a.balance) !== 0).map((acc) => (
                  <tr key={acc.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-2.5 text-[var(--fg)]">
                      <span className="font-mono text-xs text-[var(--fg-muted)] mr-2">{acc.code}</span>
                      {acc.name}
                    </td>
                    <td className="px-6 py-2.5 text-right font-mono text-[var(--fg)]">{formatKES(Number(acc.balance))}</td>
                  </tr>
                ))}
                {/* Retained surplus from P&L */}
                {Math.abs(surplus) > 0.01 && (
                  <tr className="border-t border-[var(--border)]">
                    <td className="px-6 py-2.5 text-[var(--fg)] italic">Accumulated surplus/(deficit)</td>
                    <td className={`px-6 py-2.5 text-right font-mono ${surplus >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatKES(surplus)}</td>
                  </tr>
                )}
                <tr className="border-t border-[var(--border)] bg-purple-50">
                  <td className="px-6 py-3 font-semibold text-purple-800">Total Equity + Liabilities</td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-purple-700">{formatKES(totalLiabilities + totalEquity + surplus)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!isBalanced && (
            <div className="border-t border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
              ⚠ Balance sheet difference: {formatKES(Math.abs(totalAssets - (totalLiabilities + totalEquity)))} — check for unposted journal entries.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
