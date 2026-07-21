import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  Calendar, Tag, Hash, User, Landmark, FileText, Printer,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { approveTransaction, rejectTransaction } from "../actions";

export const metadata = { title: "Transaction — Lerato Platform" };

function fmt(n: number | string, currency = "KES") {
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (isNaN(num)) return `${currency} 0.00`;
  const neg = num < 0;
  return `${neg ? "−" : ""}${currency} ${Math.abs(num).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

const TX_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string; sign: string }> = {
  INCOME:   { label: "Income",   icon: ArrowDownCircle,  color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", sign: "+" },
  EXPENSE:  { label: "Expense",  icon: ArrowUpCircle,    color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     sign: "−" },
  TRANSFER: { label: "Transfer", icon: ArrowLeftRight,   color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   sign: "↔" },
};

const STATUS_STYLE: Record<string, string> = {
  POSTED:           "bg-emerald-100 text-emerald-800",
  PENDING_APPROVAL: "bg-amber-100 text-amber-900",
  REJECTED:         "bg-red-100 text-red-800",
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ org: string; txId: string }>;
}) {
  const { org, txId } = await params;
  const ctx = await requireTenant(org);
  const canApprove = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";

  const tx = await dbRetry(() =>
    prisma.transaction.findFirst({
      where: { id: txId, organizationId: ctx.organization.id },
      include: {
        fromAccount: true,
        toAccount: true,
        journalEntry: {
          include: {
            lines: {
              include: { account: { select: { code: true, name: true, type: true } } },
              orderBy: { debit: "desc" },
            },
          },
        },
      },
    })
  );

  if (!tx) notFound();

  const m = TX_META[tx.type];
  const Icon = m.icon;
  const isPending = tx.approvalStatus === "PENDING_APPROVAL";
  const isRejected = tx.approvalStatus === "REJECTED";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/${org}/finance` as any}
          className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to finance
        </Link>
        {tx.approvalStatus === "POSTED" && (
          <Link
            href={`/${org}/finance/${txId}/receipt` as any}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <Printer className="h-4 w-4" /> Print receipt
          </Link>
        )}
      </div>

      {/* Header */}
      <div className={`rounded-2xl border p-6 ${m.bg} ${m.border}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${m.border} bg-white/70`}>
              <Icon className={`h-7 w-7 ${m.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`badge ${m.bg} ${m.color} border ${m.border} text-xs font-semibold`}>{m.label}</span>
                <span className={`badge ${STATUS_STYLE[tx.approvalStatus]}`}>
                  {tx.approvalStatus === "POSTED" ? "Posted" : tx.approvalStatus === "PENDING_APPROVAL" ? "Pending approval" : "Rejected"}
                </span>
              </div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--fg)]">{tx.description}</div>
              {tx.payee && <div className="mt-0.5 text-sm text-[var(--fg-muted)]">Payee: {tx.payee}</div>}
            </div>
          </div>
          <div className={`text-right font-display text-3xl font-bold tabular-nums ${m.color}`}>
            {m.sign} {fmt(Number(tx.amount), tx.currency)}
          </div>
        </div>

        {/* Approve/Reject actions */}
        {canApprove && isPending && (
          <div className="mt-5 flex items-center gap-3 border-t border-amber-200 pt-4">
            <span className="text-sm font-medium text-amber-900">Awaiting your approval</span>
            <form action={async () => { "use server"; await approveTransaction(org, tx.id); }}>
              <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Approve & Post
              </button>
            </form>
            <form action={async () => { "use server"; await rejectTransaction(org, tx.id); }}>
              <button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                Reject
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transaction details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Account routing */}
          {(tx.fromAccount || tx.toAccount) && (
            <div className="card space-y-4">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                <Landmark className="h-4 w-4" /> Account routing
              </h2>
              <div className="flex items-center gap-4">
                {tx.type === "TRANSFER" ? (
                  <>
                    <AccountCard account={tx.fromAccount} label="From" side="debit" />
                    <ArrowLeftRight className="h-5 w-5 shrink-0 text-amber-500" />
                    <AccountCard account={tx.toAccount} label="To" side="credit" />
                  </>
                ) : tx.type === "INCOME" ? (
                  <>
                    <div className="flex-1 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4 text-center text-sm text-emerald-700">
                      External source
                    </div>
                    <ArrowDownCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                    <AccountCard account={tx.toAccount} label="Received into" side="credit" />
                  </>
                ) : (
                  <>
                    <AccountCard account={tx.fromAccount} label="Paid from" side="debit" />
                    <ArrowUpCircle className="h-5 w-5 shrink-0 text-red-500" />
                    <div className="flex-1 rounded-xl border border-dashed border-red-200 bg-red-50/50 p-4 text-center text-sm text-red-700">
                      {tx.payee ?? "External recipient"}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Journal entry */}
          {tx.journalEntry ? (
            <div className="card !p-0 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4">
                <FileText className="h-4 w-4 text-[var(--fg-muted)]" />
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  Journal Entry
                </h2>
                <span className="ml-auto font-mono text-xs text-[var(--fg-muted)]">{tx.journalEntry.entryNumber}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-muted)] text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-semibold">Account</th>
                    <th className="px-5 py-2.5 text-right font-semibold text-emerald-700">Debit</th>
                    <th className="px-5 py-2.5 text-right font-semibold text-red-700">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {tx.journalEntry.lines.map((line, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-5 py-3">
                        {line.account ? (
                          <div>
                            <span className="font-mono text-xs text-[var(--fg-muted)] mr-2">{line.account.code}</span>
                            <span className="text-[var(--fg)]">{line.account.name}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--fg-muted)] italic">{line.description ?? "—"}</span>
                        )}
                        {line.description && line.account && (
                          <div className="text-xs text-[var(--fg-muted)] mt-0.5">{line.description}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {Number(line.debit) > 0 ? (
                          <span className="text-emerald-700 font-semibold">{fmt(Number(line.debit), tx.currency)}</span>
                        ) : <span className="text-[var(--fg-muted)]">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {Number(line.credit) > 0 ? (
                          <span className="text-red-700 font-semibold">{fmt(Number(line.credit), tx.currency)}</span>
                        ) : <span className="text-[var(--fg-muted)]">—</span>}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-muted)] font-semibold">
                    <td className="px-5 py-3 text-xs uppercase tracking-wide text-[var(--fg-muted)]">Total</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-700">
                      {fmt(tx.journalEntry.lines.reduce((s, l) => s + Number(l.debit), 0), tx.currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-red-700">
                      {fmt(tx.journalEntry.lines.reduce((s, l) => s + Number(l.credit), 0), tx.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card border border-dashed border-[var(--border)] bg-[var(--bg-muted)] text-center py-8">
              <FileText className="mx-auto h-8 w-8 text-[var(--fg-muted)] opacity-30" />
              <p className="mt-2 text-sm text-[var(--fg-muted)]">
                {isPending ? "Journal entry will be created when approved." : "No journal entry recorded."}
              </p>
            </div>
          )}
        </div>

        {/* Metadata panel */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Details</h2>
            <DetailRow icon={Calendar} label="Date" value={formatDate(tx.occurredAt)} />
            <DetailRow icon={Hash} label="Reference" value={tx.reference ?? "—"} />
            <DetailRow icon={Tag} label="Category" value={tx.category ?? "—"} />
            <DetailRow icon={Tag} label="Budget line" value={tx.budgetLine ?? "—"} />
            <DetailRow icon={User} label="Recorded by" value={tx.createdById ? "System user" : "—"} />
            {tx.tags && tx.tags.length > 0 && (
              <div className="flex items-start gap-3">
                <Tag className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
                <div className="flex flex-wrap gap-1">
                  {tx.tags.map((t) => (
                    <span key={t} className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Transaction ID</div>
            <div className="font-mono text-xs break-all text-[var(--fg-muted)]">{tx.id}</div>
            <div className="text-xs text-[var(--fg-muted)]">Created {formatDate(tx.createdAt)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountCard({
  account,
  label,
  side,
}: {
  account: { code: string; name: string; type: string; subtype?: string | null } | null;
  label: string;
  side: "debit" | "credit";
}) {
  if (!account) return <div className="flex-1 rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--fg-muted)]">Not assigned</div>;
  return (
    <div className={`flex-1 rounded-xl border p-4 ${side === "debit" ? "border-red-200 bg-red-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{label}</div>
      <div className="mt-1 font-mono text-xs text-[var(--fg-muted)]">{account.code}</div>
      <div className="font-semibold text-sm text-[var(--fg)]">{account.name}</div>
      {account.subtype && <div className="text-[10px] text-[var(--fg-muted)]">{account.subtype}</div>}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{label}</div>
        <div className="text-sm text-[var(--fg)]">{value}</div>
      </div>
    </div>
  );
}
