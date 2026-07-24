import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, CheckCircle2, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { approveRollcall } from "./actions";

export const metadata = { title: "Rollcalls — Lerato Platform" };

const SESSION_TYPE_LABEL: Record<string, string> = {
  TRAINING: "Training",
  MATCH: "Match",
  FITNESS: "Fitness",
  CAMP: "Camp",
  ASSESSMENT: "Assessment",
};

export default async function RollcallListPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  const branch = await dbRetry(() =>
    prisma.branch.findFirst({
      where: { id, organizationId: ctx.organization.id },
      select: { id: true, name: true, primaryColor: true, accentColor: true },
    })
  );
  if (!branch) notFound();

  const sessions = await dbRetry(() =>
    prisma.trainingSession.findMany({
      where: { branchId: id },
      orderBy: { date: "desc" },
      include: {
        attendances: { select: { present: true } },
      },
    })
  );

  const canApprove = can(ctx.role, ctx.permissions, PERMISSIONS.BRANCH_WRITE);
  const pendingCount = sessions.filter((s) => (s as any).status === "PENDING").length;

  const branchTheme = {
    "--brand-primary": branch.primaryColor,
    "--brand-accent": branch.accentColor,
  } as React.CSSProperties;

  return (
    <div className="space-y-6" style={branchTheme}>
      <Link
        href={`/${org}/branches/${id}` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {branch.name}
      </Link>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Rollcalls</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {branch.name} · {sessions.length} session{sessions.length !== 1 ? "s" : ""}
            {pendingCount > 0 && (
              <span className="ml-2 badge bg-amber-100 text-amber-800">
                {pendingCount} pending approval
              </span>
            )}
          </p>
        </div>
        <Link
          href={`/${org}/branches/${id}/rollcall/new` as any}
          className="btn-primary inline-flex items-center gap-2 text-sm"
          style={{ background: branch.primaryColor }}
        >
          <ClipboardList className="h-4 w-4" /> Take rollcall
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-40" />
          <p className="mt-3 text-sm text-[var(--fg-muted)]">No rollcalls recorded yet.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                  <th className="px-5 py-3 text-left font-medium">Type</th>
                  <th className="px-5 py-3 text-center font-medium">Present</th>
                  <th className="px-5 py-3 text-center font-medium">Absent</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Notes</th>
                  {canApprove && <th className="px-5 py-3 text-right font-medium">Action</th>}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const present = s.attendances.filter((a) => a.present).length;
                  const absent = s.attendances.length - present;
                  const status = (s as any).status ?? "PENDING";
                  const isPending = status === "PENDING";
                  return (
                    <tr key={s.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                      <td className="px-5 py-3 font-medium text-[var(--fg)] whitespace-nowrap">
                        {formatDate(s.date)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="badge bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                          {SESSION_TYPE_LABEL[s.sessionType] ?? s.sessionType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="font-semibold text-emerald-700">{present}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`font-semibold ${absent > 0 ? "text-red-700" : "text-[var(--fg-muted)]"}`}>
                          {absent}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {isPending ? (
                          <span className="badge bg-amber-100 text-amber-800 inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        ) : (
                          <span className="badge bg-emerald-100 text-emerald-800 inline-flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 className="h-3 w-3" /> Approved
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--fg-muted)] max-w-xs truncate">
                        {s.notes || "—"}
                      </td>
                      {canApprove && (
                        <td className="px-5 py-3 text-right">
                          {isPending ? (
                            <form
                              action={async () => {
                                "use server";
                                await approveRollcall(org, id, s.id);
                              }}
                            >
                              <button
                                type="submit"
                                className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                              >
                                Approve
                              </button>
                            </form>
                          ) : (
                            <span className="text-xs text-[var(--fg-muted)]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
