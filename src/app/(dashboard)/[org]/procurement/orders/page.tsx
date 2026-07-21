import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { approvePurchaseOrder, markPOReceived, cancelPurchaseOrder } from "../actions";

export const metadata = { title: "Purchase Orders — Lerato Platform" };

const STATUS_META: Record<string, { cls: string; label: string }> = {
  DRAFT:            { cls: "bg-gray-100 text-gray-700",       label: "Draft"            },
  PENDING_APPROVAL: { cls: "bg-amber-100 text-amber-900",     label: "Pending approval" },
  APPROVED:         { cls: "bg-blue-100 text-blue-800",       label: "Approved"         },
  ORDERED:          { cls: "bg-purple-100 text-purple-800",   label: "Ordered"          },
  RECEIVED:         { cls: "bg-emerald-100 text-emerald-800", label: "Received"         },
  CANCELLED:        { cls: "bg-red-100 text-red-700",         label: "Cancelled"        },
};

function fmt(n: number | string, currency = "KES") {
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default async function OrdersPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canApprove = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";

  const orders = await dbRetry(() =>
    prisma.purchaseOrder.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { createdAt: "desc" },
      include: { vendor: { select: { name: true } } },
    })
  );

  return (
    <div className="space-y-6">
      <Link href={`/${org}/procurement` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to procurement
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Purchase Orders</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{orders.length} total orders</p>
        </div>
        <Link href={`/${org}/procurement/orders/new` as any} className="btn-primary inline-flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> New PO
        </Link>
      </div>

      <div className="card !p-0 overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-30" />
            <p className="mt-3 text-sm text-[var(--fg-muted)]">No purchase orders yet.</p>
            <Link href={`/${org}/procurement/orders/new` as any} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Create first PO
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">PO #</th>
                <th className="px-5 py-3 text-left font-semibold">Title</th>
                <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Vendor</th>
                <th className="px-5 py-3 text-left font-semibold hidden lg:table-cell">Dept</th>
                <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Date</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
                <th className="px-5 py-3 text-center font-semibold">Status</th>
                {canApprove && <th className="px-5 py-3 text-center font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {orders.map((o) => {
                const sm = STATUS_META[o.status];
                return (
                  <tr key={o.id} className="hover:bg-[var(--bg-muted)]">
                    <td className="px-5 py-3 font-mono text-xs text-[var(--fg-muted)]">{o.poNumber}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-[var(--fg)]">{o.title}</div>
                      {o.description && <div className="text-xs text-[var(--fg-muted)] truncate max-w-xs">{o.description}</div>}
                    </td>
                    <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell">{o.vendor.name}</td>
                    <td className="px-5 py-3 text-xs text-[var(--fg-muted)] hidden lg:table-cell">{o.department ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell">{formatDate(o.createdAt)}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-[var(--fg)]">{fmt(Number(o.total), o.currency)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`badge ${sm.cls}`}>{sm.label}</span>
                    </td>
                    {canApprove && (
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {o.status === "PENDING_APPROVAL" && (
                            <form action={async () => { "use server"; await approvePurchaseOrder(org, o.id); }}>
                              <button type="submit" className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">Approve</button>
                            </form>
                          )}
                          {o.status === "APPROVED" && (
                            <form action={async () => { "use server"; await markPOReceived(org, o.id); }}>
                              <button type="submit" className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Received</button>
                            </form>
                          )}
                          {(o.status === "DRAFT" || o.status === "PENDING_APPROVAL") && (
                            <form action={async () => { "use server"; await cancelPurchaseOrder(org, o.id); }}>
                              <button type="submit" className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-700">Cancel</button>
                            </form>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
