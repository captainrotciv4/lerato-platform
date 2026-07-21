import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Programmes — Lerato Platform" };

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-amber-100 text-amber-900",
  COMPLETED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function ProgrammesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const programs = await dbRetry(() => prisma.program.findMany({
    where: { organizationId: ctx.organization.id, deletedAt: null },
    include: { _count: { select: { enrolments: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Programmes</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            All programmes running at {ctx.organization.shortName}: Education, Life, Sports, Mentorship, Community, Missions.
          </p>
        </div>
        <Link href={`/${org}/education/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New programme
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {programs.length === 0 ? (
          <div className="card md:col-span-2 lg:col-span-3 p-12 text-center text-sm text-[var(--fg-muted)]">
            No programmes yet.
          </div>
        ) : programs.map((p) => (
          <div key={p.id} className="card flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">{p.type.replace("_", " ").toLowerCase()}</div>
                <h3 className="mt-1 font-display text-lg font-semibold text-[var(--fg)]">{p.name}</h3>
              </div>
              <span className={`badge ${STATUS_STYLE[p.status]}`}>{p.status.toLowerCase()}</span>
            </div>
            {p.description && <p className="mt-2 text-sm text-[var(--fg-muted)]">{p.description}</p>}
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--fg-muted)]">
              <span>{p._count.enrolments} enrolled</span>
              <span>Started {formatDate(p.startDate)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
