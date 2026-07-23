import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { Plus, Upload, BarChart2 } from "lucide-react";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { fullName, formatDate } from "@/lib/utils";
import { BeneficiaryFilters } from "./beneficiaries-filters";

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
  searchParams: Promise<{ q?: string; category?: string; school?: string; area?: string; status?: string }>;
}) {
  const { org } = await params;
  const { q, category, school, area, status } = await searchParams;
  const ctx = await requireTenant(org);
  const isAcademy = ctx.organization.type === "ACADEMY";
  const canWrite = can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE);

  const where: Prisma.BeneficiaryWhereInput = {
    organizationId: ctx.organization.id,
    deletedAt: null,
    ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
    ...(area ? { county: { contains: area, mode: "insensitive" } } : {}),
    ...(school ? { studentProfile: { school: { contains: school, mode: "insensitive" } } } : {}),
    ...((category || status) ? {
      athleteProfile: {
        ...(category ? { characterNotes: { contains: category, mode: "insensitive" } } : {}),
        ...(status ? { registrationStatus: { equals: status, mode: "insensitive" } } : {}),
      },
    } : {}),
    ...(q ? {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { nationalId: { contains: q } },
        { phone: { contains: q } },
        { county: { contains: q, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [beneficiaries, schools, areas] = await Promise.all([
    dbRetry(() => prisma.beneficiary.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { athleteProfile: true, studentProfile: true },
    })),
    isAcademy
      ? dbRetry(() => prisma.studentProfile.findMany({
          where: { beneficiary: { organizationId: ctx.organization.id, deletedAt: null }, school: { not: null } },
          select: { school: true },
          distinct: ["school"],
          orderBy: { school: "asc" },
        }))
      : Promise.resolve([] as { school: string | null }[]),
    isAcademy
      ? dbRetry(() => prisma.beneficiary.findMany({
          where: { organizationId: ctx.organization.id, deletedAt: null, county: { not: null } },
          select: { county: true },
          distinct: ["county"],
          orderBy: { county: "asc" },
        }))
      : Promise.resolve([] as { county: string | null }[]),
  ]);

  const noun = isAcademy ? "players" : "beneficiaries";
  const nounSingular = isAcademy ? "player" : "beneficiary";

  const scopedBranch = ctx.branchId
    ? await dbRetry(() => prisma.branch.findUnique({ where: { id: ctx.branchId! }, select: { name: true } }))
    : null;

  const activeFilterCount = [q, category, school, area, status].filter(Boolean).length;

  const schoolList = schools.map((s) => s.school).filter((s): s is string => s !== null);
  const areaList = areas.map((a) => a.county).filter((a): a is string => a !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)] capitalize">{noun}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {isAcademy
              ? `Player database — ${scopedBranch ? scopedBranch.name : ctx.organization.shortName}`
              : `Students, players, and programme participants registered with ${ctx.organization.shortName}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      <form className="card !p-3 space-y-0">
        <input
          name="q"
          defaultValue={q}
          placeholder={isAcademy ? "Search by name, county, phone…" : "Search by name, ID number, or phone…"}
          className="w-full !border-0 !p-2"
        />
        {isAcademy && (
          <BeneficiaryFilters
            schools={schoolList}
            areas={areaList}
            current={{ q, category, school, area, status }}
          />
        )}
      </form>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {beneficiaries.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-[var(--fg-muted)]">No {noun} match your search.</p>
              {activeFilterCount === 0 && (
                <Link href={`/${org}/beneficiaries/new` as any} className="btn-primary mt-4 inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add the first one
                </Link>
              )}
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
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {beneficiaries.map((b) => {
                  const age = b.dateOfBirth
                    ? Math.floor((Date.now() - new Date(b.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                    : null;
                  const regStatus = b.athleteProfile?.registrationStatus;
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
                      <td className="px-6 py-3">
                        {regStatus ? (
                          <span className={`badge ${
                            regStatus.toLowerCase().includes("full")
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {regStatus}
                          </span>
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
      </div>

      <p className="text-xs text-[var(--fg-muted)]">
        Showing {beneficiaries.length} record{beneficiaries.length !== 1 ? "s" : ""}
        {activeFilterCount > 0 ? ` (${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} applied)` : ""}.
        {beneficiaries.length === 200 ? " Limit reached — use filters to narrow." : ""}
      </p>
    </div>
  );
}
