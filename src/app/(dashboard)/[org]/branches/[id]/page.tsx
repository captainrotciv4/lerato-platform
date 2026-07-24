import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Users, ShieldCheck, Edit, ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { fullName, formatDate } from "@/lib/utils";
import { updateBranch } from "../actions";

export const metadata = { title: "Branch — Lerato Platform" };

const SESSION_TYPE_LABEL: Record<string, string> = {
  TRAINING: "Training",
  MATCH: "Match",
  FITNESS: "Fitness",
  CAMP: "Camp",
  ASSESSMENT: "Assessment",
};

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  const [branch, sessions] = await dbRetry(() =>
    Promise.all([
      prisma.branch.findFirst({
        where: { id, organizationId: ctx.organization.id },
        include: {
          beneficiaries: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { athleteProfile: true },
          },
          staff: {
            where: { deletedAt: null, active: true },
            orderBy: { lastName: "asc" },
            take: 50,
          },
        },
      }),
      prisma.trainingSession.findMany({
        where: { branchId: id },
        orderBy: { date: "desc" },
        take: 20,
        include: {
          attendances: { select: { beneficiaryId: true, present: true } },
        },
      }),
    ])
  );

  if (!branch) notFound();

  const totalSessions = sessions.length;

  // Per-player attendance stats
  const playerStats = branch.beneficiaries.map((b) => {
    const sessionsWherePresent = sessions.filter((s) =>
      s.attendances.find((a) => a.beneficiaryId === b.id && a.present)
    ).length;
    const sessionsWithPlayer = sessions.filter((s) =>
      s.attendances.find((a) => a.beneficiaryId === b.id)
    ).length;
    const rate = sessionsWithPlayer > 0
      ? Math.round((sessionsWherePresent / sessionsWithPlayer) * 100)
      : null;
    return { ...b, sessionsPresent: sessionsWherePresent, sessionsTotal: sessionsWithPlayer, rate };
  });

  const branchTheme = {
    "--brand-primary": branch.primaryColor,
    "--brand-accent": branch.accentColor,
  } as React.CSSProperties;

  return (
    <div className="space-y-6" style={branchTheme}>
      <Link
        href={`/${org}/branches` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> All branches
      </Link>

      {/* Header */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-[var(--fg)]">{branch.name}</h1>
              {branch.isMain && (
                <span className="badge bg-[var(--brand-primary)] text-white">Main Academy</span>
              )}
              {!branch.active && (
                <span className="badge bg-gray-100 text-gray-500">Inactive</span>
              )}
            </div>
            {branch.location && (
              <div className="mt-1 flex items-center gap-1 text-sm text-[var(--fg-muted)]">
                <MapPin className="h-4 w-4" />
                {branch.location}{branch.county ? `, ${branch.county}` : ""}
              </div>
            )}
            {branch.description && (
              <p className="mt-2 text-sm text-[var(--fg-muted)]">{branch.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Take rollcall CTA */}
            <Link
              href={`/${org}/branches/${id}/rollcall/new` as any}
              className="btn-primary inline-flex items-center gap-2 text-sm"
              style={{ background: branch.primaryColor }}
            >
              <ClipboardList className="h-4 w-4" /> Take rollcall
            </Link>

            {/* Edit form (inline) */}
            <details className="relative">
              <summary className="btn-secondary cursor-pointer list-none inline-flex items-center gap-2 text-sm">
                <Edit className="h-4 w-4" /> Edit
              </summary>
              <div className="absolute right-0 top-10 z-10 w-80 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 shadow-lg">
                <form
                  action={async (formData) => {
                    "use server";
                    await updateBranch(org, id, formData);
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-xs">Name</label>
                    <input name="name" defaultValue={branch.name} className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Location</label>
                    <input name="location" defaultValue={branch.location ?? ""} className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">County</label>
                    <input name="county" defaultValue={branch.county ?? ""} className="mt-1 w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Description</label>
                    <textarea name="description" defaultValue={branch.description ?? ""} rows={2} className="mt-1 w-full text-sm" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs">Primary colour</label>
                      <input name="primaryColor" type="color" defaultValue={branch.primaryColor} className="mt-1 h-8 w-full cursor-pointer rounded border border-[var(--border)] p-0.5" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs">Accent colour</label>
                      <input name="accentColor" type="color" defaultValue={branch.accentColor} className="mt-1 h-8 w-full cursor-pointer rounded border border-[var(--border)] p-0.5" />
                    </div>
                  </div>
                  <input type="hidden" name="isMain" value={branch.isMain ? "true" : "false"} />
                  <button type="submit" className="btn-primary w-full text-sm">Save changes</button>
                </form>
              </div>
            </details>
          </div>
        </div>

        <div className="flex gap-6 border-t border-[var(--border)] pt-4 text-sm">
          <div className="flex items-center gap-2 text-[var(--fg-muted)]">
            <Users className="h-4 w-4" />
            <span><strong className="text-[var(--fg)]">{branch.beneficiaries.length}</strong> players</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--fg-muted)]">
            <ShieldCheck className="h-4 w-4" />
            <span><strong className="text-[var(--fg)]">{branch.staff.length}</strong> staff</span>
          </div>
            <Link
            href={`/${org}/branches/${id}/rollcall` as any}
            className="flex items-center gap-2 text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <ClipboardList className="h-4 w-4" />
            <span><strong className="text-[var(--fg)]">{totalSessions}</strong> sessions logged</span>
            {sessions.some((s) => (s as any).status === "PENDING") && (
              <span className="badge bg-amber-100 text-amber-800 text-[10px]">
                {sessions.filter((s) => (s as any).status === "PENDING").length} pending
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance — scholarship view */}
        <div className="card !p-0 overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h2 className="font-display font-semibold text-[var(--fg)]">Player Attendance</h2>
            <span className="text-xs text-[var(--fg-muted)]">
              {totalSessions} session{totalSessions !== 1 && "s"} recorded — used for scholarship assessment
            </span>
          </div>
          {branch.beneficiaries.length === 0 ? (
            <p className="p-6 text-sm text-[var(--fg-muted)] text-center">No players assigned yet.</p>
          ) : totalSessions === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--fg-muted)]">
              No rollcalls taken yet.{" "}
              <Link href={`/${org}/branches/${id}/rollcall/new` as any} className="text-[var(--brand-primary)] hover:underline">
                Take the first one →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Player</th>
                  <th className="px-5 py-3 text-left font-medium">Position</th>
                  <th className="px-5 py-3 text-center font-medium">Attended</th>
                  <th className="px-5 py-3 text-center font-medium">Rate</th>
                  <th className="px-5 py-3 text-left font-medium">Eligibility</th>
                </tr>
              </thead>
              <tbody>
                {playerStats
                  .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))
                  .map((p) => {
                    const eligible = p.rate !== null && p.rate >= 75;
                    const marginal = p.rate !== null && p.rate >= 60 && p.rate < 75;
                    return (
                      <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                        <td className="px-5 py-3">
                          <Link
                            href={`/${org}/beneficiaries/${p.id}` as any}
                            className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)] hover:underline"
                          >
                            {fullName(p.firstName, p.middleName, p.lastName)}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-[var(--fg-muted)] text-xs">
                          {p.athleteProfile?.position || "—"}
                        </td>
                        <td className="px-5 py-3 text-center text-[var(--fg-muted)]">
                          {p.sessionsPresent} / {p.sessionsTotal}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {p.rate !== null ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-sm font-semibold ${
                                eligible ? "text-emerald-700" : marginal ? "text-amber-700" : "text-red-700"
                              }`}>
                                {p.rate}%
                              </span>
                              <div className="w-16 h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${p.rate}%`,
                                    background: eligible ? "#16A34A" : marginal ? "#D97706" : "#DC2626",
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--fg-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {p.sessionsTotal === 0 ? (
                            <span className="text-xs text-[var(--fg-muted)]">No data</span>
                          ) : eligible ? (
                            <span className="badge bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Eligible
                            </span>
                          ) : marginal ? (
                            <span className="badge bg-amber-100 text-amber-900">At risk</span>
                          ) : (
                            <span className="badge bg-red-100 text-red-800 inline-flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> Not eligible
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
          {totalSessions > 0 && (
            <div className="border-t border-[var(--border)] px-5 py-2.5 text-xs text-[var(--fg-muted)]">
              Scholarship eligibility threshold: ≥75% attendance. At risk: 60–74%. Not eligible: &lt;60%.
            </div>
          )}
        </div>

        {/* Players roster */}
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-display font-semibold text-[var(--fg)]">Players</h2>
            <Link href={`/${org}/beneficiaries` as any} className="text-xs text-[var(--brand-primary)] hover:underline">
              View all →
            </Link>
          </div>
          {branch.beneficiaries.length === 0 ? (
            <p className="p-6 text-sm text-[var(--fg-muted)] text-center">No players assigned to this branch yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {branch.beneficiaries.map((b) => (
                  <tr key={b.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/${org}/beneficiaries/${b.id}` as any}
                        className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)] hover:underline"
                      >
                        {fullName(b.firstName, b.middleName, b.lastName)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-[var(--fg-muted)]">
                      {b.athleteProfile?.position || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Staff */}
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-display font-semibold text-[var(--fg)]">Staff & Coaches</h2>
            <Link href={`/${org}/staff` as any} className="text-xs text-[var(--brand-primary)] hover:underline">
              View all →
            </Link>
          </div>
          {branch.staff.length === 0 ? (
            <p className="p-6 text-sm text-[var(--fg-muted)] text-center">No staff assigned to this branch yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {branch.staff.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-5 py-3">
                      <div className="font-medium text-[var(--fg)]">{s.firstName} {s.lastName}</div>
                      {s.position && <div className="text-xs text-[var(--fg-muted)]">{s.position}</div>}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-[var(--fg-muted)]">
                      {s.type.toLowerCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div className="card !p-0 overflow-hidden lg:col-span-2">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="font-display font-semibold text-[var(--fg)]">Recent Sessions</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                  <th className="px-5 py-3 text-left font-medium">Type</th>
                  <th className="px-5 py-3 text-center font-medium">Present</th>
                  <th className="px-5 py-3 text-center font-medium">Absent</th>
                  <th className="px-5 py-3 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const present = s.attendances.filter((a) => a.present).length;
                  const absent = s.attendances.length - present;
                  return (
                    <tr key={s.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                      <td className="px-5 py-3 font-medium text-[var(--fg)]">{formatDate(s.date)}</td>
                      <td className="px-5 py-3">
                        <span className="badge bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                          {SESSION_TYPE_LABEL[s.sessionType] ?? s.sessionType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="font-semibold text-emerald-700">{present}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`font-semibold ${absent > 0 ? "text-red-700" : "text-[var(--fg-muted)]"}`}>{absent}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--fg-muted)] max-w-xs truncate">
                        {s.notes || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
