import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, Users, Film, Images, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { name: true } });
  return { title: event ? `${event.name} — Lerato Platform` : "Event" };
}

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED:   "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  IN_PROGRESS: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300",
  COMPLETED:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  POSTPONED:   "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300",
  CANCELLED:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const TYPE_LABEL: Record<string, string> = {
  TOURNAMENT:    "Tournament",
  TRAINING_CAMP: "Training camp",
  FUNDRAISER:    "Fundraiser",
  COMMUNITY_DAY: "Community day",
  CONFERENCE:    "Conference",
  MISSION_TRIP:  "Mission trip",
  OTHER:         "Other",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  const event = await dbRetry(() =>
    prisma.event.findFirst({
      where: { id, organizationId: ctx.organization.id, deletedAt: null },
      include: {
        mediaAssets: {
          orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
        },
      },
    })
  );

  if (!event) notFound();

  const photos = event.mediaAssets.filter(a => a.mediaType === "PHOTO");
  const videos = event.mediaAssets.filter(a => a.mediaType === "VIDEO");

  const duration =
    event.endsAt
      ? (() => {
          const diff = event.endsAt.getTime() - event.startsAt.getTime();
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
        })()
      : null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href={`/${org}/events` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      {/* Hero card */}
      <div className="card space-y-4">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                {TYPE_LABEL[event.type] ?? event.type}
              </span>
              <span className={`badge ${STATUS_STYLE[event.status]}`}>
                {event.status.replace(/_/g, " ").toLowerCase()}
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold text-[var(--fg)] sm:text-3xl">
              {event.name}
            </h1>
            {event.description && (
              <p className="mt-2 text-sm text-[var(--fg-muted)] max-w-2xl">{event.description}</p>
            )}
          </div>

          {/* Media count chips */}
          {event.mediaAssets.length > 0 && (
            <div className="flex shrink-0 gap-2">
              {photos.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)]">
                  <Images className="h-3.5 w-3.5" />
                  {photos.length} photo{photos.length !== 1 ? "s" : ""}
                </div>
              )}
              {videos.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)]">
                  <Film className="h-3.5 w-3.5" />
                  {videos.length} video{videos.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Meta strip */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--fg-muted)]">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {formatDate(event.startsAt)}
            {duration && <span className="text-[var(--fg-muted)] opacity-60">· {duration}</span>}
          </span>
          {event.venue && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {event.venue}
            </span>
          )}
          {event.capacity && (
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0" />
              {event.capacity} capacity
            </span>
          )}
        </div>
      </div>

      {/* Media section */}
      {event.mediaAssets.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Images className="h-12 w-12 text-[var(--border)] mb-4" />
          <p className="text-sm font-semibold text-[var(--fg-muted)]">No media for this event yet</p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            Go to <Link href={`/${org}/media` as any} className="text-[var(--brand-primary)] hover:underline">Media Library</Link> to upload photos and videos
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Photos */}
          {photos.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                Photos ({photos.length})
              </h2>
              <div
                className="grid gap-2 sm:gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
              >
                {photos.map((asset) => {
                  const src = `/api/files/${asset.fileKey}`;
                  return (
                    <a
                      key={asset.id}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={asset.title ?? asset.fileName}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
                        <ExternalLink className="h-4 w-4 text-white drop-shadow" />
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Videos */}
          {videos.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                Videos ({videos.length})
              </h2>
              <div
                className="grid gap-2 sm:gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
              >
                {videos.map((asset) => {
                  const src = `/api/files/${asset.fileKey}`;
                  return (
                    <a
                      key={asset.id}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]"
                    >
                      <div className="aspect-video flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 group-hover:bg-[var(--brand-primary)]/20 transition-colors">
                          <Film className="h-6 w-6 text-[var(--brand-primary)]" />
                        </div>
                      </div>
                      <div className="border-t border-[var(--border)] px-3 py-2">
                        <p className="truncate text-xs font-medium text-[var(--fg)]">
                          {asset.title ?? asset.fileName}
                        </p>
                        {asset.capturedAt && (
                          <p className="text-[10px] text-[var(--fg-muted)] mt-0.5">
                            {formatDate(asset.capturedAt)}
                          </p>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
