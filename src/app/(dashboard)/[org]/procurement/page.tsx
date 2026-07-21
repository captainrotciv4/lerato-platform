import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ShoppingCart, Building2, ClipboardList, Plus, Clock, CheckCircle, Package, TrendingDown } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Procurement — Lerato Platform" };

const STATUS_META: Record<string, { cls: string; label: string }> = {
  DRAFT:            { cls: "bg-gray-100 text-gray-700",       label: "Draft"           },
  PENDING_APPROVAL: { cls: "bg-amber-100 text-amber-900",     label: "Pending approval"},
  APPROVED:         { cls: "bg-blue-100 text-blue-800",       label: "Approved"        },
  ORDERED:          { cls: "bg-purple-100 text-purple-800",   label: "Ordered"         },
  RECEIVED:         { cls: "bg-emerald-100 text-emerald-800", label: "Received"        },
  CANCELLED:        { cls: "bg-red-100 text-red-700",         label: "Cancelled"       },
};

function fmt(n: number | string, currency = "KES") {
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default async function ProcurementPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const [vendors, orders] = await dbRetry(() =>
    Promise.all([
      prisma.vendor.findMany({
        where: { organizationId: ctx.organization.id, active: true, deletedAt: null },
        orderBy: { name: "asc" },
        include: { _count: { select: { purchaseOrders: true } } },
      }),
      prisma.purchaseOrder.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { vendor: { select: { name: true } } },
      }),
    ])
  );

  const totalSpend = orders.filter((o) => o.status === "RECEIVED").reduce((s, o) => s + Number(o.total), 0);
  const pending = orders.filter((o) => o.status === "PENDING_APPROVAL").length;
  const approved = orders.filter((o) => o.status === "APPROVED" || o.status === "ORDERED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Procurement</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Vendor management &amp; purchase orders for {ctx.organization.shortName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${org}/procurement/vendors` as any} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4" /> Vendors
          </Link>
          <Link href={`/${org}/procurement/orders/new` as any} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> New PO
          </Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPITile icon={Building2} label="Active vendors" value={String(vendors.length)} sub="In directory" color="text-blue-700" bg="bg-blue-50" />
        <KPITile icon={Clock} label="Pending approval" value={String(pending)} sub="Awaiting sign-off" color={pending > 0 ? "text-amber-700" : "text-[var(--fg-muted)]"} bg={pending > 0 ? "bg-amber-50" : "bg-[var(--bg-muted)]"} />
        <KPITile icon={Package} label="Active orders" value={String(approved)} sub="Approved or ordered" color="text-purple-700" bg="bg-purple-50" />
        <KPITile icon={TrendingDown} label="Total spend" value={fmt(totalSpend)} sub="Received POs" color="text-emerald-700" bg="bg-emerald-50" />
      </div>

      {/* Recent POs */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <ClipboardList className="h-4 w-4" /> Recent purchase orders
          </h2>
          <Link href={`/${org}/procurement/orders` as any} className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">View all →</Link>
        </div>
        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-30" />
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
                <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Date</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
                <th className="px-5 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {orders.map((o) => {
                const sm = STATUS_META[o.status];
                return (
                  <tr key={o.id} className="hover:bg-[var(--bg-muted)]">
                    <td className="px-5 py-3 font-mono text-xs text-[var(--fg-muted)]">{o.poNumber}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-[var(--fg)] truncate max-w-xs">{o.title}</div>
                      {o.department && <div className="text-xs text-[var(--fg-muted)]">{o.department}</div>}
                    </td>
                    <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell">{o.vendor.name}</td>
                    <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell">{formatDate(o.createdAt)}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-[var(--fg)]">{fmt(Number(o.total), o.currency)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`badge ${sm.cls}`}>{sm.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Vendor summary */}
      {vendors.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              <Building2 className="h-4 w-4" /> Top vendors
            </h2>
            <Link href={`/${org}/procurement/vendors` as any} className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">Manage vendors →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.slice(0, 6).map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-xs font-bold text-[var(--fg-muted)]">
                  {v.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--fg)]">{v.name}</div>
                  <div className="text-xs text-[var(--fg-muted)]">{v.category.replace(/_/g, " ").toLowerCase()} · {v._count.purchaseOrders} PO{v._count.purchaseOrders !== 1 && "s"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPITile({ icon: Icon, label, value, sub, color, bg }: {
  icon: any; label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{label}</div>
          <div className={`mt-1.5 font-display text-2xl font-bold ${color}`}>{value}</div>
          <div className="mt-1 text-xs text-[var(--fg-muted)]">{sub}</div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}
