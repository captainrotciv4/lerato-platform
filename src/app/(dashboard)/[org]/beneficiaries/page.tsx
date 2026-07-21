import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, Upload, BarChart2 } from "lucide-react";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { fullName, formatDate } from "@/lib/utils";

export const metadata = { title: "Beneficiaries — Lerato Platform" };

const POSITIONS: Record<string, string> = {
  GK: "GK", CB: "CB", LB: "LB", RB: "RB", LWB: "LWB", RWB: "RWB",
  CDM: "CDM", CM: "CM", CAM: "CAM", LM: "LM", RM: "RM",
  LW: "LW", RW: "RW", CF: "CF", ST: "ST",
};

export default async function BeneficiariesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { org } = await params;
  const { q } = await searchParams;
  const ctx = await requireTenant(org);
  const isAcademy = ctx.organization.type === "ACADEMY";
  const canWrite = can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE);

  const beneficiaries = await dbRetry(() => prisma.beneficiary.findMany({
    where: {
      organizationId: ctx.organization.id,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { nationalId: { contains: q } },
              { phone: { contains: q } },
              { county: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { athleteProfile: true, studentProfile: true },
  }));

  const noun = isAcademy ? "players" : "beneficiaries";
  const nounSingular = isAcademy ? "player" : "beneficiary";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)] capitalize">{noun}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {isAcademy
              ? `Player database — ${ctx.organization.shortName}`
              : `Students, players, and programme participants registered with ${ctx.organization.shortName}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${org}/beneficiaries/report` as any} className="btn-secondary inline-flex items-center gap-2">
            <BarChart2 className="h-4 w-4" /> Report
          </Link>
          {canWrite && (
            <Link href={`/${org}/beneficiaries/upload` as any} className="btn-secondary inline-flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import CSV
            </Link>
          )}
          <Link href={`/${org}/beneficiaries/new` as any} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add {nounSingular}
          </Link>
        </div>
      </div>

      {/* Search */}
      <form className="card !p-3">
        <input
          name="q"
          defaultValue={q}
          placeholder={isAcademy ? "Search by name, county, phone…" : "Search by name, ID number, or phone…"}
          className="w-full !border-0 !p-2"
        />
      </form>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {beneficiaries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--fg-muted)]">No {noun} match your search.</p>
            <Link
              href={`/${org}/beneficiaries/new` as any}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add the first one
            </Link>
          </div>
        ) : isAcademy ? (
          /* Academy / player-database table */
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">Age</th>
                <th className="px-6 py-3 text-left font-medium">Position</th>
                <th className="px-6 py-3 text-left font-medium">Foot</th>
                <th className="px-6 py-3 text-left font-medium">School</th>
                <th className="px-6 py-3 text-left font-medium">Area</th>
                <th className="px-6 py-3 text-left font-medium">Guardian</th>
                <th className="px-6 py-3 text-right font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((b) => {
                const age = b.dateOfBirth
                  ? Math.floor((Date.now() - new Date(b.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                  : null;
                return (
                  <tr key={b.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-3">
                      <Link
                        href={`/${org}/beneficiaries/${b.id}` as any}
                        className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)] hover:underline"
                      >
                        {fullName(b.firstName, b.middleName, b.lastName)}
                      </Link>
                      {b.athleteProfile?.currentClub && (
                        <div className="text-xs text-[var(--fg-muted)]">{b.athleteProfile.currentClub}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">
                      {age != null ? `${age}y` : "—"}
                    </td>
                    <td className="px-6 py-3">
                      {b.athleteProfile?.position ? (
                        <span className="badge bg-[var(--bg-muted)] text-[var(--fg)]">
                          {POSITIONS[b.athleteProfile.position] ?? b.athleteProfile.position}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)] capitalize">
                      {b.athleteProfile?.preferredFoot
                        ? b.athleteProfile.preferredFoot.toLowerCase()
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">
                      {b.studentProfile?.school || "—"}
                      {b.studentProfile?.grade && (
                        <div className="text-xs">{b.studentProfile.grade}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">{b.county || "—"}</td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">
                      {b.guardianName ? (
                        <>
                          {b.guardianName}
                          {b.guardianPhone && <div className="text-xs">{b.guardianPhone}</div>}
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-3 text-right text-[var(--fg-muted)]">
                      {formatDate(b.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Default beneficiaries table */
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-left font-medium">Gender</th>
                <th className="px-6 py-3 text-left font-medium">County</th>
                <th className="px-6 py-3 text-left font-medium">Guardian</th>
                <th className="px-6 py-3 text-right font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((b) => (
                <tr key={b.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                  <td className="px-6 py-3">
                    <Link
                      href={`/${org}/beneficiaries/${b.id}` as any}
                      className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)] hover:underline"
                    >
                      {fullName(b.firstName, b.middleName, b.lastName)}
                    </Link>
                    {b.nationalId && (
                      <div className="text-xs text-[var(--fg-muted)]">ID: {b.nationalId}</div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {b.athleteProfile ? (
                      <span className="badge bg-green-100 text-green-800">Athlete</span>
                    ) : b.studentProfile ? (
                      <span className="badge bg-blue-100 text-blue-800">Student</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-800">Beneficiary</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">
                    {b.gender.toLowerCase().replace("_", " ")}
                  </td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">{b.county || "—"}</td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">
                    {b.guardianName ? (
                      <>
                        {b.guardianName}
                        {b.guardianPhone && <div className="text-xs">{b.guardianPhone}</div>}
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-6 py-3 text-right text-[var(--fg-muted)]">
                    {formatDate(b.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-[var(--fg-muted)]">
        Showing up to 100 records. Use the search box to narrow. Bulk CSV import: Phase 3 deliverable.
      </p>
    </div>
  );
}
