import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { ExportActions } from "./export-actions";

export const metadata = { title: "Player Report — Lerato Platform" };

const POSITIONS: Record<string, string> = {
  GK: "GK", CB: "CB", LB: "LB", RB: "RB", LWB: "LWB", RWB: "RWB",
  CDM: "CDM", CM: "CM", CAM: "CAM", LM: "LM", RM: "RM",
  LW: "LW", RW: "RW", CF: "CF", ST: "ST",
};

const AGE_BRACKETS: Record<string, [number, number]> = {
  U10: [0, 10], U12: [10, 12], U14: [12, 14],
  U16: [14, 16], U18: [16, 18], Senior: [18, 120],
};

const REC_STYLES: Record<string, { cls: string; label: string }> = {
  SIGN:         { cls: "bg-emerald-100 text-emerald-800", label: "Sign" },
  MONITOR:      { cls: "bg-amber-100 text-amber-800",    label: "Monitor" },
  DECLINE:      { cls: "bg-red-100 text-red-800",        label: "Decline" },
  REVIEW_LATER: { cls: "bg-blue-100 text-blue-800",      label: "Review Later" },
};

function ageGroup(dob: Date): string {
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 10) return "U10";
  if (age < 12) return "U12";
  if (age < 14) return "U14";
  if (age < 16) return "U16";
  if (age < 18) return "U18";
  return "Senior";
}

export default async function PlayerReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ position?: string; ageBracket?: string; county?: string; recommendation?: string }>;
}) {
  const { org }                                          = await params;
  const { position = "", ageBracket = "", county = "", recommendation = "" } = await searchParams;
  const ctx                                              = await requireTenant(org);
  const isAcademy                                        = ctx.organization.type === "ACADEMY";

  // ── Build query ──────────────────────────────────────────────────
  const where: Record<string, unknown> = { organizationId: ctx.organization.id, deletedAt: null };
  if (position) where.athleteProfile = { position };
  if (county)   where.county = { contains: county, mode: "insensitive" };
  if (ageBracket && AGE_BRACKETS[ageBracket]) {
    const [min, max] = AGE_BRACKETS[ageBracket];
    const today = new Date();
    where.dateOfBirth = {
      gte: new Date(today.getFullYear() - max, today.getMonth(), today.getDate()),
      lt:  new Date(today.getFullYear() - min, today.getMonth(), today.getDate()),
    };
  }

  const all = await dbRetry(() =>
    prisma.beneficiary.findMany({
      where: where as any,
      include: {
        athleteProfile: true,
        studentProfile: true,
        scoutReports: { orderBy: { reportDate: "desc" }, take: 1 },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    })
  );

  // Apply recommendation filter (requires post-query filtering on latest report)
  const players = recommendation === "NOT_ASSESSED"
    ? all.filter(p => p.scoutReports.length === 0)
    : recommendation
    ? all.filter(p => p.scoutReports[0]?.recommendation === recommendation)
    : all;

  // ── Summary stats ────────────────────────────────────────────────
  const byStatus = { SIGN: 0, MONITOR: 0, DECLINE: 0, REVIEW_LATER: 0, NOT_ASSESSED: 0 };
  const byBracket: Record<string, number> = { U10: 0, U12: 0, U14: 0, U16: 0, U18: 0, Senior: 0 };
  const byPosition: Record<string, number> = {};
  for (const p of players) {
    const rec = p.scoutReports[0]?.recommendation as keyof typeof byStatus | undefined;
    if (rec && rec in byStatus) byStatus[rec]++;
    else byStatus.NOT_ASSESSED++;
    if (p.dateOfBirth) {
      const bracket = ageGroup(new Date(p.dateOfBirth));
      byBracket[bracket] = (byBracket[bracket] ?? 0) + 1;
    }
    const pos = p.athleteProfile?.position;
    if (pos) byPosition[pos] = (byPosition[pos] ?? 0) + 1;
  }

  // ── Build CSV URL ────────────────────────────────────────────────
  const csvParams = new URLSearchParams();
  if (position)       csvParams.set("position", position);
  if (ageBracket)     csvParams.set("ageBracket", ageBracket);
  if (county)         csvParams.set("county", county);
  if (recommendation) csvParams.set("recommendation", recommendation);
  const csvUrl = `/api/${org}/beneficiaries/report?${csvParams}`;

  const noun = isAcademy ? "players" : "beneficiaries";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Back — hidden in print */}
      <div className="print:hidden flex items-center justify-between">
        <Link
          href={`/${org}/beneficiaries` as any}
          className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {noun}
        </Link>
      </div>

      {/* Report header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--fg-muted)] print:hidden" />
            <h1 className="font-display text-3xl font-bold text-[var(--fg)] capitalize">
              {isAcademy ? "Player Registry Report" : "Beneficiary Report"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {ctx.organization.name} · Generated {today} · {players.length} {noun}
            {position || ageBracket || county || recommendation ? " (filtered)" : ""}
          </p>
        </div>
      </div>

      {/* ── Filters — hidden in print ──────────────────────────────── */}
      <form method="GET" className="print:hidden card !p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Position */}
        <div>
          <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">Position</label>
          <select name="position" defaultValue={position} className="w-full text-sm">
            <option value="">All positions</option>
            {Object.entries(POSITIONS).map(([v, l]) => (
              <option key={v} value={v}>{l} ({v})</option>
            ))}
          </select>
        </div>
        {/* Age bracket */}
        <div>
          <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">Age group</label>
          <select name="ageBracket" defaultValue={ageBracket} className="w-full text-sm">
            <option value="">All ages</option>
            {Object.keys(AGE_BRACKETS).map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        {/* County */}
        <div>
          <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">County / area</label>
          <input name="county" defaultValue={county} placeholder="e.g. Nairobi" className="w-full text-sm" />
        </div>
        {/* Recommendation */}
        <div>
          <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1">Development status</label>
          <select name="recommendation" defaultValue={recommendation} className="w-full text-sm">
            <option value="">All statuses</option>
            <option value="SIGN">Sign</option>
            <option value="MONITOR">Monitor</option>
            <option value="DECLINE">Decline</option>
            <option value="REVIEW_LATER">Review Later</option>
            <option value="NOT_ASSESSED">Not assessed</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-4 flex items-center gap-2">
          <button type="submit" className="btn-primary text-sm">Apply filters</button>
          {(position || ageBracket || county || recommendation) && (
            <Link href={`/${org}/beneficiaries/report` as any} className="btn-secondary text-sm">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* ── Summary stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 print:grid-cols-5">
        {[
          { label: "Total",       val: players.length,          cls: "bg-[var(--bg-muted)]" },
          { label: "Sign",        val: byStatus.SIGN,           cls: "bg-emerald-50 text-emerald-800" },
          { label: "Monitor",     val: byStatus.MONITOR,        cls: "bg-amber-50 text-amber-800" },
          { label: "Decline",     val: byStatus.DECLINE,        cls: "bg-red-50 text-red-800" },
          { label: "Not assessed",val: byStatus.NOT_ASSESSED,   cls: "bg-gray-50 text-gray-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.cls}`}>
            <p className="text-2xl font-bold font-display">{s.val}</p>
            <p className="text-xs mt-1 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Age group breakdown */}
      {isAcademy && (
        <div className="card !p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)] mb-3">By age group</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(byBracket).filter(([, n]) => n > 0).map(([bracket, n]) => (
              <span key={bracket} className="badge bg-[var(--bg-muted)] text-[var(--fg)]">
                {bracket}: <strong>{n}</strong>
              </span>
            ))}
            {Object.values(byBracket).every(n => n === 0) && (
              <span className="text-sm text-[var(--fg-muted)]">No DOB data available</span>
            )}
          </div>
        </div>
      )}

      {/* ── Export actions — hidden in print ───────────────────────── */}
      <ExportActions
        org={org}
        csvUrl={csvUrl}
        currentFilters={{ position, ageBracket, county, recommendation }}
      />

      {/* ── Player table ───────────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden">
        {/* Print-only header */}
        <div className="hidden print:block p-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold">{ctx.organization.name} — Player Registry Report · {today}</p>
          {(position || ageBracket || county || recommendation) && (
            <p className="text-xs text-gray-500 mt-1">
              Filters: {[position && `Position: ${position}`, ageBracket && `Age: ${ageBracket}`, county && `County: ${county}`, recommendation && `Status: ${recommendation}`].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {players.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--fg-muted)]">No {noun} match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Reg No.</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Age</th>
                  <th className="px-4 py-3 text-left font-medium">Group</th>
                  <th className="px-4 py-3 text-left font-medium">Position</th>
                  <th className="px-4 py-3 text-left font-medium">School</th>
                  <th className="px-4 py-3 text-left font-medium">County</th>
                  <th className="px-4 py-3 text-left font-medium">Guardian</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium print:hidden">Registered</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => {
                  const dob = p.dateOfBirth ? new Date(p.dateOfBirth) : null;
                  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
                  const bracket = dob ? ageGroup(dob) : null;
                  const rec = p.scoutReports[0]?.recommendation;
                  const recStyle = rec ? REC_STYLES[rec] : null;
                  return (
                    <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)] print:hover:bg-transparent">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--fg-muted)]">
                        {p.admissionNo ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--fg)]">
                        <span className="print:inline hidden">{p.lastName}, {p.firstName} {p.middleName ?? ""}</span>
                        <Link
                          href={`/${org}/beneficiaries/${p.id}` as any}
                          className="print:hidden hover:text-[var(--brand-primary)] hover:underline"
                        >
                          {p.lastName}, {p.firstName}
                          {p.middleName ? ` ${p.middleName}` : ""}
                        </Link>
                        {p.birthCertNo && (
                          <div className="text-xs text-[var(--fg-muted)] print:block hidden">BC: {p.birthCertNo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">{age != null ? `${age}` : "—"}</td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">{bracket ?? "—"}</td>
                      <td className="px-4 py-3">
                        {p.athleteProfile?.position
                          ? <span className="badge bg-[var(--bg-muted)] text-[var(--fg)]">{p.athleteProfile.position}</span>
                          : <span className="text-[var(--fg-muted)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">
                        {p.studentProfile?.school ?? "—"}
                        {p.studentProfile?.grade && <div className="text-xs">{p.studentProfile.grade}</div>}
                      </td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">{p.county ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">
                        {p.guardianName ?? "—"}
                        {p.guardianPhone && <div className="text-xs">{p.guardianPhone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {recStyle
                          ? <span className={`badge ${recStyle.cls}`}>{recStyle.label}</span>
                          : <span className="badge bg-gray-100 text-gray-500">Not assessed</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--fg-muted)] text-xs print:hidden">
                        {new Date(p.createdAt).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--fg-muted)] print:block hidden">
        Lerato Platform · Confidential · {today}
      </p>
    </div>
  );
}
