"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowRight } from "lucide-react";

interface LineItem { description: string; qty: number; unitPrice: number; amount: number }
interface Vendor { id: string; name: string; category: string }
interface Account { id: string; code: string; name: string }

export default function PurchaseOrderForm({
  vendors,
  accounts,
  action,
}: {
  vendors: Vendor[];
  accounts: Account[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [lines, setLines] = useState<LineItem[]>([{ description: "", qty: 1, unitPrice: 0, amount: 0 }]);
  const [taxPct, setTaxPct] = useState(0);

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const taxAmount = (subtotal * taxPct) / 100;
  const total = subtotal + taxAmount;

  function updateLine(i: number, field: keyof LineItem, val: string | number) {
    setLines((prev) => {
      const next = prev.map((l, idx) => {
        if (idx !== i) return l;
        const updated = { ...l, [field]: val };
        updated.amount = Number(updated.qty) * Number(updated.unitPrice);
        return updated;
      });
      return next;
    });
  }

  function addLine() {
    setLines((p) => [...p, { description: "", qty: 1, unitPrice: 0, amount: 0 }]);
  }

  function removeLine(i: number) {
    setLines((p) => p.filter((_, idx) => idx !== i));
  }

  function fmt(n: number) {
    return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
  }

  return (
    <form action={action} className="space-y-6">
      {/* Hidden computed fields */}
      <input type="hidden" name="lineItems" value={JSON.stringify(lines)} />
      <input type="hidden" name="subtotal" value={subtotal} />
      <input type="hidden" name="taxAmount" value={taxAmount} />
      <input type="hidden" name="total" value={total} />

      <div className="grid gap-5 md:grid-cols-2">
        {/* Vendor */}
        <div>
          <label className="text-sm font-medium text-[var(--fg)]">Vendor *</label>
          <select name="vendorId" required className="mt-1.5 w-full">
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        {/* Department */}
        <div>
          <label className="text-sm font-medium text-[var(--fg)]">Department</label>
          <input name="department" placeholder="e.g. Finance, Programmes, HR" className="mt-1.5 w-full" />
        </div>
        {/* Title */}
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-[var(--fg)]">PO title *</label>
          <input name="title" required placeholder="e.g. Office supplies Q3 2026" className="mt-1.5 w-full" />
        </div>
        {/* Description */}
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-[var(--fg)]">Description</label>
          <textarea name="description" rows={2} placeholder="Additional context or requirements…" className="mt-1.5 w-full" />
        </div>
        {/* Required by */}
        <div>
          <label className="text-sm font-medium text-[var(--fg)]">Required by</label>
          <input name="requiredBy" type="date" className="mt-1.5 w-full" />
        </div>
        {/* Pay from account */}
        <div>
          <label className="text-sm font-medium text-[var(--fg)]">Pay from account</label>
          <select name="fromAccountId" className="mt-1.5 w-full">
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Line items</h2>
          <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg)] hover:bg-[var(--bg-muted)]">
            <Plus className="h-3 w-3" /> Add line
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Description *</th>
                <th className="px-4 py-3 text-right font-semibold w-20">Qty</th>
                <th className="px-4 py-3 text-right font-semibold w-32">Unit price</th>
                <th className="px-4 py-3 text-right font-semibold w-32">Amount</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">
                    <input
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Item description"
                      className="w-full bg-transparent outline-none"
                      required
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="1"
                      value={line.qty}
                      onChange={(e) => updateLine(i, "qty", Number(e.target.value))}
                      className="w-full bg-transparent text-right outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(i, "unitPrice", Number(e.target.value))}
                      className="w-full bg-transparent text-right outline-none font-mono"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-[var(--fg)]">
                    {fmt(line.amount)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="rounded p-1 text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--fg-muted)]">Subtotal</span>
            <span className="font-mono font-semibold text-[var(--fg)]">{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[var(--fg-muted)]">Tax</span>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={taxPct}
                onChange={(e) => setTaxPct(Number(e.target.value))}
                className="w-16 rounded border border-[var(--border)] px-2 py-0.5 text-right text-xs font-mono"
              />
              <span className="text-xs text-[var(--fg-muted)]">%</span>
            </div>
            <span className="font-mono text-[var(--fg-muted)]">{fmt(taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-bold">
            <span className="text-[var(--fg)]">Total</span>
            <span className="font-mono text-[var(--fg)]">{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-sm font-medium text-[var(--fg)]">Notes</label>
        <textarea name="notes" rows={2} className="mt-1.5 w-full" />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
        <button type="submit" className="btn-primary inline-flex items-center gap-2">
          Submit purchase order <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
