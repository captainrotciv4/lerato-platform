import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { approveTransaction, rejectTransaction } from "./actions";
import Link from "next/link";
import {
  Plus, ArrowDownCircle, ArrowUpCircle, Wallet, Receipt, Clock,
  ArrowLeftRight, Landmark, BookOpen, Lock, Upload,
} from "lucide-react";
import { formatDate, formatKES } from "@/lib/utils";

export const metadata = { title: "Finance — Lerato Platform" };

const TX_CONFIG: Record<string, { label: string; dot: string; amountClass: string; sign: string }> = {
  INCOME:   { label: "Income",   dot: "bg-emerald-500", amountClass: "text-emerald-700 font-semibold", sign: "+" },
  EXPENSE:  { label: "Expense",  dot: "bg-red-500",     amountClass: "text-red-700 font-semibold",     sign: "−" },
  TRANSFER: { label: "Transfer", dot: "bg-amber-400",   amountClass: "text-amber-700 font-semibold",   sign: "↔" },
};

const ACCOUNT_SUBTYPES: Record<string, string> = {
  CASH: "Cash", BANK: "Bank", MPESA: "M-PESA", RESTRICTED: "Restricted",
};

function fmt(n: number | string, currency = "KES") {
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (isNaN(num)) return `${currency} 0`;
  const neg = num < 0;
  return `${neg ? "−" : ""}${currency} ${Math.abs(num).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default async function FinancePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canApprove = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";

  const [txs, agg, pendingTxs, accounts] = await dbRetry(() => Promise.all([
    prisma.transaction.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        fromAccount: { select: { code: true, name: true } },
        toAccount:   { select: { code: true, name: true } },
      },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { organizationId: ctx.organization.id, approvalStatus: { in: ["POSTED", "APPROVED"] } },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { organizationId: ctx.organization.id, approvalStatus: "PENDING_APPROVAL" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.account.findMany({
      where: { organizationId: ctx.organization.id, active: true, type: "ASSET" },
      orderBy: { code: "asc" },
    }),
  ]));

  const income  = Number(agg.find(a => a.type === "INCOME")?._sum.amount  || 0);
  const expense = Number(agg.find(a => a.type === "EXPENSE")?._sum.amount || 0);
  const net     = income - expense;
  const burnPct = income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : 0;

  const totalLiquid = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const hasAccounts = accounts.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Finance</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Fund tracking and expenditure for {ctx.organization.shortName}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/${org}/finance/accounts` as any} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4" /> Accounts
          </Link>
          <Link href={`/${org}/finance/assets` as any} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Landmark className="h-4 w-4" /> Assets
          </Link>
          <Link href={`/${org}/finance/import` as any} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4" /> Bulk import
          </Link>
          <Link href={`/${org}/finance/new` as any} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> New transaction
          </Link>
        </div>
      </div>

      {/* Account balance cards */}
      {hasAccounts && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--fg-muted)]">
              <Landmark className="h-4 w-4" />
              Account balances
            </div>
            <Link href={`/${org}/finance/accounts` as any} className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">
              Manage →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {accounts.slice(0, 4).map((a) => (
              <div key={a.id} className={`rounded-xl border border-[var(--border)] p-4 ${a.isRestricted ? "bg-amber-50/60 border-amber-200" : "bg-[var(--bg-muted)]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--fg-muted)] truncate">{a.name}</span>
                  {a.isRestricted && <Lock className="h-3 w-3 text-amber-600 shrink-0" />}
                </div>
                <div className={`mt-2 font-display text-xl font-bold tabular-nums ${Number(a.balance) < 0 ? "text-red-700" : "text-[var(--fg)]"}`}>
                  {fmt(Number(a.balance), a.currency)}
                </div>
                <div className="mt-1 text-[10px] text-[var(--fg-muted)] font-mono">{a.code} · {ACCOUNT_SUBTYPES[a.subtype || ""] ?? a.subtype ?? "Account"}</div>
              </div>
            ))}
          </div>
          {accounts.length > 4 && (
            <div className="mt-2 text-xs text-[var(--fg-muted)] text-right">
              +{accounts.length - 4} more accounts ·{" "}
              <Link href={`/${org}/finance/accounts` as any} className="hover:text-[var(--fg)]">view all →</Link>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5">
            <span className="text-sm text-[var(--fg-muted)]">Total liquid assets</span>
            <span className={`font-display text-lg font-bold ${totalLiquid < 0 ? "text-red-700" : "text-[var(--fg)]"}`}>
              {fmt(totalLiquid)}
            </span>
          </div>
        </div>
      )}

      {/* Pending approval banner */}
      {canApprove && pendingTxs.length > 0 && (
        <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Clock className="h-4 w-4" />
            {pendingTxs.length} transaction{pendingTxs.length !== 1 && "s"} pending approval
          </div>
          <div className="space-y-2">
            {pendingTxs.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-lg bg-white px-4 py-2.5 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-medium text-[var(--fg)]">{t.description}</span>
                  <span className="mx-2 text-[var(--fg-muted)]">·</span>
                  <span className={t.type === "INCOME" ? "text-emerald-700" : t.type === "EXPENSE" ? "text-red-700" : "text-amber-700"}>
                    {TX_CONFIG[t.type]?.sign} {t.currency} {formatKES(Number(t.amount)).replace("KES ", "")}
                  </span>
                  <span className="ml-2 text-xs text-[var(--fg-muted)]">{formatDate(t.occurredAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <form action={async () => { "use server"; await approveTransaction(org, t.id); }}>
                    <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                      Approve
                    </button>
                  </form>
                  <form action={async () => { "use server"; await rejectTransaction(org, t.id); }}>
                    <button type="submit" className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPITile
          label="Funds Received"
          sub="Donations, grants &amp; income"
          value={fmt(income)}
          icon={ArrowDownCircle}
          colorClass="text-emerald-700"
          bgClass="bg-emerald-50"
          accent="border-l-emerald-500"
        />
        <KPITile
          label="Funds Disbursed"
          sub="Programme &amp; operational costs"
          value={fmt(expense)}
          icon={ArrowUpCircle}
          colorClass="text-red-700"
          bgClass="bg-red-50"
          accent="border-l-red-500"
        />
        <KPITile
          label={net >= 0 ? "Surplus" : "Deficit"}
          sub={net >= 0 ? "Retained / uncommitted" : "Overspent vs received"}
          value={fmt(Math.abs(net))}
          icon={Wallet}
          colorClass={net >= 0 ? "text-blue-700" : "text-red-700"}
          bgClass={net >= 0 ? "bg-blue-50" : "bg-red-50"}
          accent={net >= 0 ? "border-l-blue-500" : "border-l-red-500"}
        />
      </div>

      {/* Fund utilisation bar */}
      {income > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--fg)]">Fund utilisation</span>
            <span className={`font-semibold ${burnPct > 90 ? "text-red-700" : burnPct > 70 ? "text-amber-700" : "text-emerald-700"}`}>
              {burnPct}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${burnPct}%`,
                background: burnPct > 90 ? "#EF4444" : burnPct > 70 ? "#F59E0B" : "#10B981",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--fg-muted)]">
            <span>0%</span>
            <span className="text-amber-600">70% · caution</span>
            <span className="text-red-600">90% · critical</span>
            <span>100%</span>
          </div>
          <p className="text-xs text-[var(--fg-muted)]">
            A healthy NGO disburses 70–90% of funds to programmes. Below 70% suggests underspend; above 90% signals liquidity risk.
          </p>
        </div>
      )}

      {/* Transaction ledger */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[var(--fg-muted)]" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Transaction ledger
            </h2>
          </div>
          <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs text-[var(--fg-muted)]">
            {txs.length} entries
          </span>
        </div>

        {txs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-14 text-center">
            <Receipt className="h-10 w-10 text-[var(--fg-muted)] opacity-30" />
            <p className="text-sm text-[var(--fg-muted)]">No transactions recorded yet.</p>
            <Link href={`/${org}/finance/new` as any} className="btn-primary inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Record first entry
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)] text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Date</th>
                  <th className="px-5 py-3 text-left font-semibold">Type</th>
                  <th className="px-5 py-3 text-left font-semibold">Description</th>
                  <th className="px-5 py-3 text-left font-semibold hidden lg:table-cell">Account routing</th>
                  <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Category</th>
                  <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Reference</th>
                  <th className="px-5 py-3 text-center font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {txs.map((t) => {
                  const cfg = TX_CONFIG[t.type];
                  const isPending = t.approvalStatus === "PENDING_APPROVAL";
                  const isRejected = t.approvalStatus === "REJECTED";
                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors hover:bg-[var(--bg-muted)] ${
                        isPending ? "bg-amber-50/40" : isRejected ? "bg-red-50/30 opacity-60" : ""
                      }`}
                    >
                      <td className="px-5 py-3 text-[var(--fg-muted)] whitespace-nowrap">{formatDate(t.occurredAt)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className="text-xs font-medium text-[var(--fg)]">{cfg.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--fg)] max-w-xs">
                        <Link href={`/${org}/finance/${t.id}` as any} className="hover:text-[var(--brand-primary)] hover:underline">
                          <div className="truncate">{t.description}</div>
                        </Link>
                        {t.payee && (
                          <div className="text-xs text-[var(--fg-muted)] truncate">{t.payee}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        {t.type === "TRANSFER" && t.fromAccount && t.toAccount ? (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                            <span className="font-mono">{t.fromAccount.code}</span>
                            <ArrowLeftRight className="h-3 w-3" />
                            <span className="font-mono">{t.toAccount.code}</span>
                          </div>
                        ) : t.type === "INCOME" && t.toAccount ? (
                          <div className="flex items-center gap-1 text-xs text-emerald-700">
                            <ArrowDownCircle className="h-3 w-3" />
                            <span className="font-mono">{t.toAccount.code}</span>
                          </div>
                        ) : t.type === "EXPENSE" && t.fromAccount ? (
                          <div className="flex items-center gap-1 text-xs text-red-700">
                            <ArrowUpCircle className="h-3 w-3" />
                            <span className="font-mono">{t.fromAccount.code}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--fg-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {t.category ? (
                          <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
                            {t.category}
                          </span>
                        ) : (
                          <span className="text-[var(--fg-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--fg-muted)] hidden md:table-cell">
                        {t.reference || "—"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {isPending ? (
                          <span className="badge bg-amber-100 text-amber-900">Pending</span>
                        ) : isRejected ? (
                          <span className="badge bg-red-100 text-red-800">Rejected</span>
                        ) : (
                          <span className="badge bg-emerald-100 text-emerald-800">Posted</span>
                        )}
                      </td>
                      <td className={`px-5 py-3 text-right tabular-nums whitespace-nowrap font-mono ${
                        isPending || isRejected ? "text-[var(--fg-muted)]" : cfg.amountClass
                      }`}>
                        {cfg.sign} {t.currency} {formatKES(Number(t.amount)).replace("KES ", "")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KPITile({
  label, sub, value, icon: Icon, colorClass, bgClass, accent,
}: {
  label: string; sub: string; value: string; icon: any;
  colorClass: string; bgClass: string; accent: string;
}) {
  return (
    <div className={`card border-l-4 ${accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{label}</div>
          <div className={`mt-1.5 font-display text-2xl font-bold ${colorClass}`}>{value}</div>
          <div className="mt-1 text-xs text-[var(--fg-muted)]">{sub}</div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgClass}`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
      </div>
    </div>
  );
}
