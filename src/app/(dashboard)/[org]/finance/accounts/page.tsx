import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, Lock, TrendingUp, TrendingDown, Scale, Banknote, CreditCard } from "lucide-react";
import { createAccount, toggleAccountActive } from "../actions";

export const metadata = { title: "Chart of Accounts — Lerato Platform" };

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; range: string }> = {
  ASSET:     { label: "Assets",      color: "text-emerald-700", bg: "bg-emerald-50",  icon: Banknote,    range: "1000–1999" },
  LIABILITY: { label: "Liabilities", color: "text-red-700",    bg: "bg-red-50",      icon: CreditCard,  range: "2000–2999" },
  EQUITY:    { label: "Equity / Net Assets", color: "text-blue-700", bg: "bg-blue-50", icon: Scale,     range: "3000–3999" },
  INCOME:    { label: "Income",      color: "text-teal-700",   bg: "bg-teal-50",     icon: TrendingUp,  range: "4000–4999" },
  EXPENSE:   { label: "Expenses",    color: "text-orange-700", bg: "bg-orange-50",   icon: TrendingDown, range: "5000–5999" },
};

function fmt(n: number | string, currency = "KES") {
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (isNaN(num)) return `${currency} 0.00`;
  const sign = num < 0 ? "−" : "";
  return `${sign}${currency} ${Math.abs(num).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default async function AccountsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canManage = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";

  const accounts = await dbRetry(() =>
    prisma.account.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: [{ type: "asc" }, { code: "asc" }],
      include: { _count: { select: { outgoingTx: true, incomingTx: true } } },
    })
  );

  const byType = (["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const).map((type) => ({
    type,
    accounts: accounts.filter((a) => a.type === type),
    total: accounts
      .filter((a) => a.type === type && a.active)
      .reduce((s, a) => s + Number(a.balance), 0),
  }));

  const accountTypes = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

  return (
    <div className="space-y-6">
      <Link href={`/${org}/finance` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to finance
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {accounts.length} accounts · double-entry ledger foundation
          </p>
        </div>
        {canManage && (
          <details className="relative">
            <summary className="btn-primary cursor-pointer list-none inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> New account
            </summary>
            <div className="absolute right-0 top-11 z-20 w-96 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-xl space-y-3">
              <h3 className="font-semibold text-[var(--fg)]">Create account</h3>
              <form action={async (fd) => { "use server"; await createAccount(org, fd); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Code *</label>
                    <input name="code" required placeholder="e.g. 1050" className="mt-1 w-full text-sm font-mono" />
                  </div>
                  <div>
                    <label className="text-xs">Type *</label>
                    <select name="type" required className="mt-1 w-full text-sm">
                      {accountTypes.map((t) => (
                        <option key={t} value={t}>{TYPE_META[t].label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs">Account name *</label>
                  <input name="name" required placeholder="e.g. KCB Savings Account" className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">Subtype</label>
                  <input name="subtype" placeholder="BANK · CASH · MPESA · RESTRICTED" className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">Description</label>
                  <textarea name="description" rows={2} className="mt-1 w-full text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isRestricted" name="isRestricted" value="true" className="!w-auto" />
                  <label htmlFor="isRestricted" className="text-xs">Donor-restricted fund</label>
                </div>
                <div>
                  <label className="text-xs">Restriction note</label>
                  <input name="restrictionNote" placeholder="e.g. WC2026 Travel only" className="mt-1 w-full text-sm" />
                </div>
                <button type="submit" className="btn-primary w-full text-sm">Create account</button>
              </form>
            </div>
          </details>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {byType.map(({ type, total, accounts: grp }) => {
          const m = TYPE_META[type];
          const Icon = m.icon;
          return (
            <div key={type} className={`rounded-xl border border-[var(--border)] p-4 ${m.bg}`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${m.color}`} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${m.color}`}>{m.label}</span>
              </div>
              <div className={`mt-2 text-lg font-bold font-mono ${m.color}`}>{fmt(total)}</div>
              <div className="mt-0.5 text-xs text-[var(--fg-muted)]">{grp.filter((a) => a.active).length} active · {m.range}</div>
            </div>
          );
        })}
      </div>

      {/* Account groups */}
      {byType.map(({ type, accounts: grp }) => {
        if (grp.length === 0) return null;
        const m = TYPE_META[type];
        const Icon = m.icon;
        return (
          <div key={type} className="card !p-0 overflow-hidden">
            <div className={`flex items-center gap-3 border-b border-[var(--border)] px-5 py-4 ${m.bg}`}>
              <Icon className={`h-5 w-5 ${m.color}`} />
              <div>
                <h2 className={`font-display font-semibold ${m.color}`}>{m.label}</h2>
                <p className="text-xs text-[var(--fg-muted)]">Codes {m.range}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-medium w-20">Code</th>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium hidden sm:table-cell">Subtype</th>
                  <th className="px-5 py-3 text-right font-medium">Balance</th>
                  <th className="px-5 py-3 text-center font-medium hidden md:table-cell">Txns</th>
                  <th className="px-5 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {grp.map((a) => {
                  const txCount = a._count.outgoingTx + a._count.incomingTx;
                  return (
                    <tr
                      key={a.id}
                      className={`border-t border-[var(--border)] ${!a.active ? "opacity-50" : "hover:bg-[var(--bg-muted)]"}`}
                    >
                      <td className="px-5 py-3 font-mono text-xs text-[var(--fg-muted)]">{a.code}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/${org}/finance/accounts/${a.id}` as any}
                            className={`font-medium hover:text-[var(--brand-primary)] hover:underline ${a.active ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}
                          >
                            {a.name}
                          </Link>
                          {a.isSystem && <span className="badge bg-gray-100 text-gray-600 text-[10px]">system</span>}
                          {a.isRestricted && (
                            <span className="badge bg-amber-100 text-amber-700 inline-flex items-center gap-1 text-[10px]">
                              <Lock className="h-2.5 w-2.5" /> restricted
                            </span>
                          )}
                          <Link
                            href={`/${org}/finance/accounts/${a.id}` as any}
                            className="ml-auto text-[10px] text-[var(--fg-muted)] hover:text-[var(--brand-primary)] font-mono"
                          >
                            Ledger →
                          </Link>
                        </div>
                        {a.description && <div className="text-xs text-[var(--fg-muted)] mt-0.5 truncate max-w-xs">{a.description}</div>}
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--fg-muted)] hidden sm:table-cell">{a.subtype || "—"}</td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-[var(--fg)]">
                        {fmt(Number(a.balance), a.currency)}
                      </td>
                      <td className="px-5 py-3 text-center text-xs text-[var(--fg-muted)] hidden md:table-cell">{txCount}</td>
                      <td className="px-5 py-3 text-center">
                        {canManage && !a.isSystem ? (
                          <form action={async () => {
                            "use server";
                            await toggleAccountActive(org, a.id, !a.active);
                          }}>
                            <button type="submit" className={`badge cursor-pointer hover:brightness-95 ${
                              a.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                            }`}>
                              {a.active ? "Active" : "Inactive"}
                            </button>
                          </form>
                        ) : (
                          <span className={`badge ${a.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                            {a.active ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
