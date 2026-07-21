import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { createBudget, toggleBudgetActive } from "./actions";
import { formatKES } from "@/lib/utils";
import { Plus, TrendingDown } from "lucide-react";

export const metadata = { title: "Budgets — Finance" };

function pct(spent: number, total: number) {
  if (total === 0) return 0;
  return Math.min(100, Math.round((spent / total) * 100));
}

function BarColor(p: number) {
  if (p >= 95) return "#EF4444";
  if (p >= 80) return "#F59E0B";
  return "#10B981";
}

export default async function BudgetPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canManage = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";

  const currentYear = new Date().getFullYear();

  const [budgets, expenseTxs, expenseAccounts] = await dbRetry(() =>
    Promise.all([
      prisma.budget.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: [{ fiscalYear: "desc" }, { category: "asc" }, { name: "asc" }],
        include: { account: { select: { code: true, name: true } } },
      }),
      // All posted expense transactions with a budgetLine set
      prisma.transaction.findMany({
        where: {
          organizationId: ctx.organization.id,
          type: "EXPENSE",
          approvalStatus: "POSTED",
          budgetLine: { not: null },
        },
        select: { budgetLine: true, amount: true, category: true },
      }),
      prisma.account.findMany({
        where: { organizationId: ctx.organization.id, type: { in: ["EXPENSE", "INCOME"] }, active: true },
        orderBy: [{ type: "asc" }, { code: "asc" }],
        select: { id: true, code: true, name: true, type: true },
      }),
    ])
  );

  // Compute spent per budgetLine code (matched against Budget.code)
  const spentByCode: Record<string, number> = {};
  for (const tx of expenseTxs) {
    if (!tx.budgetLine) continue;
    spentByCode[tx.budgetLine] = (spentByCode[tx.budgetLine] ?? 0) + Number(tx.amount);
  }
  // Also aggregate by category for budgets without a code
  const spentByCategory: Record<string, number> = {};
  for (const tx of expenseTxs) {
    if (!tx.category) continue;
    spentByCategory[tx.category] = (spentByCategory[tx.category] ?? 0) + Number(tx.amount);
  }

  const rows = budgets.map((b) => {
    const spent = b.code
      ? (spentByCode[b.code] ?? 0)
      : (spentByCategory[b.category ?? ""] ?? 0);
    const allocated = Number(b.allocatedAmount);
    const remaining = allocated - spent;
    const p = pct(spent, allocated);
    return { b, spent, allocated, remaining, p };
  });

  const totalAllocated = rows.filter((r) => r.b.active && r.b.fiscalYear === currentYear)
    .reduce((s, r) => s + r.allocated, 0);
  const totalSpent = rows.filter((r) => r.b.active && r.b.fiscalYear === currentYear)
    .reduce((s, r) => s + r.spent, 0);

  const years = [...new Set(budgets.map((b) => b.fiscalYear))].sort((a, b) => b - a);
  const categories = [...new Set(budgets.map((b) => b.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Budgets</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {ctx.organization.shortName} · FY{currentYear} · {formatKES(totalSpent)} spent of {formatKES(totalAllocated)} allocated
          </p>
        </div>
        {canManage && (
          <details className="relative">
            <summary className="btn-primary cursor-pointer list-none inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> New budget line
            </summary>
            <div className="fixed right-6 z-50 w-96 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-xl space-y-3 max-h-[80vh] overflow-y-auto">
              <h3 className="font-semibold text-[var(--fg)]">Create budget line</h3>
              <form
                action={async (fd) => { "use server"; await createBudget(org, fd); }}
                className="space-y-3"
              >
                <div>
                  <label className="text-xs">Name *</label>
                  <input name="name" required placeholder="e.g. Staff Travel FY2026" className="mt-1 w-full text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Budget code</label>
                    <input name="code" placeholder="5020-TRAVEL" className="mt-1 w-full text-sm font-mono" />
                    <p className="mt-0.5 text-[10px] text-[var(--fg-muted)]">Match Transaction budgetLine</p>
                  </div>
                  <div>
                    <label className="text-xs">Category</label>
                    <input name="category" placeholder="Programme / Operations" className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Fiscal year *</label>
                    <input name="fiscalYear" type="number" required defaultValue={currentYear} className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Amount (KES) *</label>
                    <input name="allocatedAmount" type="number" step="0.01" required placeholder="0.00" className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Start date *</label>
                    <input name="startDate" type="date" required
                      defaultValue={`${currentYear}-01-01`} className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">End date *</label>
                    <input name="endDate" type="date" required
                      defaultValue={`${currentYear}-12-31`} className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs">Linked account (optional)</label>
                  <select name="accountId" className="mt-1 w-full text-sm">
                    <option value="">— none —</option>
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs">Notes</label>
                  <textarea name="description" rows={2} className="mt-1 w-full text-sm" />
                </div>
                <button type="submit" className="btn-primary w-full text-sm">Create budget line</button>
              </form>
            </div>
          </details>
        )}
      </div>

      {/* FY summary bar */}
      {totalAllocated > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--fg)]">FY{currentYear} overall utilisation</span>
            <span className="font-semibold" style={{ color: BarColor(pct(totalSpent, totalAllocated)) }}>
              {pct(totalSpent, totalAllocated)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct(totalSpent, totalAllocated)}%`, background: BarColor(pct(totalSpent, totalAllocated)) }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-xs text-[var(--fg-muted)]">Allocated</div><div className="font-semibold">{formatKES(totalAllocated)}</div></div>
            <div><div className="text-xs text-[var(--fg-muted)]">Spent</div><div className="font-semibold text-red-700">{formatKES(totalSpent)}</div></div>
            <div><div className="text-xs text-[var(--fg-muted)]">Remaining</div><div className="font-semibold text-emerald-700">{formatKES(totalAllocated - totalSpent)}</div></div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <TrendingDown className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-30" />
          <p className="text-sm text-[var(--fg-muted)]">No budget lines yet.</p>
          {canManage && <p className="text-xs text-[var(--fg-muted)]">Use "New budget line" to create one.</p>}
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Name</th>
                <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Code</th>
                <th className="px-5 py-3 text-left font-semibold hidden lg:table-cell">Category</th>
                <th className="px-5 py-3 text-right font-semibold">Allocated</th>
                <th className="px-5 py-3 text-right font-semibold">Spent</th>
                <th className="px-5 py-3 text-right font-semibold hidden sm:table-cell">Remaining</th>
                <th className="px-5 py-3 text-left font-semibold w-36">Utilisation</th>
                <th className="px-5 py-3 text-center font-semibold hidden md:table-cell">FY</th>
                <th className="px-5 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map(({ b, spent, allocated, remaining, p }) => (
                <tr key={b.id} className={`hover:bg-[var(--bg-muted)] transition-colors ${!b.active ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-[var(--fg)]">{b.name}</div>
                    {b.account && (
                      <div className="text-[10px] text-[var(--fg-muted)] font-mono">{b.account.code} {b.account.name}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[var(--fg-muted)] hidden md:table-cell">
                    {b.code || "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--fg-muted)] hidden lg:table-cell">
                    {b.category || "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-[var(--fg)]">
                    {formatKES(allocated)}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono tabular-nums font-semibold ${p >= 95 ? "text-red-700" : p >= 80 ? "text-amber-700" : "text-[var(--fg)]"}`}>
                    {formatKES(spent)}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono tabular-nums hidden sm:table-cell ${remaining < 0 ? "text-red-700 font-bold" : "text-emerald-700"}`}>
                    {remaining < 0 ? `(${formatKES(Math.abs(remaining))})` : formatKES(remaining)}
                  </td>
                  <td className="px-5 py-3 w-36">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: BarColor(p) }} />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums w-7 text-right" style={{ color: BarColor(p) }}>
                        {p}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center text-xs text-[var(--fg-muted)] hidden md:table-cell">
                    {b.fiscalYear}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {canManage ? (
                      <form action={async () => { "use server"; await toggleBudgetActive(org, b.id, !b.active); }}>
                        <button type="submit" className={`badge cursor-pointer hover:brightness-95 ${b.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                          {b.active ? "Active" : "Inactive"}
                        </button>
                      </form>
                    ) : (
                      <span className={`badge ${b.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                        {b.active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
