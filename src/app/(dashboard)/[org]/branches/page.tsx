import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, MapPin, Users, ShieldCheck } from "lucide-react";

export const metadata = { title: "Branches — Lerato Platform" };

export default async function BranchesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const branches = await dbRetry(() => prisma.branch.findMany({
    where: {
      organizationId: ctx.organization.id,
      active: true,
      // Branch-scoped users only see their own branch
      ...(ctx.branchId ? { id: ctx.branchId } : {}),
    },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { beneficiaries: { where: { deletedAt: null } }, staff: { where: { deletedAt: null } } } },
    },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Branches</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Training locations and operational sites for {ctx.organization.shortName}.
          </p>
        </div>
        <Link href={`/${org}/branches/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add branch
        </Link>
      </div>

      {branches.length === 0 ? (
        <div className="card p-12 text-center">
          <MapPin className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-40" />
          <p className="mt-3 text-sm text-[var(--fg-muted)]">No branches yet.</p>
          <Link href={`/${org}/branches/new` as any} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add the first branch
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/${org}/branches/${b.id}` as any}
              className="card !p-0 overflow-hidden transition-shadow hover:shadow-md flex flex-col"
            >
              {/* Coloured top bar */}
              <div className="h-2 w-full" style={{ background: b.primaryColor }} />
              <div className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-[var(--fg)]">{b.name}</span>
                    {b.isMain && (
                      <span className="badge text-white text-[10px]" style={{ background: b.primaryColor }}>Main</span>
                    )}
                  </div>
                  {b.location && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                      <MapPin className="h-3 w-3" />
                      {b.location}
                    </div>
                  )}
                </div>
              </div>
              {b.description && (
                <p className="text-xs text-[var(--fg-muted)] line-clamp-2">{b.description}</p>
              )}
              <div className="mt-auto flex items-center gap-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--fg-muted)]">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {b._count.beneficiaries} players
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {b._count.staff} staff
                </span>
              </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
