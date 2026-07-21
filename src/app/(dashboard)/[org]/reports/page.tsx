import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, FileText, Download, BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports — Lerato Platform" };

const TYPE_STYLE: Record<string, string> = {
  FIFA_COMPLIANCE:    "bg-blue-100 text-blue-800",
  FKF_COMPLIANCE:     "bg-green-100 text-green-800",
  BOARD_QUARTERLY:    "bg-purple-100 text-purple-900",
  DONOR_ANNUAL:       "bg-amber-100 text-amber-900",
  GRANT_FUNDER:       "bg-orange-100 text-orange-900",
  REGULATOR:          "bg-red-100 text-red-800",
  INTERNAL:           "bg-gray-100 text-gray-800",
  FINANCE_STATEMENT:  "bg-emerald-100 text-emerald-800",
  HR_PAYROLL:         "bg-teal-100 text-teal-800",
  PROCUREMENT_SUMMARY:"bg-indigo-100 text-indigo-800",
  ASSET_REGISTER:     "bg-stone-100 text-stone-800",
  PROGRAMME_IMPACT:   "bg-pink-100 text-pink-800",
};

const DEPARTMENT_TABS = [
  { key: "",             label: "All"         },
  { key: "FINANCE",      label: "Finance"     },
  { key: "HR",           label: "HR"          },
  { key: "PROCUREMENT",  label: "Procurement" },
  { key: "PROGRAMMES",   label: "Programmes"  },
  { key: "ADMIN",        label: "Admin"       },
];

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ dept?: string }>;
}) {
  const { org } = await params;
  const { dept } = await searchParams;
  const ctx = await requireTenant(org);

  const reports = await dbRetry(() =>
    prisma.report.findMany({
      where: {
        organizationId: ctx.organization.id,
        ...(dept ? { department: dept } : {}),
      },
      orderBy: { generatedAt: "desc" },
      take: 100,
    })
  );

  const allReports = await dbRetry(() =>
    prisma.report.findMany({
      where: { organizationId: ctx.organization.id },
      select: { department: true },
    })
  );

  const deptCounts = DEPARTMENT_TABS.map(({ key, label }) => ({
    key,
    label,
    count: key === ""
      ? allReports.length
      : allReports.filter((r) => r.department === key).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Reports</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Compliance, board, donor, and departmental reports for {ctx.organization.shortName}.
          </p>
        </div>
        <Link href={`/${org}/reports/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Generate report
        </Link>
      </div>

      {/* Department tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
        {deptCounts.map(({ key, label, count }) => (
          <Link
            key={key}
            href={key ? `/${org}/reports?dept=${key}` as any : `/${org}/reports` as any}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
              (dept ?? "") === key
                ? "bg-[var(--bg)] text-[var(--fg)] shadow-sm"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                (dept ?? "") === key ? "bg-[var(--brand-primary)] text-white" : "bg-[var(--border)] text-[var(--fg-muted)]"
              }`}>
                {count}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-[var(--fg-muted)]" />
            <p className="mt-3 text-sm text-[var(--fg-muted)]">
              {dept ? `No ${dept.toLowerCase()} reports yet.` : "No reports generated yet."}
            </p>
            <Link href={`/${org}/reports/new` as any} className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Generate the first one
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Title</th>
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-left font-medium hidden md:table-cell">Department</th>
                <th className="px-6 py-3 text-left font-medium hidden md:table-cell">Period</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Generated</th>
                <th className="px-6 py-3 text-right font-medium">Download</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                  <td className="px-6 py-3 font-medium text-[var(--fg)]">{r.title}</td>
                  <td className="px-6 py-3">
                    <span className={`badge ${TYPE_STYLE[r.type] ?? "bg-gray-100 text-gray-800"}`}>
                      {r.type.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 hidden md:table-cell">
                    {r.department ? (
                      <span className="badge bg-[var(--bg-muted)] text-[var(--fg-muted)]">{r.department}</span>
                    ) : (
                      <span className="text-[var(--fg-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-[var(--fg-muted)] hidden md:table-cell">
                    {formatDate(r.periodStart)} — {formatDate(r.periodEnd)}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`badge ${r.status === "FINAL" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>
                      {r.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-[var(--fg-muted)]">{formatDate(r.generatedAt)}</td>
                  <td className="px-6 py-3 text-right">
                    {r.fileUrl ? (
                      <a href={r.fileUrl} className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline" target="_blank" rel="noopener">
                        <Download className="h-3 w-3" /> PDF
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--fg-muted)]">—</span>
                    )}
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
