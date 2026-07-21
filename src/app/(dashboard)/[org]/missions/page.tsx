import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, Plane } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Missions — Lerato Platform" };

const STATUS_STYLE: Record<string, string> = {
  PLANNING: "bg-gray-100 text-gray-800",
  VISA_PROCESSING: "bg-amber-100 text-amber-900",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-900",
  COMPLETED: "bg-green-100 text-green-800",
  POSTPONED: "bg-orange-100 text-orange-900",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function MissionsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const missions = await dbRetry(() => prisma.mission.findMany({
    where: { organizationId: ctx.organization.id },
    include: { _count: { select: { delegates: true } } },
    orderBy: { departureDate: "desc" },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Missions</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            International engagements, delegations, and visa-processed trips.
          </p>
        </div>
        <Link href={`/${org}/missions/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New mission
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {missions.length === 0 ? (
          <div className="card md:col-span-2 p-12 text-center text-sm text-[var(--fg-muted)]">No missions planned yet.</div>
        ) : missions.map((m) => (
          <Link key={m.id} href={`/${org}/missions/${m.id}` as any} className="card transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">{m.type.replace("_", " ").toLowerCase()}</div>
                <h3 className="mt-1 font-display text-lg font-semibold text-[var(--fg)]">{m.name}</h3>
                <div className="mt-1 text-sm text-[var(--fg-muted)]">{m.destination}</div>
              </div>
              <span className={`badge ${STATUS_STYLE[m.status]}`}>{m.status.replace("_", " ").toLowerCase()}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--fg-muted)]">
              <span className="flex items-center gap-1"><Plane className="h-3 w-3" /> {m._count.delegates} delegate{m._count.delegates !== 1 && "s"}</span>
              <span>Departs {formatDate(m.departureDate)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
