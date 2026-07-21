"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight, TrendingUp, TrendingDown, ArrowLeftRight,
  ChevronRight, ChevronLeft, Wallet, CheckCircle2,
} from "lucide-react";

type Account = {
  id: string; code: string; name: string; type: string;
  subtype: string | null; balance: string | number; currency: string;
  isRestricted: boolean; restrictionNote: string | null;
};
type Program = { id: string; name: string; type: string };

type Props = {
  accounts: Account[];
  programs: Program[];
  action: (formData: FormData) => Promise<void>;
  orgSlug: string;
  today: string;
};

const TYPES = [
  {
    value: "INCOME" as const,
    label: "Income",
    sub: "Funds received",
    icon: TrendingUp,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    activeBg: "bg-emerald-600 border-emerald-600 text-white",
  },
  {
    value: "EXPENSE" as const,
    label: "Expense",
    sub: "Money spent",
    icon: TrendingDown,
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    activeBg: "bg-red-600 border-red-600 text-white",
  },
  {
    value: "TRANSFER" as const,
    label: "Transfer",
    sub: "Between accounts",
    icon: ArrowLeftRight,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    activeBg: "bg-amber-500 border-amber-500 text-white",
  },
] as const;

const INCOME_CATEGORIES = [
  "Donations — General", "Grants — Government", "Grants — International",
  "Programme Fees", "Event Income", "Gift in Kind", "Investment Income", "Other",
];
const EXPENSE_CATEGORIES = [
  "Salaries & Benefits", "Programme Costs", "Travel & Transport",
  "Equipment & Supplies", "Communications", "Rent & Utilities",
  "Professional Services", "Training & Capacity Building",
  "Monitoring & Evaluation", "Contingency", "Other",
];
const CURRENCIES = ["KES", "USD", "EUR", "GBP"];

function fmt(n: string | number, currency = "KES") {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AccountSelect({
  label, value, onChange, accounts, emptyLabel = "Select account…", required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  accounts: Account[]; emptyLabel?: string; required?: boolean;
}) {
  const selected = accounts.find((a) => a.id === value);
  return (
    <div className="flex-1 min-w-0">
      <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full"
      >
        <option value="">{emptyLabel}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} · {a.name}
          </option>
        ))}
      </select>
      {selected && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
          <Wallet className="h-3 w-3" />
          <span>Balance: <strong>{fmt(selected.balance, selected.currency)}</strong></span>
          {selected.isRestricted && (
            <span className="badge bg-amber-100 text-amber-800 text-[10px]">Restricted</span>
          )}
        </div>
      )}
    </div>
  );
}

export function TransactionForm({ accounts, programs, action, orgSlug, today }: Props) {
  const [txType, setTxType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">("EXPENSE");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [category, setCategory] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const assetAccounts = accounts.filter((a) => a.type === "ASSET");

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const amountNum = parseFloat(amount) || 0;

  // Double-entry preview
  const debitLabel = txType === "INCOME"
    ? (toAccount?.name || "Asset account")
    : txType === "EXPENSE"
    ? (category || "Expense account")
    : (toAccount?.name || "Destination account");

  const creditLabel = txType === "INCOME"
    ? (category || "Income account")
    : txType === "EXPENSE"
    ? (fromAccount?.name || "Asset account")
    : (fromAccount?.name || "Source account");

  const categories = txType === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/${orgSlug}/finance` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ChevronLeft className="h-4 w-4" /> Back to finance
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">New transaction</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Record income, expense, or move funds between accounts.</p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-3 gap-3">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = txType === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => { setTxType(t.value); setFromAccountId(""); setToAccountId(""); setCategory(""); }}
              className={`rounded-xl border-2 p-4 text-left transition-all focus:outline-none ${
                active ? t.activeBg : `${t.bg} hover:brightness-95`
              }`}
            >
              <Icon className={`h-5 w-5 mb-2 ${active ? "text-white" : t.color}`} />
              <div className={`font-semibold text-sm ${active ? "text-white" : "text-[var(--fg)]"}`}>{t.label}</div>
              <div className={`text-xs mt-0.5 ${active ? "text-white/80" : "text-[var(--fg-muted)]"}`}>{t.sub}</div>
            </button>
          );
        })}
      </div>

      <form ref={formRef} action={action} className="space-y-5">
        {/* Hidden state inputs */}
        <input type="hidden" name="type" value={txType} />
        <input type="hidden" name="fromAccountId" value={fromAccountId} />
        <input type="hidden" name="toAccountId" value={toAccountId} />

        {/* Account routing — differs by type */}
        <div className="card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            {txType === "TRANSFER" ? "Transfer route" : txType === "INCOME" ? "Receiving account" : "Paying account"}
          </h2>

          {txType === "TRANSFER" && (
            <div className="flex items-end gap-3">
              <AccountSelect
                label="From"
                value={fromAccountId}
                onChange={setFromAccountId}
                accounts={assetAccounts}
                emptyLabel="Source account…"
              />
              <div className="flex flex-col items-center pb-7 shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg-muted)]">
                  <ArrowRight className="h-4 w-4 text-[var(--fg-muted)]" />
                </div>
              </div>
              <AccountSelect
                label="To"
                value={toAccountId}
                onChange={setToAccountId}
                accounts={assetAccounts.filter((a) => a.id !== fromAccountId)}
                emptyLabel="Destination account…"
              />
            </div>
          )}

          {txType === "INCOME" && (
            <AccountSelect
              label="Received into"
              value={toAccountId}
              onChange={setToAccountId}
              accounts={assetAccounts}
              emptyLabel="Select receiving account…"
            />
          )}

          {txType === "EXPENSE" && (
            <AccountSelect
              label="Paid from"
              value={fromAccountId}
              onChange={setFromAccountId}
              accounts={assetAccounts}
              emptyLabel="Select payment account…"
            />
          )}

          {/* Extra context by type */}
          {txType === "INCOME" && (
            <div>
              <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Source / Donor</label>
              <input name="payee" placeholder="e.g. Grace Foundation, M-PESA donation, ticket sales…" className="mt-1 w-full" />
            </div>
          )}

          {txType === "EXPENSE" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Payee</label>
                <input name="payee" placeholder="Who was paid?" className="mt-1 w-full" />
              </div>
              {programs.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Programme</label>
                  <select name="programId" className="mt-1 w-full">
                    <option value="">None / General</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {txType !== "TRANSFER" && (
            <div>
              <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Category</label>
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full"
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Amount & details */}
        <div className="card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Amount & details</h2>

          <div className="flex gap-3">
            <div className="w-24 shrink-0">
              <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Currency</label>
              <select
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Amount *</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full text-lg font-mono"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Date *</label>
              <input name="occurredAt" type="date" required defaultValue={today} className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Reference</label>
              <input name="reference" placeholder="M-PESA code, cheque #, invoice…" className="mt-1 w-full" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Description *</label>
            <textarea name="description" rows={2} required placeholder={
              txType === "INCOME" ? "e.g. Monthly donation from Grace Foundation for education programme"
              : txType === "EXPENSE" ? "e.g. Transport to Kiserian for coaching session"
              : "e.g. Monthly sweep from M-PESA float to Equity current account"
            } className="mt-1 w-full" />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">Budget line</label>
            <input name="budgetLine" placeholder="e.g. 5020-TRAVEL, 4010-DONATIONS" className="mt-1 w-full font-mono text-sm" />
          </div>
        </div>

        {/* Double-entry preview */}
        {amountNum > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)] mb-3">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Double-entry preview
            </div>
            <div className="grid grid-cols-[80px_1fr_auto] gap-x-3 gap-y-2 text-sm font-mono">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-center text-xs font-semibold text-blue-800 self-center">DEBIT</span>
              <span className="text-[var(--fg)] truncate self-center">{debitLabel}</span>
              <span className="text-[var(--fg)] font-medium self-center text-right">{fmt(amountNum, currency)}</span>

              <span className="rounded bg-emerald-100 px-2 py-0.5 text-center text-xs font-semibold text-emerald-800 self-center">CREDIT</span>
              <span className="text-[var(--fg)] truncate self-center">{creditLabel}</span>
              <span className="text-[var(--fg)] font-medium self-center text-right">{fmt(amountNum, currency)}</span>
            </div>
            <div className="border-t border-[var(--border)] pt-2 text-xs text-[var(--fg-muted)]">
              Debits = Credits · {currency} {fmt(amountNum, currency)}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${orgSlug}/finance` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary inline-flex items-center gap-2">
            Record transaction <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
