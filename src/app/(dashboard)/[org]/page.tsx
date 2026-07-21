import { requireTenant } from "@/lib/tenant/context";
import { prisma } from "@/lib/db/prisma";
import { Users, Heart, GraduationCap, Plane } from "lucide-react";
import Link from "next/link";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  // Aggregate counts in parallel — gracefully degrade on DB blips
  const [beneficiaryCount, donorCount, programCount, missionCount, recentBeneficiaries] = await Promise.all([
    prisma.beneficiary.count({ where: { organizationId: ctx.organization.id, deletedAt: null } }).catch(() => 0),
    prisma.donorShare.count({ where: { organizationId: ctx.organization.id } }).catch(() => 0),
    prisma.program.count({ where: { organizationId: ctx.organization.id, deletedAt: null } }).catch(() => 0),
    prisma.mission.count({ where: { organizationId: ctx.organization.id } }).catch(() => 0),
    prisma.beneficiary.findMany({
      where: { organizationId: ctx.organization.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }).catch(() => []),
  ]);

  const stats = [
    { label: "Beneficiaries", value: beneficiaryCount, icon: Users, href: `/${org}/beneficiaries` },
    { label: "Donors", value: donorCount, icon: Heart, href: `/${org}/donors` },
    { label: "Programmes", value: programCount, icon: GraduationCap, href: `/${org}/education` },
    { label: "Missions", value: missionCount, icon: Plane, href: `/${org}/missions` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">{ctx.organization.name}</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Welcome back, {ctx.user.name.split(" ")[0]}. You&apos;re signed in as <span className="font-medium">{ctx.role.replace("_", " ").toLowerCase()}</span>.
        </p>
        {ctx.organization.description && (
          <p className="mt-3 max-w-2xl text-sm text-[var(--fg-muted)] leading-relaxed">
            {ctx.organization.description}
          </p>
        )}
        {ctx.organization.launchDate && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 px-3 py-1 text-xs font-medium text-[var(--brand-primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" />
            Official Launch: {new Date(ctx.organization.launchDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href as any} className="card transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">{s.label}</div>
                  <div className="mt-1 font-display text-3xl font-bold text-[var(--fg)]">{s.value}</div>
                </div>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-md text-white"
                  style={{ background: ctx.organization.primaryColor }}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent beneficiaries */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[var(--fg)]">Recent beneficiaries</h2>
          <Link href={`/${org}/beneficiaries` as any} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
            View all →
          </Link>
        </div>
        {recentBeneficiaries.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-sm text-[var(--fg-muted)]">No beneficiaries yet.</p>
            <Link
              href={`/${org}/beneficiaries/new` as any}
              className="btn-primary mt-3 inline-block"
            >
              Add the first one
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="py-2 text-left font-medium">Name</th>
                <th className="py-2 text-left font-medium">Gender</th>
                <th className="py-2 text-left font-medium">County</th>
                <th className="py-2 text-right font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {recentBeneficiaries.map((b) => (
                <tr key={b.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 font-medium text-[var(--fg)]">{b.firstName} {b.lastName}</td>
                  <td className="py-3 text-[var(--fg-muted)]">{b.gender.toLowerCase().replace("_", " ")}</td>
                  <td className="py-3 text-[var(--fg-muted)]">{b.county || "—"}</td>
                  <td className="py-3 text-right text-[var(--fg-muted)]">
                    {b.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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
