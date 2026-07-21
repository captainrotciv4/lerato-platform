import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, Heart } from "lucide-react";
import { formatDate, formatKES } from "@/lib/utils";

export const metadata = { title: "Donors — Lerato Platform" };

const TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-100 text-amber-900",
  SILVER: "bg-gray-200 text-gray-800",
  GOLD: "bg-yellow-100 text-yellow-900",
  PLATINUM: "bg-indigo-100 text-indigo-900",
  PATRON: "bg-purple-100 text-purple-900",
};

export default async function DonorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { org } = await params;
  const { q } = await searchParams;
  const ctx = await requireTenant(org);

  // Donors are global; we filter by shares with this org
  const shares = await dbRetry(() => prisma.donorShare.findMany({
    where: {
      organizationId: ctx.organization.id,
      donor: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { organizationName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    include: {
      donor: {
        include: {
          donations: {
            where: { organizationId: ctx.organization.id },
            orderBy: { receivedAt: "desc" },
          },
        },
      },
    },
    orderBy: { addedAt: "desc" },
    take: 100,
  }));

  const totalGiving = shares.reduce(
    (sum, s) => sum + s.donor.donations.reduce((a, d) => a + Number(d.amount), 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Donors</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Individuals and institutions supporting {ctx.organization.shortName}.
          </p>
        </div>
        <Link href={`/${org}/donors/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add donor
        </Link>
      </div>

      {/* Summary tile */}
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            Total giving received
          </div>
          <div className="mt-1 font-display text-3xl font-bold text-[var(--fg)]">
            {formatKES(totalGiving)}
          </div>
          <div className="mt-1 text-xs text-[var(--fg-muted)]">
            From {shares.length} donor{shares.length !== 1 && "s"}
          </div>
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-md text-white"
          style={{ background: ctx.organization.primaryColor }}
        >
          <Heart className="h-6 w-6" />
        </div>
      </div>

      {/* Search */}
      <form className="card !p-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, organization, or email…"
          className="w-full !border-0 !p-2"
        />
      </form>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {shares.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--fg-muted)]">No donors yet for this organization.</p>
            <Link
              href={`/${org}/donors/new` as any}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add the first donor
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-left font-medium">Tier</th>
                <th className="px-6 py-3 text-right font-medium">Total given</th>
                <th className="px-6 py-3 text-right font-medium">Last gift</th>
                <th className="px-6 py-3 text-right font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {shares.map(({ donor, addedAt }) => {
                const total = donor.donations.reduce((a, d) => a + Number(d.amount), 0);
                const last = donor.donations[0];
                const displayName =
                  donor.type === "ORGANIZATION"
                    ? donor.organizationName
                    : donor.type === "ANONYMOUS"
                    ? "(Anonymous)"
                    : `${donor.firstName || ""} ${donor.lastName || ""}`.trim();
                return (
                  <tr key={donor.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-3">
                      <Link
                        href={`/${org}/donors/${donor.id}` as any}
                        className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)] hover:underline"
                      >
                        {displayName || "—"}
                      </Link>
                      {donor.email && (
                        <div className="text-xs text-[var(--fg-muted)]">{donor.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">
                      {donor.type.toLowerCase()}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`badge ${TIER_COLORS[donor.tier] || "bg-gray-100 text-gray-800"}`}>
                        {donor.tier}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-[var(--fg)]">
                      {formatKES(total)}
                    </td>
                    <td className="px-6 py-3 text-right text-[var(--fg-muted)]">
                      {last ? formatDate(last.receivedAt) : "—"}
                    </td>
                    <td className="px-6 py-3 text-right text-[var(--fg-muted)]">
                      {formatDate(addedAt)}
                    </td>
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
