import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { formatDate, formatKES } from "@/lib/utils";

export const metadata = { title: "Allocations — Lerato Platform" };

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-900",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  EXECUTED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default async function AllocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { org } = await params;
  const { status } = await searchParams;
  const ctx = await requireTenant(org);

  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_READ)) {
    return (
      <div className="card p-12 text-center text-sm text-[var(--fg-muted)]">
        You don&apos;t have permission to view allocations.
      </div>
    );
  }

  const allocations = await dbRetry(() => prisma.fundAllocation.findMany({
    where: {
      OR: [
        { sourceOrgId: ctx.organization.id },
        { destinationOrgId: ctx.organization.id },
      ],
      ...(status ? { status: status as any } : {}),
    },
    include: {
      sourceOrg: true,
      destinationOrg: true,
      approvals: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  }));

  // Pending count for the approval badge
  const pendingForMe = await dbRetry(() => prisma.fundAllocation.count({
    where: {
      sourceOrgId: ctx.organization.id,
      status: "PENDING_APPROVAL",
      createdById: { not: ctx.user.id },
      NOT: { approvals: { some: { approverId: ctx.user.id } } },
    },
  }));
  const canApprove = can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_APPROVE);
  const canWrite = can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_WRITE);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Fund Allocations</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Movements of funds between organizations and programmes. Approvals stacked by amount.
          </p>
        </div>
        {canWrite && (
          <Link href={`/${org}/allocations/new` as any} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> New allocation
          </Link>
        )}
      </div>

      {/* Pending approval banner */}
      {canApprove && pendingForMe > 0 && (
        <Link
          href={`/${org}/allocations?status=PENDING_APPROVAL` as any}
          className="block rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4 text-sm hover:bg-amber-100"
        >
          <strong className="text-amber-900">{pendingForMe} allocation{pendingForMe !== 1 && "s"} waiting on your approval.</strong>
          <span className="ml-2 text-amber-700">Click to review →</span>
        </Link>
      )}

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <FilterChip slug={org} label="All" active={!status} value="" />
        <FilterChip slug={org} label="Draft" active={status === "DRAFT"} value="DRAFT" />
        <FilterChip slug={org} label="Pending approval" active={status === "PENDING_APPROVAL"} value="PENDING_APPROVAL" />
        <FilterChip slug={org} label="Approved" active={status === "APPROVED"} value="APPROVED" />
        <FilterChip slug={org} label="Executed" active={status === "EXECUTED"} value="EXECUTED" />
        <FilterChip slug={org} label="Rejected" active={status === "REJECTED"} value="REJECTED" />
      </div>

      <div className="card !p-0 overflow-hidden">
        {allocations.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No allocations yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Title</th>
                <th className="px-6 py-3 text-left font-medium">Flow</th>
                <th className="px-6 py-3 text-right font-medium">Amount</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-left font-medium">Approvals</th>
                <th className="px-6 py-3 text-right font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => {
                const approvedCount = a.approvals.filter((x) => x.decision === "APPROVED").length;
                return (
                  <tr key={a.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-3">
                      <Link href={`/${org}/allocations/${a.id}` as any} className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)] hover:underline">
                        {a.title}
                      </Link>
                      {a.category && <div className="text-xs text-[var(--fg-muted)]">{a.category}</div>}
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">
                      <span className="font-medium text-[var(--fg)]">{a.sourceOrg.shortName}</span>
                      <ArrowRight className="inline mx-1 h-3 w-3" />
                      <span className="font-medium text-[var(--fg)]">{a.destinationOrg.shortName}</span>
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-[var(--fg)]">
                      {a.currency} {formatKES(Number(a.amount)).replace("KES ", "")}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`badge ${STATUS_STYLE[a.status]}`}>{a.status.replace("_", " ").toLowerCase()}</span>
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">
                      {approvedCount} / {a.requiredApprovers}
                    </td>
                    <td className="px-6 py-3 text-right text-[var(--fg-muted)]">{formatDate(a.createdAt)}</td>
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

function FilterChip({ slug, label, value, active }: { slug: string; label: string; value: string; active: boolean }) {
  const href = value ? `/${slug}/allocations?status=${value}` : `/${slug}/allocations`;
  return (
    <Link
      href={href as any}
      className={`rounded-full border px-3 py-1 transition-colors ${
        active
          ? "border-transparent bg-[var(--brand-primary)] text-white"
          : "border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
      }`}
    >
      {label}
    </Link>
  );
}
