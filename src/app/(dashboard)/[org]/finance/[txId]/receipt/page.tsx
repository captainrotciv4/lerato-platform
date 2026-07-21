import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { formatDate, formatKES } from "@/lib/utils";

export const metadata = { title: "Payment Receipt" };

const TYPE_LABEL: Record<string, string> = {
  INCOME:   "Receipt",
  EXPENSE:  "Payment Voucher",
  TRANSFER: "Transfer Advice",
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ org: string; txId: string }>;
}) {
  const { org, txId } = await params;
  const ctx = await requireTenant(org);

  const tx = await dbRetry(() =>
    prisma.transaction.findFirst({
      where: { id: txId, organizationId: ctx.organization.id },
      include: {
        fromAccount:  { select: { code: true, name: true } },
        toAccount:    { select: { code: true, name: true } },
      },
    })
  );
  if (!tx) notFound();

  const docTitle = TYPE_LABEL[tx.type] ?? "Transaction Record";
  const receiptNumber = `RCP-${tx.id.slice(-8).toUpperCase()}`;

  return (
    <>
      {/* Print/screen styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .receipt-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print mb-6 flex items-center gap-4">
        <button
          onClick={undefined}
          title="Use Ctrl+P to print"
          className="btn-primary text-sm"
          style={{ cursor: "pointer" }}
          suppressHydrationWarning
        >
          Print receipt
        </button>
        <a href={`/${org}/finance/${txId}` as any} className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
          ← Back to transaction
        </a>
      </div>

      {/* Receipt document */}
      <div
        className="receipt-page mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-white p-0 shadow-xl overflow-hidden"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {/* Branded header */}
        <div
          className="px-8 py-6 text-white"
          style={{ background: ctx.organization.primaryColor }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold tracking-tight">{ctx.organization.name}</div>
              {ctx.organization.shortName !== ctx.organization.name && (
                <div className="text-sm text-white/70 mt-0.5">{ctx.organization.shortName}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-bold uppercase tracking-widest">{docTitle}</div>
              <div className="text-sm font-mono mt-1 text-white/80">No. {receiptNumber}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          {/* Status banner */}
          {tx.approvalStatus === "POSTED" ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800">
              <span className="text-base">✓</span> This transaction has been posted and is final.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
              <span className="text-base">⏳</span> Status: {tx.approvalStatus.replace("_", " ")}
            </div>
          )}

          {/* Main details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-sans">Date</div>
              <div className="font-semibold mt-0.5">{formatDate(tx.occurredAt)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-sans">Reference</div>
              <div className="font-semibold mt-0.5 font-mono">{tx.reference ?? "—"}</div>
            </div>
            {tx.payee && (
              <div className="col-span-2">
                <div className="text-xs uppercase tracking-wider text-gray-400 font-sans">
                  {tx.type === "INCOME" ? "Received from" : "Paid to"}
                </div>
                <div className="font-semibold mt-0.5">{tx.payee}</div>
              </div>
            )}
            <div className="col-span-2">
              <div className="text-xs uppercase tracking-wider text-gray-400 font-sans">Description</div>
              <div className="font-semibold mt-0.5">{tx.description}</div>
            </div>
            {tx.category && (
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-sans">Category</div>
                <div className="mt-0.5">{tx.category}</div>
              </div>
            )}
            {tx.budgetLine && (
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-sans">Budget line</div>
                <div className="mt-0.5">{tx.budgetLine}</div>
              </div>
            )}
          </div>

          {/* Account routing */}
          {(tx.fromAccount || tx.toAccount) && (
            <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm font-sans">
              {tx.fromAccount && (
                <div className="flex justify-between">
                  <span className="text-gray-500">From account</span>
                  <span className="font-mono font-medium">{tx.fromAccount.code} — {tx.fromAccount.name}</span>
                </div>
              )}
              {tx.toAccount && (
                <div className="flex justify-between">
                  <span className="text-gray-500">To account</span>
                  <span className="font-mono font-medium">{tx.toAccount.code} — {tx.toAccount.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="rounded-xl border-2 border-[var(--border)] p-5 text-center font-sans"
            style={{ borderColor: ctx.organization.primaryColor + "40" }}>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Amount</div>
            <div
              className="text-4xl font-bold"
              style={{ color: ctx.organization.primaryColor }}
            >
              {formatKES(Number(tx.amount))}
            </div>
            <div className="text-sm text-gray-400 mt-1">{tx.currency}</div>
          </div>

          {/* Reconciliation status */}
          {tx.reconciledAt && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-sans">
              <span>✓</span> Reconciled on {formatDate(tx.reconciledAt)}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-100 font-sans">
            <div>
              <div className="h-10 border-b border-gray-300" />
              <div className="text-xs text-gray-400 mt-1.5">Prepared by</div>
              <div className="h-5" />
            </div>
            <div>
              <div className="h-10 border-b border-gray-300" />
              <div className="text-xs text-gray-400 mt-1.5">Authorized by</div>
              <div className="h-5" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-8 py-3 bg-gray-50 text-center text-[10px] text-gray-400 font-sans">
          Generated by Lerato Platform · {receiptNumber} · {new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    </>
  );
}
