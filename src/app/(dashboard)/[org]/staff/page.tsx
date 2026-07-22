import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Staff & Volunteers — Lerato Platform" };

const TYPE_COLORS: Record<string, string> = {
  EMPLOYEE: "bg-blue-100 text-blue-800",
  VOLUNTEER: "bg-green-100 text-green-800",
  COACH: "bg-amber-100 text-amber-900",
  MENTOR: "bg-purple-100 text-purple-900",
  INTERN: "bg-gray-100 text-gray-800",
  CONSULTANT: "bg-indigo-100 text-indigo-900",
};

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { org } = await params;
  const { q } = await searchParams;
  const ctx = await requireTenant(org);

  const staff = await dbRetry(() => prisma.staffVolunteer.findMany({
    where: {
      organizationId: ctx.organization.id,
      deletedAt: null,
      ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
      ...(q ? { OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { position: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: [{ active: "desc" }, { lastName: "asc" }],
    take: 100,
    include: { branch: { select: { name: true } } },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Staff &amp; Volunteers</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Everyone who runs {ctx.organization.shortName} on the ground.
          </p>
        </div>
        <Link href={`/${org}/staff/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add person
        </Link>
      </div>

      <form className="card !p-3">
        <input name="q" defaultValue={q} placeholder="Search name or position…" className="w-full !border-0 !p-2" />
      </form>

      <div className="card !p-0 overflow-hidden">
        {staff.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No staff or volunteers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-left font-medium">Position</th>
                {!ctx.branchId && <th className="px-6 py-3 text-left font-medium">Branch</th>}
                <th className="px-6 py-3 text-left font-medium">Started</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                  <td className="px-6 py-3 font-medium text-[var(--fg)]">{s.firstName} {s.lastName}
                    {s.email && <div className="text-xs text-[var(--fg-muted)]">{s.email}</div>}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`badge ${TYPE_COLORS[s.type] || "bg-gray-100 text-gray-800"}`}>{s.type.toLowerCase()}</span>
                  </td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">{s.position || "—"}</td>
                  {!ctx.branchId && (
                    <td className="px-6 py-3 text-[var(--fg-muted)]">{s.branch?.name || "—"}</td>
                  )}
                  <td className="px-6 py-3 text-[var(--fg-muted)]">{formatDate(s.startDate)}</td>
                  <td className="px-6 py-3">
                    {s.active
                      ? <span className="badge bg-green-100 text-green-800">Active</span>
                      : <span className="badge bg-gray-100 text-gray-600">Inactive</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
