import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Users2, CalendarMinus, Banknote, CheckCircle, Clock, XCircle, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "HR & People — Lerato Platform" };

const STAFF_TYPE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee", VOLUNTEER: "Volunteer", COACH: "Coach",
  MENTOR: "Mentor", INTERN: "Intern", CONSULTANT: "Consultant",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Annual", SICK: "Sick", MATERNITY: "Maternity",
  PATERNITY: "Paternity", COMPASSIONATE: "Compassionate", STUDY: "Study", UNPAID: "Unpaid",
};

function fmt(n: number, currency = "KES") {
  return `${currency} ${n.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default async function HRPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const [staff, leaveRequests, payrollRecords] = await dbRetry(() =>
    Promise.all([
      prisma.staffVolunteer.findMany({
        where: { organizationId: ctx.organization.id, active: true, deletedAt: null },
        orderBy: [{ type: "asc" }, { lastName: "asc" }],
      }),
      prisma.leaveRequest.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { staff: { select: { firstName: true, lastName: true, position: true } } },
      }),
      prisma.payrollRecord.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { period: "desc" },
        take: 6,
      }),
    ])
  );

  const pendingLeave = leaveRequests.filter((l) => l.status === "PENDING").length;
  const latestPeriod = payrollRecords[0]?.period;
  const periodPayroll = payrollRecords.filter((p) => p.period === latestPeriod);
  const totalPayroll = periodPayroll.reduce((s, p) => s + Number(p.netSalary), 0);

  const byType = Object.entries(STAFF_TYPE_LABELS).map(([type, label]) => ({
    type, label, count: staff.filter((s) => s.type === type).length,
  })).filter((t) => t.count > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">HR & People</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Staff management, leave &amp; payroll for {ctx.organization.shortName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${org}/hr/leave` as any} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <CalendarMinus className="h-4 w-4" /> Leave
          </Link>
          <Link href={`/${org}/hr/payroll` as any} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Banknote className="h-4 w-4" /> Payroll
          </Link>
          <Link href={`/${org}/staff` as any} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Users2 className="h-4 w-4" /> Manage staff
          </Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPITile icon={Users2} label="Total headcount" value={String(staff.length)} sub="Active staff & volunteers" color="text-blue-700" bg="bg-blue-50" />
        <KPITile icon={Clock} label="Pending leave" value={String(pendingLeave)} sub="Awaiting approval" color={pendingLeave > 0 ? "text-amber-700" : "text-[var(--fg-muted)]"} bg={pendingLeave > 0 ? "bg-amber-50" : "bg-[var(--bg-muted)]"} />
        <KPITile icon={Banknote} label="Latest payroll" value={latestPeriod ? fmt(totalPayroll) : "—"} sub={latestPeriod ? `Period ${latestPeriod}` : "No payroll yet"} color="text-emerald-700" bg="bg-emerald-50" />
        <KPITile icon={TrendingUp} label="Employees" value={String(staff.filter((s) => s.type === "EMPLOYEE").length)} sub="On payroll" color="text-teal-700" bg="bg-teal-50" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Staff breakdown */}
        <div className="card space-y-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <Users2 className="h-4 w-4" /> Workforce breakdown
          </h2>
          <div className="space-y-2">
            {byType.map(({ type, label, count }) => (
              <div key={type} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[var(--bg-muted)]">
                <span className="text-sm text-[var(--fg)]">{label}</span>
                <span className="font-mono text-sm font-semibold text-[var(--fg)]">{count}</span>
              </div>
            ))}
            {byType.length === 0 && (
              <p className="text-sm text-[var(--fg-muted)] text-center py-4">No active staff.</p>
            )}
          </div>
          <Link href={`/${org}/staff` as any} className="block text-center text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">
            View all staff →
          </Link>
        </div>

        {/* Recent leave requests */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              <CalendarMinus className="h-4 w-4" /> Recent leave requests
            </h2>
            <Link href={`/${org}/hr/leave` as any} className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">View all →</Link>
          </div>
          {leaveRequests.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)] text-center py-4">No leave requests.</p>
          ) : (
            <div className="space-y-2">
              {leaveRequests.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-[var(--fg)]">{l.staff.firstName} {l.staff.lastName}</div>
                    <div className="text-xs text-[var(--fg-muted)]">{LEAVE_TYPE_LABELS[l.leaveType]} · {l.days} day{l.days !== 1 && "s"}</div>
                  </div>
                  <LeaveStatusBadge status={l.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Staff list */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Active staff</h2>
          <span className="text-xs text-[var(--fg-muted)]">{staff.length} people</span>
        </div>
        {staff.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No staff members yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Name</th>
                <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Type</th>
                <th className="px-5 py-3 text-left font-semibold hidden md:table-cell">Position</th>
                <th className="px-5 py-3 text-left font-semibold hidden lg:table-cell">Department</th>
                <th className="px-5 py-3 text-left font-semibold hidden lg:table-cell">Start date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--bg-muted)]">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[var(--fg)]">{s.firstName} {s.lastName}</div>
                    {s.email && <div className="text-xs text-[var(--fg-muted)]">{s.email}</div>}
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className="badge bg-[var(--bg-muted)] text-[var(--fg-muted)] text-xs">{STAFF_TYPE_LABELS[s.type]}</span>
                  </td>
                  <td className="px-5 py-3 text-[var(--fg-muted)] hidden md:table-cell">{s.position ?? "—"}</td>
                  <td className="px-5 py-3 text-[var(--fg-muted)] hidden lg:table-cell">{s.department ?? "—"}</td>
                  <td className="px-5 py-3 text-[var(--fg-muted)] hidden lg:table-cell">{s.startDate ? formatDate(s.startDate) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LeaveStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { cls: string; icon: any }> = {
    PENDING:   { cls: "bg-amber-100 text-amber-900",   icon: Clock },
    APPROVED:  { cls: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
    REJECTED:  { cls: "bg-red-100 text-red-800",       icon: XCircle },
    CANCELLED: { cls: "bg-gray-100 text-gray-600",     icon: XCircle },
  };
  const s = styles[status] ?? styles.PENDING;
  const Icon = s.icon;
  return (
    <span className={`badge inline-flex items-center gap-1 ${s.cls}`}>
      <Icon className="h-3 w-3" /> {status.toLowerCase()}
    </span>
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
