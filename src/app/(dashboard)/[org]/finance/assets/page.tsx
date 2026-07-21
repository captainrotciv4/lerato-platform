import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, Package, Car, Monitor, Sofa, Dumbbell, Building2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { createFixedAsset } from "./actions";

export const metadata = { title: "Asset Register — Lerato Platform" };

const CAT_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  LAND_BUILDING:   { label: "Land & Buildings",  icon: Building2, color: "text-stone-700",   bg: "bg-stone-50"   },
  VEHICLE:         { label: "Vehicles",           icon: Car,       color: "text-blue-700",    bg: "bg-blue-50"    },
  IT_EQUIPMENT:    { label: "IT & Technology",    icon: Monitor,   color: "text-violet-700",  bg: "bg-violet-50"  },
  FURNITURE:       { label: "Furniture & Fittings", icon: Sofa,    color: "text-amber-700",   bg: "bg-amber-50"   },
  EQUIPMENT:       { label: "Equipment",          icon: Package,   color: "text-teal-700",    bg: "bg-teal-50"    },
  SPORTS_EQUIPMENT:{ label: "Sports Equipment",   icon: Dumbbell,  color: "text-emerald-700", bg: "bg-emerald-50" },
  OTHER:           { label: "Other Assets",       icon: Package,   color: "text-gray-700",    bg: "bg-gray-50"    },
};

const COND_STYLE: Record<string, string> = {
  EXCELLENT: "bg-emerald-100 text-emerald-800",
  GOOD:      "bg-teal-100 text-teal-800",
  FAIR:      "bg-amber-100 text-amber-800",
  POOR:      "bg-orange-100 text-orange-800",
  DAMAGED:   "bg-red-100 text-red-800",
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:       "bg-emerald-100 text-emerald-800",
  UNDER_REPAIR: "bg-amber-100 text-amber-900",
  DISPOSED:     "bg-gray-100 text-gray-600",
  WRITTEN_OFF:  "bg-red-100 text-red-700",
};

function fmt(n: number | string, currency = "KES") {
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${Math.abs(num).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

const CATEGORIES = Object.keys(CAT_META) as (keyof typeof CAT_META)[];

export default async function AssetsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canManage = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";

  const assets = await dbRetry(() =>
    prisma.fixedAsset.findMany({
      where: { organizationId: ctx.organization.id, status: { not: "WRITTEN_OFF" } },
      orderBy: [{ category: "asc" }, { purchaseDate: "desc" }],
    })
  );

  const totalCost    = assets.reduce((s, a) => s + Number(a.purchaseCost), 0);
  const totalValue   = assets.reduce((s, a) => s + Number(a.currentValue), 0);
  const depreciation = totalCost - totalValue;

  const byCategory = CATEGORIES.map((cat) => ({
    cat,
    items: assets.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <Link href={`/${org}/finance` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to finance
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Asset Register</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{assets.length} assets · fixed asset tracking &amp; depreciation</p>
        </div>
        {canManage && (
          <details className="relative">
            <summary className="btn-primary cursor-pointer list-none inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Add asset
            </summary>
            <div className="absolute right-0 top-11 z-20 w-96 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-xl space-y-3">
              <h3 className="font-semibold text-[var(--fg)]">Register asset</h3>
              <form action={async (fd) => { "use server"; await createFixedAsset(org, fd); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Asset # *</label>
                    <input name="assetNumber" required placeholder="FA-001" className="mt-1 w-full text-sm font-mono" />
                  </div>
                  <div>
                    <label className="text-xs">Category *</label>
                    <select name="category" required className="mt-1 w-full text-sm">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_META[c].label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs">Asset name *</label>
                  <input name="name" required placeholder="e.g. Dell Latitude 5540" className="mt-1 w-full text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Purchase date *</label>
                    <input name="purchaseDate" type="date" required className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Purchase cost (KES) *</label>
                    <input name="purchaseCost" type="number" step="0.01" min="0" required className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Useful life (years)</label>
                    <input name="usefulLifeYears" type="number" min="1" max="50" placeholder="5" className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Salvage value (KES)</label>
                    <input name="salvageValue" type="number" step="0.01" min="0" placeholder="0" className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs">Location</label>
                  <input name="location" placeholder="e.g. Head Office" className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">Serial / registration number</label>
                  <input name="serialNumber" className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">Supplier</label>
                  <input name="supplier" className="mt-1 w-full text-sm" />
                </div>
                <button type="submit" className="btn-primary w-full text-sm">Register asset</button>
              </form>
            </div>
          </details>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Total cost" value={fmt(totalCost)} sub={`${assets.length} assets`} color="text-[var(--fg)]" />
        <SummaryTile label="Net book value" value={fmt(totalValue)} sub="After depreciation" color="text-emerald-700" />
        <SummaryTile label="Total depreciation" value={fmt(depreciation)} sub="Accumulated" color="text-red-700" />
      </div>

      {/* Asset groups */}
      {assets.length === 0 ? (
        <div className="card py-16 text-center">
          <Package className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-30" />
          <p className="mt-3 text-sm text-[var(--fg-muted)]">No assets registered yet.</p>
        </div>
      ) : (
        byCategory.map(({ cat, items }) => {
          const m = CAT_META[cat];
          const Icon = m.icon;
          return (
            <div key={cat} className="card !p-0 overflow-hidden">
              <div className={`flex items-center gap-3 border-b border-[var(--border)] px-5 py-4 ${m.bg}`}>
                <Icon className={`h-5 w-5 ${m.color}`} />
                <h2 className={`font-display font-semibold ${m.color}`}>{m.label}</h2>
                <span className={`ml-auto text-xs font-medium ${m.color}`}>{items.length} item{items.length !== 1 && "s"}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-muted)] text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Asset #</th>
                    <th className="px-5 py-3 text-left font-semibold">Name</th>
                    <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Location</th>
                    <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Purchased</th>
                    <th className="px-5 py-3 text-right font-semibold">Cost</th>
                    <th className="px-5 py-3 text-right font-semibold">Book value</th>
                    <th className="px-5 py-3 text-center font-semibold">Condition</th>
                    <th className="px-5 py-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const deprPct = Number(a.purchaseCost) > 0
                      ? Math.round(((Number(a.purchaseCost) - Number(a.currentValue)) / Number(a.purchaseCost)) * 100)
                      : 0;
                    return (
                      <tr key={a.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                        <td className="px-5 py-3 font-mono text-xs text-[var(--fg-muted)]">{a.assetNumber}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-[var(--fg)]">{a.name}</div>
                          {a.serialNumber && <div className="text-xs text-[var(--fg-muted)] font-mono">S/N: {a.serialNumber}</div>}
                        </td>
                        <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell">{a.location ?? "—"}</td>
                        <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell">{formatDate(a.purchaseDate)}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-[var(--fg)]">{fmt(Number(a.purchaseCost), a.currency)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="font-mono tabular-nums text-emerald-700 font-semibold">{fmt(Number(a.currentValue), a.currency)}</div>
                          {deprPct > 0 && <div className="text-[10px] text-red-600">−{deprPct}% depreciated</div>}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`badge ${COND_STYLE[a.condition]}`}>{a.condition.toLowerCase()}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`badge ${STATUS_STYLE[a.status]}`}>{a.status.replace("_", " ").toLowerCase()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}

function SummaryTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-[var(--fg-muted)]">{sub}</div>
    </div>
  );
}
