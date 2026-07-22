"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Images, Film, Trash2, ExternalLink, Plus, Search, X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { MediaUploadModal } from "./media-upload-modal";
import { deleteMediaAsset } from "./actions";

type Asset = {
  id: string;
  mediaType: string;
  title: string | null;
  description: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  capturedAt: string | null;
  createdAt: string;
  tags: string[];
  event: { id: string; name: string } | null;
  program: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
};

type SelectOption = { id: string; name: string };
type Filters = { event: string; program: string; branch: string; type: string; q: string };

type Props = {
  orgSlug: string;
  canWrite: boolean;
  assets: Asset[];
  events: SelectOption[];
  programs: SelectOption[];
  branches: SelectOption[];
  filters: Filters;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Lightbox({
  assets,
  index,
  onClose,
  onPrev,
  onNext,
  canWrite,
  onDelete,
}: {
  assets: Asset[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  canWrite: boolean;
  onDelete: (id: string) => void;
}) {
  const asset = assets[index];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onPrev();
      if (e.key === "ArrowRight" && index < assets.length - 1) onNext();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [index, assets.length, onClose, onPrev, onNext]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleDelete = () => {
    if (!confirm("Delete this asset permanently?")) return;
    onDelete(asset.id);
    if (assets.length === 1) {
      onClose();
    } else if (index === assets.length - 1) {
      onPrev();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      {/* Prev */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next */}
      {index < assets.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Content area */}
      <div
        className="relative flex max-h-screen w-full max-w-5xl flex-col items-center px-16 py-12"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="absolute right-3 top-3 flex items-center gap-2 sm:right-16 sm:top-3">
          <a
            href={asset.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          {canWrite && (
            <button
              onClick={handleDelete}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-red-400 hover:bg-red-500/20 transition-colors"
              title="Delete asset"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Media */}
        <div className="flex max-h-[75vh] w-full items-center justify-center">
          {asset.mediaType === "PHOTO" ? (
            <img
              src={asset.fileUrl}
              alt={asset.title ?? asset.fileName}
              className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              key={asset.id}
              src={asset.fileUrl}
              controls
              autoPlay
              className="max-h-[75vh] max-w-full rounded-lg shadow-2xl"
            />
          )}
        </div>

        {/* Caption */}
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-white/90">
            {asset.title ?? asset.fileName}
          </p>
          <p className="mt-0.5 text-xs text-white/50">
            {formatBytes(asset.fileSize)}
            {asset.capturedAt && ` · ${asset.capturedAt}`}
            {` · ${index + 1} of ${assets.length}`}
          </p>
          {asset.description && (
            <p className="mt-1.5 max-w-lg text-xs text-white/60">{asset.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MediaLibraryClient({ orgSlug, canWrite, assets: initialAssets, events, programs, branches, filters }: Props) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [localQ, setLocalQ] = useState(filters.q);
  const [isPending, startTransition] = useTransition();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  function applyFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    const p = new URLSearchParams();
    if (next.q)       p.set("q",       next.q);
    if (next.event)   p.set("event",   next.event);
    if (next.program) p.set("program", next.program);
    if (next.branch)  p.set("branch",  next.branch);
    if (next.type)    p.set("type",    next.type);
    startTransition(() => router.push(`?${p.toString()}`));
  }

  const handleDelete = useCallback(async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    await deleteMediaAsset(orgSlug, id);
  }, [orgSlug]);

  const activeFilters = [filters.event, filters.program, filters.branch, filters.type, filters.q].filter(Boolean).length;

  const sel = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30";

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Media Library</h1>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              {assets.length} {assets.length === 1 ? "asset" : "assets"}
              {activeFilters > 0 && ` — ${activeFilters} filter${activeFilters > 1 ? "s" : ""} active`}
            </p>
          </div>
          {canWrite && (
            <button
              onClick={() => setShowUpload(true)}
              className="btn-primary inline-flex items-center gap-2 shrink-0"
            >
              <Plus className="h-4 w-4" /> Upload
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="card !p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
            <input
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyFilters({ q: localQ }); }}
              placeholder="Search by title, filename, description…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-4 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select value={filters.type} onChange={(e) => applyFilters({ type: e.target.value })} className={sel}>
              <option value="">All types</option>
              <option value="PHOTO">Photos</option>
              <option value="VIDEO">Videos</option>
            </select>

            {events.length > 0 && (
              <select value={filters.event} onChange={(e) => applyFilters({ event: e.target.value })} className={sel}>
                <option value="">All events</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}

            {programs.length > 0 && (
              <select value={filters.program} onChange={(e) => applyFilters({ program: e.target.value })} className={sel}>
                <option value="">All programmes</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            {branches.length > 1 && (
              <select value={filters.branch} onChange={(e) => applyFilters({ branch: e.target.value })} className={sel}>
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>

          {activeFilters > 0 && (
            <button
              onClick={() => { setLocalQ(""); applyFilters({ q: "", event: "", program: "", branch: "", type: "" }); }}
              className="flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              <X className="h-3.5 w-3.5" /> Clear all filters
            </button>
          )}
        </div>

        {/* Grid */}
        {assets.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <Images className="h-12 w-12 text-[var(--border)] mb-4" />
            <p className="text-sm font-semibold text-[var(--fg-muted)]">No media found</p>
            {activeFilters > 0 ? (
              <p className="mt-1 text-xs text-[var(--fg-muted)]">Try adjusting your filters</p>
            ) : canWrite ? (
              <button onClick={() => setShowUpload(true)} className="mt-4 btn-primary text-sm">Upload first asset</button>
            ) : null}
          </div>
        ) : (
          <div
            className={`grid gap-4 ${isPending ? "opacity-50 pointer-events-none" : ""}`}
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
          >
            {assets.map((asset, index) => (
              <div key={asset.id} className="group relative rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                {/* Thumbnail — clickable to open viewer */}
                <button
                  type="button"
                  className="relative block w-full aspect-video bg-[var(--bg-muted)] overflow-hidden cursor-pointer"
                  onClick={() => setViewerIndex(index)}
                  aria-label={`View ${asset.title ?? asset.fileName}`}
                >
                  {asset.mediaType === "PHOTO" ? (
                    <img
                      src={asset.fileUrl}
                      alt={asset.title ?? asset.fileName}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
                        <Play className="h-6 w-6 text-[var(--brand-primary)] translate-x-0.5" />
                      </div>
                      <span className="text-[10px] text-[var(--fg-muted)]">Click to play</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                  {/* Video badge */}
                  {asset.mediaType === "VIDEO" && (
                    <span className="absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-black/70 text-white">
                      VIDEO
                    </span>
                  )}
                </button>

                {/* Quick actions — shown on hover, outside the main click area */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={asset.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white shadow-sm"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("Remove this asset from the library?")) return;
                        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
                        await deleteMediaAsset(orgSlug, asset.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 hover:bg-white shadow-sm"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Meta */}
                <div className="p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--fg)] line-clamp-1">
                    {asset.title ?? asset.fileName}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {asset.event && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {asset.event.name}
                      </span>
                    )}
                    {asset.program && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        {asset.program.name}
                      </span>
                    )}
                    {asset.branch && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        {asset.branch.name}
                      </span>
                    )}
                  </div>
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded px-1.5 py-0.5 text-[10px] bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-[var(--fg-muted)]">
                    {asset.capturedAt ?? asset.createdAt} · {formatBytes(asset.fileSize)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox viewer */}
      {viewerIndex !== null && (
        <Lightbox
          assets={assets}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex((i) => (i !== null ? Math.max(0, i - 1) : null))}
          onNext={() => setViewerIndex((i) => (i !== null ? Math.min(assets.length - 1, i + 1) : null))}
          canWrite={canWrite}
          onDelete={handleDelete}
        />
      )}

      {showUpload && (
        <MediaUploadModal
          orgSlug={orgSlug}
          events={events}
          programs={programs}
          branches={branches}
          onClose={() => setShowUpload(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}
