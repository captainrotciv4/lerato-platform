import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, CheckCircle, XCircle, Clock, CalendarMinus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { createLeaveRequest, approveLeave, rejectLeave } from "../actions";

export const metadata = { title: "Leave Requests — Lerato Platform" };

const LEAVE_TYPES = ["ANNUAL","SICK","MATERNITY","PATERNITY","COMPASSIONATE","STUDY","UNPAID"] as const;
const LEAVE_LABELS: Record<string, string> = {
  ANNUAL: "Annual leave", SICK: "Sick leave", MATERNITY: "Maternity",
  PATERNITY: "Paternity", COMPASSIONATE: "Compassionate", STUDY: "Study leave", UNPAID: "Unpaid leave",
};

const STATUS_META: Record<string, { cls: string; icon: any; label: string }> = {
  PENDING:   { cls: "bg-amber-100 text-amber-900",     icon: Clock,         label: "Pending"   },
  APPROVED:  { cls: "bg-emerald-100 text-emerald-800", icon: CheckCircle,   label: "Approved"  },
  REJECTED:  { cls: "bg-red-100 text-red-800",         icon: XCircle,       label: "Rejected"  },
  CANCELLED: { cls: "bg-gray-100 text-gray-600",       icon: XCircle,       label: "Cancelled" },
};

export default async function LeavePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canApprove = ctx.role === "ADMIN";

  const [leaveRequests, staff] = await dbRetry(() =>
    Promise.all([
      prisma.leaveRequest.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { createdAt: "desc" },
        include: { staff: { select: { firstName: true, lastName: true, position: true, department: true } } },
      }),
      prisma.staffVolunteer.findMany({
        where: { organizationId: ctx.organization.id, active: true, deletedAt: null },
        orderBy: [{ lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, position: true },
      }),
    ])
  );

  const pending  = leaveRequests.filter((l) => l.status === "PENDING");
  const approved = leaveRequests.filter((l) => l.status === "APPROVED");
  const other    = leaveRequests.filter((l) => l.status !== "PENDING" && l.status !== "APPROVED");

  return (
    <div className="space-y-6">
      <Link href={`/${org}/hr` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to HR
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Leave Requests</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{pending.length} pending · {approved.length} approved</p>
        </div>
        {staff.length > 0 && (
          <details className="relative">
            <summary className="btn-primary cursor-pointer list-none inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> New request
            </summary>
            <div className="absolute right-0 top-11 z-20 w-96 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-xl space-y-3">
              <h3 className="font-semibold text-[var(--fg)]">Apply for leave</h3>
              <form action={async (fd) => { "use server"; await createLeaveRequest(org, fd); }} className="space-y-3">
                <div>
                  <label className="text-xs">Staff member *</label>
                  <select name="staffId" required className="mt-1 w-full text-sm">
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName} {s.position ? `— ${s.position}` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs">Leave type *</label>
                  <select name="leaveType" required className="mt-1 w-full text-sm">
                    {LEAVE_TYPES.map((t) => <option key={t} value={t}>{LEAVE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Start date *</label>
                    <input name="startDate" type="date" required className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">End date *</label>
                    <input name="endDate" type="date" required className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs">Number of days *</label>
                  <input name="days" type="number" min="1" required className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">Reason</label>
                  <textarea name="reason" rows={2} className="mt-1 w-full text-sm" />
                </div>
                <button type="submit" className="btn-primary w-full text-sm">Submit request</button>
              </form>
            </div>
          </details>
        )}
      </div>

      {/* Pending approval */}
      {pending.length > 0 && canApprove && (
        <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Clock className="h-4 w-4" /> {pending.length} request{pending.length !== 1 && "s"} pending approval
          </div>
          <div className="space-y-2">
            {pending.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                <div>
                  <span className="font-medium text-[var(--fg)]">{l.staff.firstName} {l.staff.lastName}</span>
                  <span className="mx-2 text-[var(--fg-muted)]">·</span>
                  <span className="text-sm text-amber-800">{LEAVE_LABELS[l.leaveType]}</span>
                  <span className="mx-2 text-[var(--fg-muted)]">·</span>
                  <span className="text-sm text-[var(--fg-muted)]">{l.days} day{l.days !== 1 && "s"}</span>
                  <div className="text-xs text-[var(--fg-muted)]">{formatDate(l.startDate)} – {formatDate(l.endDate)}</div>
                </div>
                <div className="flex gap-2">
                  <form action={async () => { "use server"; await approveLeave(org, l.id); }}>
                    <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                      Approve
                    </button>
                  </form>
                  <form action={async () => { "use server"; await rejectLeave(org, l.id); }}>
                    <button type="submit" className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full leave table */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <CalendarMinus className="h-4 w-4" /> All leave requests
          </h2>
          <span className="text-xs text-[var(--fg-muted)]">{leaveRequests.length} total</span>
        </div>
        {leaveRequests.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No leave requests yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Staff member</th>
                <th className="px-5 py-3 text-left font-semibold">Type</th>
                <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Period</th>
                <th className="px-5 py-3 text-center font-semibold">Days</th>
                <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Reason</th>
                <th className="px-5 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {leaveRequests.map((l) => {
                const sm = STATUS_META[l.status];
                const Icon = sm.icon;
                return (
                  <tr key={l.id} className="hover:bg-[var(--bg-muted)]">
                    <td className="px-5 py-3">
                      <div className="font-medium text-[var(--fg)]">{l.staff.firstName} {l.staff.lastName}</div>
                      {l.staff.department && <div className="text-xs text-[var(--fg-muted)]">{l.staff.department}</div>}
                    </td>
                    <td className="px-5 py-3 text-[var(--fg-muted)]">{LEAVE_LABELS[l.leaveType]}</td>
                    <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell whitespace-nowrap">
                      {formatDate(l.startDate)} – {formatDate(l.endDate)}
                    </td>
                    <td className="px-5 py-3 text-center font-mono font-semibold text-[var(--fg)]">{l.days}</td>
                    <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell max-w-xs truncate">{l.reason ?? "—"}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`badge inline-flex items-center gap-1 ${sm.cls}`}>
                        <Icon className="h-3 w-3" /> {sm.label}
                      </span>
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
