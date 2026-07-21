"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload, CheckCircle2, XCircle, FileText, AlertTriangle } from "lucide-react";

// ── Template definition ────────────────────────────────────────────────────────

const HEADERS = [
  "firstName", "lastName", "middleName",
  "dateOfBirth", "gender",
  "phone", "email", "county", "address",
  "guardianName", "guardianPhone", "guardianEmail", "guardianRelationship",
  "isAthlete", "isStudent",
  "position", "preferredFoot", "currentClub",
  "school", "grade",
];

const FIELD_NOTES: Record<string, string> = {
  firstName:            "Required",
  lastName:             "Required",
  middleName:           "Optional",
  dateOfBirth:          "Required — YYYY-MM-DD",
  gender:               "Required — MALE / FEMALE / OTHER / PREFER_NOT_TO_SAY",
  phone:                "Optional — e.g. +254712345678",
  email:                "Optional",
  county:               "Optional — residential county or area",
  address:              "Optional — estate / street",
  guardianName:         "Optional",
  guardianPhone:        "Optional",
  guardianEmail:        "Optional",
  guardianRelationship: "Optional — Mother / Father / Uncle / Aunt / Grandparent / Legal Guardian / Other",
  isAthlete:            "true or false",
  isStudent:            "true or false",
  position:             "Optional — GK CB LB RB LWB RWB CDM CM CAM LM RM LW RW CF ST",
  preferredFoot:        "Optional — RIGHT / LEFT / BOTH",
  currentClub:          "Optional — other club the player also trains with",
  school:               "Optional",
  grade:                "Optional — e.g. Form 2A / Standard 7",
};

const EXAMPLE_ROWS = [
  ["John", "Kamau", "", "2008-03-15", "MALE", "+254712345678", "", "Nairobi", "Westlands",
   "Mary Kamau", "+254712345679", "", "Mother", "true", "true", "ST", "RIGHT", "", "Westlands Primary", "Standard 7"],
  ["Grace", "Wanjiku", "", "2009-07-20", "FEMALE", "", "", "Kiambu", "",
   "Peter Wanjiku", "+254798765432", "", "Father", "true", "true", "GK", "RIGHT", "", "Kiambu Girls Primary", "Standard 6"],
];

const REQUIRED = new Set(["firstName", "lastName", "dateOfBirth", "gender"]);

// ── CSV utilities ──────────────────────────────────────────────────────────────

function escape(v: string) {
  return v.includes(",") || v.includes('"') || v.includes("\n")
    ? '"' + v.replace(/"/g, '""') + '"'
    : v;
}

function makeTemplate(): string {
  const rows = [HEADERS, ...EXAMPLE_ROWS].map((r) => r.map(escape).join(",")).join("\n");
  return "data:text/csv;charset=utf-8," + encodeURIComponent(rows);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? "").trim()]));
  });
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (c === "," && !inQ) {
      result.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Row = Record<string, string>;
type Result = { created: number; skipped: number; errors: string[]; total: number };

// ── Component ──────────────────────────────────────────────────────────────────

export function UploadBeneficiariesForm({ org }: { org: string }) {
  const [rows, setRows]           = useState<Row[] | null>(null);
  const [fileName, setFileName]   = useState("");
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]       = useState<Result | null>(null);
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please select a .csv file.");
      return;
    }
    setFileName(file.name);
    setResult(null);
    setParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setParseError("No data rows found. Make sure the file has a header row and at least one data row.");
        setRows(null);
      } else {
        setRows(parsed);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !rows) return;
    setUploading(true);
    setParseError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/${org}/beneficiaries/upload`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setParseError(json.error ?? "Upload failed");
      } else {
        setResult(json);
        setRows(null);
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch {
      setParseError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const templateURL = makeTemplate();
  const previewCols = rows ? Object.keys(rows[0]).slice(0, 8) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/${org}/beneficiaries` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to players
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Import from CSV</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Register multiple players at once by uploading a spreadsheet.
        </p>
      </div>

      {/* Template download */}
      <div className="card flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-primary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--fg)]">Download the CSV template</p>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              Includes all fields with two example rows. Open in Excel or Google Sheets, fill in your players, save as CSV, then upload below.
            </p>
          </div>
        </div>
        <a
          href={templateURL}
          download="player_import_template.csv"
          className="btn-secondary inline-flex shrink-0 items-center gap-2 text-sm"
        >
          <Download className="h-4 w-4" /> Template
        </a>
      </div>

      {/* Column reference */}
      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--brand-primary)] hover:underline">
          Column reference
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="pb-2 pr-6 font-semibold text-[var(--fg-muted)]">Column</th>
                <th className="pb-2 font-semibold text-[var(--fg-muted)]">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {HEADERS.map((h) => (
                <tr key={h}>
                  <td className="py-1.5 pr-6 font-mono text-[var(--fg)]">
                    {h}
                    {REQUIRED.has(h) && <span className="ml-1 text-[var(--brand-accent)]">*</span>}
                  </td>
                  <td className="py-1.5 text-[var(--fg-muted)]">{FIELD_NOTES[h]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-[var(--fg-muted)]"><span className="text-[var(--brand-accent)]">*</span> Required</p>
        </div>
      </details>

      {/* Upload card — hidden once results are shown */}
      {!result && (
        <div className="card space-y-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Upload CSV
          </h2>

          {/* Drop zone */}
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
              dragging
                ? "border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)]"
                : "border-[var(--border)] hover:border-[var(--brand-primary)]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="mb-3 h-8 w-8 text-[var(--fg-muted)]" />
            {fileName ? (
              <p className="text-sm font-semibold text-[var(--fg)]">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-[var(--fg)]">Drop your CSV here</p>
                <p className="mt-1 text-xs text-[var(--fg-muted)]">or click to browse</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>

          {parseError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {rows && rows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--fg-muted)]">
                <span className="font-semibold text-[var(--fg)]">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>{" "}
                ready to import — preview of first 5:
              </p>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-muted)]">
                    <tr>
                      {previewCols.map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium text-[var(--fg-muted)]">
                          {h}{REQUIRED.has(h) ? " *" : ""}
                        </th>
                      ))}
                      {Object.keys(rows[0]).length > 8 && (
                        <th className="px-3 py-2 text-[var(--fg-muted)]">…</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-muted)]">
                        {previewCols.map((h) => (
                          <td key={h} className="whitespace-nowrap px-3 py-2 text-[var(--fg)]">
                            {row[h] || <span className="text-[var(--fg-muted)]">—</span>}
                          </td>
                        ))}
                        {Object.keys(rows[0]).length > 8 && <td className="px-3 py-2 text-[var(--fg-muted)]">…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <p className="text-xs text-[var(--fg-muted)]">Showing 5 of {rows.length} rows.</p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import {rows.length} {rows.length === 1 ? "player" : "players"}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="card space-y-5">
          <div className="flex items-center gap-3">
            {result.skipped === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Import complete
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="font-display text-3xl font-bold text-emerald-700">{result.created}</div>
              <div className="mt-1 text-xs text-emerald-600">Created</div>
            </div>
            <div className="rounded-xl bg-[var(--bg-muted)] p-4">
              <div className="font-display text-3xl font-bold text-[var(--fg)]">{result.total}</div>
              <div className="mt-1 text-xs text-[var(--fg-muted)]">Total rows</div>
            </div>
            <div className={`rounded-xl p-4 ${result.skipped > 0 ? "bg-amber-50" : "bg-[var(--bg-muted)]"}`}>
              <div className={`font-display text-3xl font-bold ${result.skipped > 0 ? "text-amber-700" : "text-[var(--fg)]"}`}>
                {result.skipped}
              </div>
              <div className={`mt-1 text-xs ${result.skipped > 0 ? "text-amber-600" : "text-[var(--fg-muted)]"}`}>Skipped</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-semibold text-amber-800">
                {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} had issues:
              </p>
              <ul className="space-y-1.5">
                {result.errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Link href={`/${org}/beneficiaries` as any} className="btn-primary">
              View players
            </Link>
            <button onClick={() => setResult(null)} className="btn-secondary">
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
