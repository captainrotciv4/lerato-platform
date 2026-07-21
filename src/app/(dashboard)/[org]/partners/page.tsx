import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Partners — Lerato Platform" };

const TYPE_STYLE: Record<string, string> = {
  STRATEGIC: "bg-red-100 text-red-800",
  COMMUNITY: "bg-blue-100 text-blue-800",
  SUPPORTING: "bg-gray-100 text-gray-800",
  OTHER: "bg-gray-100 text-gray-700",
};

export default async function PartnersPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const partners = await dbRetry(() => prisma.partnership.findMany({
    where: { organizationId: ctx.organization.id, deletedAt: null },
    orderBy: [{ partnerType: "asc" }, { partnerName: "asc" }],
  }));

  // Group by type for display
  const grouped: Record<string, typeof partners> = {};
  for (const p of partners) {
    (grouped[p.partnerType] ||= []).push(p);
  }
  const order = ["STRATEGIC", "COMMUNITY", "SUPPORTING", "OTHER"];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Partners</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Strategic, community, and supporting partners of {ctx.organization.shortName}.
          </p>
        </div>
        <Link href={`/${org}/partners/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add partner
        </Link>
      </div>

      {partners.length === 0 ? (
        <div className="card p-12 text-center text-sm text-[var(--fg-muted)]">No partners yet.</div>
      ) : (
        order.map((type) => grouped[type] && (
          <div key={type} className="card !p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                {type.toLowerCase()} ({grouped[type].length})
              </h2>
              <span className={`badge ${TYPE_STYLE[type]}`}>{type.toLowerCase()}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {grouped[type].map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-3 font-medium text-[var(--fg)]">{p.partnerName}
                      {p.description && <div className="text-xs font-normal text-[var(--fg-muted)]">{p.description}</div>}
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">{p.contactName || "—"}</td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">{p.contactEmail || "—"}</td>
                    <td className="px-6 py-3 text-right text-[var(--fg-muted)]">
                      {p.active ? <span className="badge bg-green-100 text-green-800">Active</span> : <span className="badge bg-gray-100 text-gray-600">Inactive</span>}
                    </td>
                    <td className="px-6 py-3 text-right text-[var(--fg-muted)]">{formatDate(p.startDate)}</td>
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
