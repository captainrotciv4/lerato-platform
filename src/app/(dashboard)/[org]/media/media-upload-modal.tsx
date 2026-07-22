"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";
import { FileUploader, type UploadedFile } from "@/components/file-uploader";
import { saveMediaAsset } from "./actions";

type SelectOption = { id: string; name: string };

type Props = {
  orgSlug: string;
  events: SelectOption[];
  programs: SelectOption[];
  branches: SelectOption[];
  onClose: () => void;
  onSaved: () => void;
};

export function MediaUploadModal({ orgSlug, events, programs, branches, onClose, onSaved }: Props) {
  const [mediaType, setMediaType] = useState<"PHOTO" | "VIDEO">("PHOTO");
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventId, setEventId] = useState("");
  const [programId, setProgramId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const inp = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30";

  async function handleSave() {
    if (!uploaded) return;
    setSaving(true);
    try {
      await saveMediaAsset(orgSlug, {
        mediaType,
        title,
        description,
        fileName: uploaded.fileName,
        fileKey: uploaded.key,
        fileUrl: uploaded.fileUrl,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
        eventId,
        programId,
        branchId,
        capturedAt,
        tags,
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-[var(--brand-primary)]" />
            <span className="font-semibold text-[var(--fg)]">Upload media</span>
          </div>
          <button onClick={onClose} className="text-[var(--fg-muted)] hover:text-[var(--fg)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          {/* Type tabs */}
          <div className="flex gap-2">
            {(["PHOTO", "VIDEO"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setMediaType(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  mediaType === t
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                    : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                }`}
              >
                {t === "PHOTO" ? "Photo" : "Video"}
              </button>
            ))}
          </div>

          {/* File uploader */}
          <FileUploader
            orgSlug={orgSlug}
            purpose="media"
            accept={
              mediaType === "PHOTO"
                ? "image/jpeg,image/png,image/webp,image/heic,image/heif"
                : "video/mp4,video/quicktime,video/webm"
            }
            maxSizeMb={mediaType === "PHOTO" ? 20 : 500}
            label={`Choose ${mediaType === "PHOTO" ? "photo (max 20 MB)" : "video (max 500 MB)"}`}
            onUploaded={setUploaded}
          />

          {/* Metadata — only show once file is selected */}
          {uploaded && (
            <>
              <div>
                <label className="block mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Training session highlights" className={inp} />
              </div>

              <div>
                <label className="block mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional caption or notes" className={inp} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {events.length > 0 && (
                  <div>
                    <label className="block mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Event</label>
                    <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inp}>
                      <option value="">— none —</option>
                      {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                )}
                {programs.length > 0 && (
                  <div>
                    <label className="block mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Programme</label>
                    <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={inp}>
                      <option value="">— none —</option>
                      {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {branches.length > 0 && (
                  <div>
                    <label className="block mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Branch</label>
                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inp}>
                      <option value="">— all branches —</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Date captured</label>
                  <input type="date" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} className={inp} />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Tags <span className="normal-case font-normal text-[var(--fg-muted)]">(comma-separated)</span></label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. pre-season, u17, match day" className={inp} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-5 py-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!uploaded || saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save to library"}
          </button>
        </div>
      </div>
    </div>
  );
}
