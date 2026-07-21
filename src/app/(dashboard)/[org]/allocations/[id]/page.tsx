import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { submitAllocation, decideAllocation, executeAllocation } from "../actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Send, PlayCircle } from "lucide-react";
import { formatDate, formatKES } from "@/lib/utils";

export const metadata = { title: "Allocation — Lerato Platform" };

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-900",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  EXECUTED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default async function AllocationDetailPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  const [allocation, sourceAccounts] = await dbRetry(() =>
    Promise.all([
      prisma.fundAllocation.findFirst({
        where: {
          id,
          OR: [{ sourceOrgId: ctx.organization.id }, { destinationOrgId: ctx.organization.id }],
        },
        include: {
          sourceOrg: true,
          destinationOrg: true,
          sourceProgram: true,
          destinationProgram: true,
          approvals: { orderBy: { createdAt: "asc" } },
        },
      }),
      prisma.account.findMany({
        where: { type: "ASSET", active: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, organizationId: true },
      }),
    ])
  );
  if (!allocation) notFound();

  const isOwner = allocation.createdById === ctx.user.id;
  const myDecision = allocation.approvals.find((a) => a.approverId === ctx.user.id);
  const canApprove = can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_APPROVE);
  const canExecute = can(ctx.role, ctx.permissions, PERMISSIONS.ALLOCATION_EXECUTE);
  const isInSourceOrg = allocation.sourceOrgId === ctx.organization.id;

  const approvedCount = allocation.approvals.filter((a) => a.decision === "APPROVED").length;
  const progress = (approvedCount / allocation.requiredApprovers) * 100;

  return (
    <div className="space-y-6">
      <Link href={`/${org}/allocations` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to allocations
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold text-[var(--fg)]">{allocation.title}</h1>
            {allocation.description && <p className="mt-2 text-sm text-[var(--fg)]">{allocation.description}</p>}
            {allocation.category && <div className="mt-2 text-xs text-[var(--fg-muted)]">Category: {allocation.category}</div>}
          </div>
          <span className={`badge ${STATUS_STYLE[allocation.status]}`}>{allocation.status.replace("_", " ").toLowerCase()}</span>
        </div>

        <div className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Amount</div>
            <div className="font-display text-2xl font-bold text-[var(--fg)]">{formatKES(Number(allocation.amount))}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">From</div>
            <div className="font-medium text-[var(--fg)]">{allocation.sourceOrg.shortName}</div>
            {allocation.sourceProgram && <div className="text-xs text-[var(--fg-muted)]">{allocation.sourceProgram.name}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">To</div>
            <div className="font-medium text-[var(--fg)]">{allocation.destinationOrg.shortName}</div>
            {allocation.destinationProgram && <div className="text-xs text-[var(--fg-muted)]">{allocation.destinationProgram.name}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Approval progress</div>
            <div className="font-medium text-[var(--fg)]">{approvedCount} / {allocation.requiredApprovers}</div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Action panel */}
      <div className="card">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Actions</h2>

        {/* Submit (owner, draft) */}
        {isOwner && allocation.status === "DRAFT" && (
          <form action={async () => { "use server"; await submitAllocation(org, allocation.id); }} className="mt-3">
            <button type="submit" className="btn-primary inline-flex items-center gap-2">
              <Send className="h-4 w-4" /> Submit for approval
            </button>
            <p className="mt-2 text-xs text-[var(--fg-muted)]">
              Submitting locks the allocation and notifies eligible approvers.
            </p>
          </form>
        )}

        {/* Approve / reject (eligible approver, pending, not owner, not decided) */}
        {!isOwner && canApprove && allocation.status === "PENDING_APPROVAL" && !myDecision && (
          <div className="mt-3 space-y-3">
            <form action={async () => { "use server"; await decideAllocation(org, allocation.id, "APPROVED"); }} className="inline-block">
              <button type="submit" className="btn-primary inline-flex items-center gap-2 mr-3">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
            </form>
            <form action={async () => { "use server"; await decideAllocation(org, allocation.id, "REJECTED"); }} className="inline-block">
              <button type="submit" className="btn-danger inline-flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </form>
            <p className="text-xs text-[var(--fg-muted)]">
              You&apos;re seeing this because you&apos;re not the creator and you have approval permission.
            </p>
          </div>
        )}

        {/* Already decided */}
        {myDecision && (
          <div className="mt-3 text-sm text-[var(--fg-muted)]">
            You {myDecision.decision === "APPROVED" ? "approved" : "rejected"} this allocation on {formatDate(myDecision.decidedAt)}.
          </div>
        )}

        {/* Execute (approved, has execute permission, in source org) */}
        {allocation.status === "APPROVED" && canExecute && isInSourceOrg && (
          <form
            action={async (fd) => {
              "use server";
              await executeAllocation(org, allocation.id, fd.get("fromAccountId") as string || undefined);
            }}
            className="mt-3 space-y-3"
          >
            <div>
              <label className="text-xs text-[var(--fg-muted)] font-medium">
                Source account (debit) — optional
              </label>
              <select name="fromAccountId" className="mt-1 w-full max-w-xs text-sm">
                <option value="">No account debit (manual transfer)</option>
                {sourceAccounts
                  .filter((a) => a.organizationId === allocation.sourceOrgId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
              </select>
            </div>
            <button type="submit" className="btn-primary inline-flex items-center gap-2">
              <PlayCircle className="h-4 w-4" /> Execute allocation
            </button>
            <p className="text-xs text-[var(--fg-muted)]">
              Moves funds: creates expense on source, income on destination, and updates account balances.
            </p>
          </form>
        )}

        {allocation.status === "EXECUTED" && (
          <div className="mt-3 text-sm text-green-700">
            ✅ Funds moved on {formatDate(allocation.executedAt)}. Transactions created on both ledgers.
          </div>
        )}

        {allocation.status === "REJECTED" && (
          <div className="mt-3 text-sm text-red-700">
            ❌ Rejected on {formatDate(allocation.rejectedAt)}. No funds moved.
          </div>
        )}
      </div>

      {/* Approval log */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-[var(--fg)]">Approval log</h2>
        </div>
        {allocation.approvals.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No decisions recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Level</th>
                <th className="px-6 py-3 text-left font-medium">Role</th>
                <th className="px-6 py-3 text-left font-medium">Decision</th>
                <th className="px-6 py-3 text-left font-medium">Notes</th>
                <th className="px-6 py-3 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {allocation.approvals.map((a) => (
                <tr key={a.id} className="border-t border-[var(--border)]">
                  <td className="px-6 py-3 font-medium text-[var(--fg)]">{a.level}</td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">{a.approverRole.replace("_", " ").toLowerCase()}</td>
                  <td className="px-6 py-3">
                    {a.decision === "APPROVED" && <span className="badge bg-green-100 text-green-800">approved</span>}
                    {a.decision === "REJECTED" && <span className="badge bg-red-100 text-red-800">rejected</span>}
                    {!a.decision && <span className="badge bg-amber-100 text-amber-900">pending</span>}
                  </td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">{a.notes || "—"}</td>
                  <td className="px-6 py-3 text-right text-[var(--fg-muted)]">{formatDate(a.decidedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
