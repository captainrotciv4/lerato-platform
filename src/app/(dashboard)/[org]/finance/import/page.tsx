import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import Link from "next/link";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { bulkImportTransactions } from "../actions";

export const metadata = { title: "Bulk Import — Finance" };

const TEMPLATE = `date,type,description,amount,category,reference
2026-01-15,INCOME,Donor grant — ABC Foundation,500000,DONATION,REC-2026-001
2026-01-20,EXPENSE,Office rent — January,45000,ADMIN,EXP-2026-001
2026-02-01,INCOME,Programme fee — Cohort 3,120000,PROGRAMME,REC-2026-002
2026-02-05,EXPENSE,Transport — field visit,8500,PROGRAMME,EXP-2026-002
2026-02-10,TRANSFER,Inter-account transfer,200000,,TRF-2026-001`;

export default async function BulkImportPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  if (!can(ctx.role, ctx.permissions, PERMISSIONS.FINANCE_WRITE)) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-[var(--fg-muted)]">You don't have permission to import transactions.</p>
      </div>
    );
  }

  const action = bulkImportTransactions.bind(null, org);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/${org}/finance` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to finance
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Bulk import transactions</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Paste CSV data to import many transactions at once. All imported transactions start as
          <strong className="text-[var(--fg)]"> Pending Approval</strong> — review and post them on the finance page.
        </p>
      </div>

      {/* Format guide */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--fg-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--fg)]">CSV format</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          {[
            ["date", "YYYY-MM-DD", "2026-01-15"],
            ["type", "INCOME / EXPENSE / TRANSFER", "INCOME"],
            ["description", "Transaction description", "Donor grant"],
            ["amount", "Numeric (KES)", "500000"],
            ["category", "Optional", "DONATION"],
            ["reference", "Optional — your ref no.", "REC-001"],
          ].map(([col, desc, ex]) => (
            <div key={col} className="rounded-lg bg-[var(--bg-muted)] p-2">
              <div className="font-mono font-semibold text-[var(--fg)]">{col}</div>
              <div className="text-[var(--fg-muted)]">{desc}</div>
              <div className="mt-0.5 font-mono text-[var(--brand-primary)]">e.g. {ex}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Import form */}
      <form action={action} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--fg)]">
            Paste CSV data *
          </label>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
            Include a header row (date,type,description,amount,category,reference) or omit it — both work.
          </p>
          <textarea
            name="csv"
            required
            rows={12}
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-xs text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            placeholder={TEMPLATE}
            defaultValue=""
          />
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Note:</strong> Imported transactions are created as <em>Pending Approval</em>.
          Open each one on the Finance page to review and post. Balances update only when a transaction is approved.
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/finance` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary inline-flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import transactions
          </button>
        </div>
      </form>
    </div>
  );
}
