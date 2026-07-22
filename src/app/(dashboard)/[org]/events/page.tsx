import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import Link from "next/link";
import { Plus, Images } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Events — Lerato Platform" };

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED:   "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  IN_PROGRESS: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300",
  COMPLETED:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  POSTPONED:   "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300",
  CANCELLED:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const TYPE_LABEL: Record<string, string> = {
  TOURNAMENT:   "Tournament",
  TRAINING_CAMP:"Training camp",
  FUNDRAISER:   "Fundraiser",
  COMMUNITY_DAY:"Community day",
  CONFERENCE:   "Conference",
  MISSION_TRIP: "Mission trip",
  OTHER:        "Other",
};

export default async function EventsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const canWrite = can(ctx.role, ctx.permissions, PERMISSIONS.EVENT_WRITE);

  const events = await dbRetry(() =>
    prisma.event.findMany({
      where: { organizationId: ctx.organization.id, deletedAt: null },
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { mediaAssets: true } },
      },
    })
  );

  const now = new Date();
  const upcoming = events.filter(e => e.startsAt >= now);
  const past     = events.filter(e => e.startsAt < now);

  // Total media across all events
  const totalMedia = events.reduce((s, e) => s + e._count.mediaAssets, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Events</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {events.length} event{events.length !== 1 ? "s" : ""}
            {totalMedia > 0 && ` · ${totalMedia} media files`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${org}/media` as any}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
          >
            <Images className="h-4 w-4" /> Media Library
          </Link>
          {canWrite && (
            <Link href={`/${org}/events/new` as any} className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> New event
            </Link>
          )}
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Section
          title={`Upcoming (${upcoming.length})`}
          events={upcoming}
          org={org}
          statusStyle={STATUS_STYLE}
        />
      )}

      {/* Past */}
      {past.length > 0 && (
        <Section
          title={`Past (${past.length})`}
          events={past}
          org={org}
          statusStyle={STATUS_STYLE}
          muted
        />
      )}

      {events.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-sm text-[var(--fg-muted)]">No events yet.</p>
          {canWrite && (
            <Link href={`/${org}/events/new` as any} className="mt-4 btn-primary inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Create first event
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

type EventRow = {
  id: string;
  name: string;
  type: string;
  venue: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  _count: { mediaAssets: number };
};

function Section({
  title, events, org, statusStyle, muted,
}: {
  title: string;
  events: EventRow[];
  org: string;
  statusStyle: Record<string, string>;
  muted?: boolean;
}) {
  return (
    <div className={`card !p-0 overflow-hidden ${muted ? "opacity-75" : ""}`}>
      <div className="border-b border-[var(--border)] px-6 py-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          {title}
        </h2>
      </div>

      {/* Mobile: card stack */}
      <div className="divide-y divide-[var(--border)] sm:hidden">
        {events.map((e) => (
          <Link key={e.id} href={`/${org}/events/${e.id}` as any} className="block px-4 py-3 space-y-1 hover:bg-[var(--bg-muted)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-sm text-[var(--fg)]">{e.name}</div>
                <div className="text-xs text-[var(--fg-muted)]">
                  {TYPE_LABEL[e.type] ?? e.type} · {formatDate(e.startsAt)}
                </div>
              </div>
              <span className={`badge shrink-0 ${statusStyle[e.status]}`}>
                {e.status.replace(/_/g, " ").toLowerCase()}
              </span>
            </div>
            {e._count.mediaAssets > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--brand-primary)]">
                <Images className="h-3 w-3" />
                {e._count.mediaAssets} photo{e._count.mediaAssets !== 1 ? "s" : ""} / videos
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Desktop: table */}
      <table className="hidden w-full text-sm sm:table">
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)] cursor-pointer">
              <td className="px-6 py-3">
                <Link href={`/${org}/events/${e.id}` as any} className="block">
                  <div className="font-medium text-[var(--fg)] hover:text-[var(--brand-primary)]">{e.name}</div>
                  <div className="text-xs text-[var(--fg-muted)]">
                    {TYPE_LABEL[e.type] ?? e.type}
                  </div>
                </Link>
              </td>
              <td className="px-6 py-3 text-[var(--fg-muted)]">{e.venue || "—"}</td>
              <td className="px-6 py-3 text-[var(--fg-muted)]">{formatDate(e.startsAt)}</td>
              <td className="px-6 py-3">
                <span className={`badge ${statusStyle[e.status]}`}>
                  {e.status.replace(/_/g, " ").toLowerCase()}
                </span>
              </td>
              <td className="px-6 py-3 text-right">
                <Link
                  href={`/${org}/events/${e.id}` as any}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                >
                  <Images className="h-3.5 w-3.5" />
                  {e._count.mediaAssets > 0 ? `${e._count.mediaAssets} media` : "Open"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
