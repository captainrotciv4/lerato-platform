"use client";

import { useState, useRef } from "react";
import { Printer, Mail, Download, X, Send, Loader2 } from "lucide-react";
import { emailReport } from "../actions";

interface ExportActionsProps {
  org: string;
  csvUrl: string;
  currentFilters: {
    position: string;
    ageBracket: string;
    county: string;
    recommendation: string;
  };
}

export function ExportActions({ org, csvUrl, currentFilters }: ExportActionsProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [sending, setSending]     = useState(false);
  const [result, setResult]       = useState<{ ok: boolean; message: string } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    // pass current filter state
    Object.entries(currentFilters).forEach(([k, v]) => fd.set(k, v));
    const res = await emailReport(org, fd);
    setSending(false);
    setResult(res as { ok: boolean; message: string });
  }

  return (
    <>
      {/* Export bar — hidden in print */}
      <div className="print:hidden flex flex-wrap items-center gap-2">
        <a
          href={csvUrl}
          download
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <Download className="h-4 w-4" /> Download CSV
        </a>
        <button
          onClick={() => window.print()}
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <Printer className="h-4 w-4" /> Print / PDF
        </button>
        <button
          onClick={() => { setEmailOpen(true); setResult(null); }}
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <Mail className="h-4 w-4" /> Email report
        </button>
      </div>

      {/* Email modal */}
      {emailOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[var(--fg)]">Email this report</h2>
              <button onClick={() => setEmailOpen(false)} className="text-[var(--fg-muted)] hover:text-[var(--fg)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {result ? (
              <div className={`rounded-lg p-4 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                {result.message}
              </div>
            ) : null}

            {!result?.ok && (
              <form onSubmit={handleEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--fg)]">To</label>
                  <input
                    ref={emailRef}
                    name="emailTo"
                    type="email"
                    required
                    placeholder="recipient@example.com"
                    className="mt-1 w-full"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--fg)]">Subject</label>
                  <input
                    name="subject"
                    type="text"
                    defaultValue="Player Registry Report"
                    className="mt-1 w-full"
                  />
                </div>
                <p className="text-xs text-[var(--fg-muted)]">
                  The report will include all players matching the current filters.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEmailOpen(false)} className="btn-secondary text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={sending} className="btn-primary inline-flex items-center gap-2 text-sm">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Sending…" : "Send report"}
                  </button>
                </div>
              </form>
            )}

            {result?.ok && (
              <button onClick={() => setEmailOpen(false)} className="btn-secondary w-full text-sm">
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
