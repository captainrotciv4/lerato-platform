import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, Banknote, CheckCircle, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { createPayrollRecord, approvePayroll, markPayrollPaid } from "../actions";

export const metadata = { title: "Payroll — Lerato Platform" };

const STATUS_META: Record<string, { cls: string; label: string }> = {
  DRAFT:    { cls: "bg-gray-100 text-gray-700",       label: "Draft"    },
  APPROVED: { cls: "bg-amber-100 text-amber-900",     label: "Approved" },
  PAID:     { cls: "bg-emerald-100 text-emerald-800", label: "Paid"     },
};

function fmt(n: number | string, currency = "KES") {
  const num = typeof n === "string" ? parseFloat(n) : Number(n);
  if (isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

export default async function PayrollPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canManage = ctx.role === "ADMIN" || ctx.role === "FINANCE_LEAD";

  const [payrollRecords, staff] = await dbRetry(() =>
    Promise.all([
      prisma.payrollRecord.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: [{ period: "desc" }, { status: "asc" }],
        include: { staff: { select: { firstName: true, lastName: true, position: true, department: true } } },
      }),
      prisma.staffVolunteer.findMany({
        where: { organizationId: ctx.organization.id, active: true, type: "EMPLOYEE", deletedAt: null },
        orderBy: { lastName: "asc" },
        select: { id: true, firstName: true, lastName: true, position: true },
      }),
    ])
  );

  const periods = [...new Set(payrollRecords.map((p) => p.period))].sort().reverse();
  const latestPeriod = periods[0];

  const periodGroups = periods.map((period) => ({
    period,
    records: payrollRecords.filter((p) => p.period === period),
    total: payrollRecords.filter((p) => p.period === period).reduce((s, p) => s + Number(p.netSalary), 0),
    gross: payrollRecords.filter((p) => p.period === period).reduce((s, p) => s + Number(p.grossSalary), 0),
  }));

  return (
    <div className="space-y-6">
      <Link href={`/${org}/hr` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to HR
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Payroll</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{periods.length} period{periods.length !== 1 && "s"} · {staff.length} employees</p>
        </div>
        {canManage && staff.length > 0 && (
          <details className="relative">
            <summary className="btn-primary cursor-pointer list-none inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Add payroll record
            </summary>
            <div className="absolute right-0 top-11 z-20 w-96 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-xl space-y-3">
              <h3 className="font-semibold text-[var(--fg)]">Payroll record</h3>
              <form action={async (fd) => { "use server"; await createPayrollRecord(org, fd); }} className="space-y-3">
                <div>
                  <label className="text-xs">Employee *</label>
                  <select name="staffId" required className="mt-1 w-full text-sm">
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs">Period (YYYY-MM) *</label>
                  <input name="period" placeholder="2026-06" pattern="\d{4}-\d{2}" required className="mt-1 w-full text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs">Gross salary (KES) *</label>
                  <input name="grossSalary" type="number" step="0.01" min="0" required className="mt-1 w-full text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs">NHIF</label>
                    <input name="nhif" type="number" step="0.01" min="0" placeholder="0" className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">NSSF</label>
                    <input name="nssf" type="number" step="0.01" min="0" placeholder="0" className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">PAYE</label>
                    <input name="paye" type="number" step="0.01" min="0" placeholder="0" className="mt-1 w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs">Other deductions</label>
                  <input name="otherDeductions" type="number" step="0.01" min="0" placeholder="0" className="mt-1 w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs">Notes</label>
                  <input name="notes" className="mt-1 w-full text-sm" />
                </div>
                <button type="submit" className="btn-primary w-full text-sm">Save record</button>
              </form>
            </div>
          </details>
        )}
      </div>

      {payrollRecords.length === 0 ? (
        <div className="card py-16 text-center">
          <Banknote className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-30" />
          <p className="mt-3 text-sm text-[var(--fg-muted)]">No payroll records yet.</p>
        </div>
      ) : (
        periodGroups.map(({ period, records, total, gross }) => (
          <div key={period} className="card !p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-muted)] px-5 py-4">
              <div className="flex items-center gap-3">
                <Banknote className="h-4 w-4 text-[var(--fg-muted)]" />
                <h2 className="font-display font-semibold text-[var(--fg)]">
                  {period.replace("-", " / ")}
                </h2>
                <span className="text-xs text-[var(--fg-muted)]">{records.length} staff</span>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-[var(--fg)]">{fmt(total)} net</div>
                <div className="text-xs text-[var(--fg-muted)]">{fmt(gross)} gross</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-2.5 text-left font-semibold">Employee</th>
                  <th className="px-5 py-2.5 text-right font-semibold hidden md:table-cell">Gross</th>
                  <th className="px-5 py-2.5 text-right font-semibold hidden md:table-cell">Deductions</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Net salary</th>
                  <th className="px-5 py-2.5 text-center font-semibold">Status</th>
                  {canManage && <th className="px-5 py-2.5 text-center font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {records.map((r) => {
                  const deductions = Number(r.nhif) + Number(r.nssf) + Number(r.paye) + Number(r.otherDeductions);
                  const sm = STATUS_META[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-[var(--bg-muted)]">
                      <td className="px-5 py-3">
                        <div className="font-medium text-[var(--fg)]">{r.staff.firstName} {r.staff.lastName}</div>
                        {r.staff.position && <div className="text-xs text-[var(--fg-muted)]">{r.staff.position}</div>}
                      </td>
                      <td className="px-5 py-3 text-right font-mono hidden md:table-cell">{fmt(Number(r.grossSalary), r.currency)}</td>
                      <td className="px-5 py-3 text-right font-mono text-red-700 hidden md:table-cell">−{fmt(deductions, r.currency)}</td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-emerald-700">{fmt(Number(r.netSalary), r.currency)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`badge ${sm.cls}`}>{sm.label}</span>
                      </td>
                      {canManage && (
                        <td className="px-5 py-3 text-center">
                          {r.status === "DRAFT" && (
                            <form action={async () => { "use server"; await approvePayroll(org, r.id); }}>
                              <button type="submit" className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600">
                                Approve
                              </button>
                            </form>
                          )}
                          {r.status === "APPROVED" && (
                            <form action={async () => { "use server"; await markPayrollPaid(org, r.id); }}>
                              <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                                Mark paid
                              </button>
                            </form>
                          )}
                          {r.status === "PAID" && r.paidAt && (
                            <span className="flex items-center justify-center gap-1 text-xs text-emerald-700">
                              <CheckCircle className="h-3 w-3" /> {formatDate(r.paidAt)}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
