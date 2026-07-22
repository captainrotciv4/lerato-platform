"use client";

import { useState } from "react";
import { FileText, Image, Download, Trash2, Plus, X } from "lucide-react";
import { FileUploader, type UploadedFile } from "@/components/file-uploader";
import { saveDocument, deleteDocument } from "./actions";

type Doc = {
  id: string;
  docType: string;
  label: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  BIRTH_CERT:   "Birth Certificate",
  PASSPORT_PHOTO: "Passport Photo",
  PARENT_ID:    "Parent / Guardian ID",
  NATIONAL_ID:  "National ID",
  MEDICAL_FORM: "Medical Form",
  CONSENT_FORM: "Consent Form",
  OTHER:        "Other Document",
};

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS);

type Props = {
  orgSlug: string;
  beneficiaryId: string;
  documents: Doc[];
  canWrite: boolean;
};

export function DocumentsPanel({ orgSlug, beneficiaryId, documents, canWrite }: Props) {
  const [adding, setAdding] = useState(false);
  const [docType, setDocType] = useState("BIRTH_CERT");
  const [label, setLabel] = useState("");
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState<Doc[]>(documents);

  async function handleSave() {
    if (!uploaded) return;
    setSaving(true);
    try {
      await saveDocument(orgSlug, {
        beneficiaryId,
        docType: docType as any,
        label: docType === "OTHER" ? label : "",
        fileName: uploaded.fileName,
        fileKey: uploaded.key,
        fileUrl: uploaded.fileUrl,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
      });
      // Optimistic: add to local state
      setDocs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          docType,
          label: docType === "OTHER" ? label : null,
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
          createdAt: new Date(),
        },
      ]);
      setAdding(false);
      setUploaded(null);
      setDocType("BIRTH_CERT");
      setLabel("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this document?")) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    await deleteDocument(orgSlug, id);
  }

  const input = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30";

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          Documents
        </h2>
        {canWrite && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add document
          </button>
        )}
      </div>

      {/* Upload form */}
      {adding && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--fg)]">New document</span>
            <button onClick={() => { setAdding(false); setUploaded(null); }} className="text-[var(--fg-muted)] hover:text-[var(--fg)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
              {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {docType === "OTHER" && (
            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Medical clearance" className={input} />
            </div>
          )}
          <FileUploader
            orgSlug={orgSlug}
            purpose="document"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            maxSizeMb={10}
            label="Upload file (PDF or image, max 10 MB)"
            onUploaded={setUploaded}
          />
          {uploaded && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-xs"
              >
                {saving ? "Saving…" : "Save document"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Document list */}
      {docs.length === 0 && !adding ? (
        <p className="text-sm text-[var(--fg-muted)]">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const isImage = d.mimeType.startsWith("image/");
            return (
              <li key={d.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--bg-muted)]">
                  {isImage
                    ? <Image className="h-4 w-4 text-[var(--brand-primary)]" />
                    : <FileText className="h-4 w-4 text-[var(--fg-muted)]" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[var(--fg)]">
                    {d.label || DOC_TYPE_LABELS[d.docType] || d.docType}
                  </div>
                  <div className="truncate text-[10px] text-[var(--fg-muted)]">{d.fileName}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                    title="Open"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  {canWrite && (
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="rounded p-1 text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-500"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
