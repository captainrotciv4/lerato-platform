"use client";

import { useState, useRef } from "react";
import { Upload, X, FileText, Image, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadedFile = {
  key: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

type Props = {
  orgSlug: string;
  purpose: "document" | "media";
  accept?: string;
  maxSizeMb?: number;
  label?: string;
  hint?: string;
  onUploaded: (file: UploadedFile) => void;
  className?: string;
};

export function FileUploader({
  orgSlug,
  purpose,
  accept = "image/*,application/pdf",
  maxSizeMb = 10,
  label = "Choose file",
  hint,
  onUploaded,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");

  async function handleFile(file: File) {
    if (file.size > maxSizeMb * 1024 * 1024) {
      setErrorMsg(`File too large — max ${maxSizeMb} MB`);
      setState("error");
      return;
    }

    setState("uploading");
    setProgress(10);
    setFileName(file.name);
    setErrorMsg("");

    try {
      // 1. Get presigned URL
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          purpose,
          orgSlug,
        }),
      });
      if (!presignRes.ok) {
        const { error } = await presignRes.json();
        throw new Error(error ?? "Failed to get upload URL");
      }
      const { uploadUrl, key, fileUrl } = await presignRes.json();
      setProgress(30);

      // 2. Upload directly to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setProgress(100);
      setState("done");

      onUploaded({ key, fileUrl, fileName: file.name, fileSize: file.size, mimeType: file.type });
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message ?? "Upload failed");
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {state === "idle" || state === "error" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--fg-muted)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          <Upload className="h-4 w-4 shrink-0" />
          <span>{label}</span>
          {hint && <span className="ml-auto text-xs opacity-60">{hint}</span>}
        </button>
      ) : state === "uploading" ? (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--brand-primary)]" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-[var(--fg-muted)]">{fileName}</div>
            <div className="mt-1 h-1 w-full rounded-full bg-[var(--bg-muted)]">
              <div
                className="h-1 rounded-full bg-[var(--brand-primary)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-900 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <span className="min-w-0 flex-1 truncate text-xs text-green-700 dark:text-green-300">{fileName}</span>
          <button
            type="button"
            onClick={() => { setState("idle"); setFileName(""); if (inputRef.current) inputRef.current.value = ""; }}
            className="shrink-0 text-green-600 hover:text-green-800 dark:text-green-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {state === "error" && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5" /> {errorMsg}
        </p>
      )}
    </div>
  );
}
