import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Events — Lerato Platform" };

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-900",
  COMPLETED: "bg-green-100 text-green-800",
  POSTPONED: "bg-amber-100 text-amber-900",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function EventsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const events = await dbRetry(() => prisma.event.findMany({
    where: { organizationId: ctx.organization.id, deletedAt: null },
    orderBy: { startsAt: "asc" },
  }));

  const upcoming = events.filter(e => e.startsAt >= new Date());
  const past = events.filter(e => e.startsAt < new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Events</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Tournaments, fundraisers, mission departures, training camps.
          </p>
        </div>
        <Link href={`/${org}/events/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New event
        </Link>
      </div>

      {upcoming.length > 0 && (
        <Section title={`Upcoming (${upcoming.length})`} events={upcoming} style={STATUS_STYLE} />
      )}
      {past.length > 0 && (
        <Section title={`Past (${past.length})`} events={past} style={STATUS_STYLE} muted />
      )}
      {events.length === 0 && (
        <div className="card p-12 text-center text-sm text-[var(--fg-muted)]">No events yet.</div>
      )}
    </div>
  );
}

function Section({ title, events, style, muted }: { title: string; events: any[]; style: Record<string, string>; muted?: boolean }) {
  return (
    <div className={`card !p-0 overflow-hidden ${muted ? "opacity-80" : ""}`}>
      <div className="border-b border-[var(--border)] px-6 py-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
              <td className="px-6 py-3">
                <div className="font-medium text-[var(--fg)]">{e.name}</div>
                <div className="text-xs text-[var(--fg-muted)]">{e.type.replace("_", " ").toLowerCase()}</div>
              </td>
              <td className="px-6 py-3 text-[var(--fg-muted)]">{e.venue || "—"}</td>
              <td className="px-6 py-3 text-[var(--fg-muted)]">{formatDate(e.startsAt)}</td>
              <td className="px-6 py-3 text-right">
                <span className={`badge ${style[e.status]}`}>{e.status.replace("_", " ").toLowerCase()}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
