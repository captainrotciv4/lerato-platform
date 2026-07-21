import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, Building2, Star } from "lucide-react";
import { createVendor } from "../actions";

export const metadata = { title: "Vendors — Lerato Platform" };

const CAT_LABELS: Record<string, string> = {
  SUPPLIES_STATIONERY:   "Supplies & Stationery",
  IT_TECHNOLOGY:         "IT & Technology",
  EQUIPMENT:             "Equipment",
  TRANSPORT_LOGISTICS:   "Transport & Logistics",
  CATERING_EVENTS:       "Catering & Events",
  PROFESSIONAL_SERVICES: "Professional Services",
  UTILITIES:             "Utilities",
  RENT_FACILITIES:       "Rent & Facilities",
  MEDIA_COMMUNICATIONS:  "Media & Communications",
  OTHER:                 "Other",
};

const CATEGORIES = Object.keys(CAT_LABELS);

export default async function VendorsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canManage = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD" || ctx.role === "FINANCE";

  const vendors = await dbRetry(() =>
    prisma.vendor.findMany({
      where: { organizationId: ctx.organization.id, deletedAt: null },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { purchaseOrders: true } },
      },
    })
  );

  const byCategory = CATEGORIES.map((cat) => ({
    cat,
    label: CAT_LABELS[cat],
    vendors: vendors.filter((v) => v.category === cat),
  })).filter((g) => g.vendors.length > 0);

  return (
    <div className="space-y-6">
      <Link href={`/${org}/procurement` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to procurement
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Vendor Directory</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{vendors.length} vendor{vendors.length !== 1 && "s"} · supplier &amp; contractor registry</p>
        </div>
        {canManage && (
          <details className="relative">
            <summary className="btn-primary cursor-pointer list-none inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Add vendor
            </summary>
            <div className="absolute right-0 top-11 z-20 w-96 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-xl space-y-3 max-h-[80vh] overflow-y-auto">
              <h3 className="font-semibold text-[var(--fg)]">Register vendor</h3>
              <form action={async (fd) => { "use server"; await createVendor(org, fd); }} className="space-y-3">
                <div>
                  <label className="text-xs">Vendor name *</label>
                  <input name="name" required className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">Category *</label>
                  <select name="category" required className="mt-1 w-full text-sm">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Contact name</label>
                    <input name="contactName" className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Phone</label>
                    <input name="phone" className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs">Email</label>
                  <input name="email" type="email" className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">Address</label>
                  <input name="address" className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">KRA PIN</label>
                  <input name="taxPin" placeholder="P051234567X" className="mt-1 w-full text-sm font-mono" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs">Bank name</label>
                    <input name="bankName" className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Account no.</label>
                    <input name="bankAccount" className="mt-1 w-full text-sm font-mono" />
                  </div>
                  <div>
                    <label className="text-xs">Branch</label>
                    <input name="bankBranch" className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs">Notes</label>
                  <textarea name="notes" rows={2} className="mt-1 w-full text-sm" />
                </div>
                <button type="submit" className="btn-primary w-full text-sm">Save vendor</button>
              </form>
            </div>
          </details>
        )}
      </div>

      {vendors.length === 0 ? (
        <div className="card py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-30" />
          <p className="mt-3 text-sm text-[var(--fg-muted)]">No vendors registered yet.</p>
        </div>
      ) : (
        byCategory.map(({ cat, label, vendors: vList }) => (
          <div key={cat} className="card !p-0 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-muted)] px-5 py-4">
              <Building2 className="h-4 w-4 text-[var(--fg-muted)]" />
              <h2 className="font-display font-semibold text-[var(--fg)]">{label}</h2>
              <span className="ml-auto text-xs text-[var(--fg-muted)]">{vList.length}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-2.5 text-left font-semibold">Vendor</th>
                  <th className="px-5 py-2.5 text-left font-semibold hidden md:table-cell">Contact</th>
                  <th className="px-5 py-2.5 text-left font-semibold hidden lg:table-cell">KRA PIN</th>
                  <th className="px-5 py-2.5 text-left font-semibold hidden lg:table-cell">Bank details</th>
                  <th className="px-5 py-2.5 text-center font-semibold">POs</th>
                  <th className="px-5 py-2.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {vList.map((v) => (
                  <tr key={v.id} className={`hover:bg-[var(--bg-muted)] ${!v.active ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-[var(--fg)]">{v.name}</div>
                      {v.address && <div className="text-xs text-[var(--fg-muted)]">{v.address}</div>}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      {v.contactName && <div className="text-[var(--fg)]">{v.contactName}</div>}
                      {v.phone && <div className="text-xs text-[var(--fg-muted)]">{v.phone}</div>}
                      {v.email && <div className="text-xs text-[var(--fg-muted)]">{v.email}</div>}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--fg-muted)] hidden lg:table-cell">{v.taxPin ?? "—"}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      {v.bankName ? (
                        <div className="text-xs text-[var(--fg-muted)]">
                          <div>{v.bankName}</div>
                          {v.bankAccount && <div className="font-mono">{v.bankAccount}</div>}
                        </div>
                      ) : <span className="text-[var(--fg-muted)]">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-sm font-semibold text-[var(--fg)]">{v._count.purchaseOrders}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`badge ${v.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                        {v.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
