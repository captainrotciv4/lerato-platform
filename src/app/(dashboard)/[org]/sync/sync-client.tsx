"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CloudUpload, Trash2, Download, RefreshCw,
  CheckCircle2, XCircle, Loader2, WifiOff, Users, ClipboardList,
} from "lucide-react";
import { listQueue, removeFromQueue, type QueuedRecord } from "@/lib/offline/queue";
import { syncBeneficiaryRecord } from "../beneficiaries/actions";
import { syncRollcallRecord } from "../branches/[id]/rollcall/actions";

type SyncStatus = "idle" | "syncing" | "done" | "error";

interface RecordState {
  status: SyncStatus;
  message?: string;
}

const BENEFICIARY_CSV_HEADERS = [
  "firstName","lastName","middleName","dateOfBirth","gender",
  "admissionNo","birthCertNo","nationalId",
  "phone","email","county","address",
  "guardianName","guardianPhone","guardianEmail","guardianRelationship",
  "isAthlete","isStudent","position","preferredFoot","currentClub","school","grade",
];

function escCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportBeneficiariesCSV(records: QueuedRecord[]) {
  const rows = records
    .filter((r) => r.type === "BENEFICIARY_REGISTER")
    .map((r) => BENEFICIARY_CSV_HEADERS.map((h) => escCsv(r.payload[h])).join(","));
  const csv  = [BENEFICIARY_CSV_HEADERS.join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url,
    download: `offline_players_${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

export function SyncClient({ org }: { org: string }) {
  const [records,  setRecords]  = useState<QueuedRecord[]>([]);
  const [states,   setStates]   = useState<Record<string, RecordState>>({});
  const [online,   setOnline]   = useState(true);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const q = await listQueue(org);
    q.sort((a, b) => a.createdAt - b.createdAt);
    setRecords(q);
    setSelected(new Set(q.map((r) => r.id)));
    setLoading(false);
  }, [org]);

  useEffect(() => {
    load();
    setOnline(navigator.onLine);
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [load]);

  function setRecordState(id: string, s: RecordState) {
    setStates((prev) => ({ ...prev, [id]: s }));
  }

  async function syncRecord(r: QueuedRecord) {
    setRecordState(r.id, { status: "syncing" });
    try {
      let result: { ok: boolean; error?: string } | { ok: true; admissionNo?: string };

      if (r.type === "BENEFICIARY_REGISTER") {
        result = await syncBeneficiaryRecord(org, r.payload);
      } else if (r.type === "ROLLCALL" && r.branchId) {
        result = await syncRollcallRecord(org, r.branchId, r.payload as any);
      } else {
        result = { ok: false, error: "Unknown operation type" };
      }

      if (result.ok) {
        const extra = (result as any).admissionNo ? ` · ${(result as any).admissionNo}` : "";
        setRecordState(r.id, { status: "done", message: `Synced${extra}` });
        await removeFromQueue(r.id);
        setRecords((prev) => prev.filter((x) => x.id !== r.id));
      } else {
        setRecordState(r.id, { status: "error", message: (result as any).error ?? "Failed" });
      }
    } catch (err: any) {
      setRecordState(r.id, { status: "error", message: err?.message ?? "Network error" });
    }
  }

  async function syncSelected() {
    if (!online) return;
    const toSync = records.filter((r) => selected.has(r.id) && states[r.id]?.status !== "done");
    for (const r of toSync) {
      await syncRecord(r);
    }
  }

  async function deleteRecord(id: string) {
    await removeFromQueue(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  const beneficiaryRecords = records.filter((r) => r.type === "BENEFICIARY_REGISTER");
  const rollcallRecords    = records.filter((r) => r.type === "ROLLCALL");
  const pendingSelected    = records.filter((r) => selected.has(r.id) && states[r.id]?.status !== "done").length;
  const syncing            = Object.values(states).some((s) => s.status === "syncing");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--fg-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Pending Sync</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Drafts captured while offline — review, then upload to the server.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {beneficiaryRecords.length > 0 && (
            <button
              onClick={() => exportBeneficiariesCSV(records)}
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
          <button
            onClick={syncSelected}
            disabled={!online || pendingSelected === 0 || syncing}
            className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            Sync {pendingSelected > 0 ? `${pendingSelected} selected` : "all"}
          </button>
        </div>
      </div>

      {/* Offline warning */}
      {!online && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline. Connect to the internet to sync your drafts.</span>
        </div>
      )}

      {records.length === 0 ? (
        <div className="card py-16 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="mt-3 font-display text-lg font-bold text-[var(--fg)]">All clear</p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">No offline drafts waiting to sync.</p>
          <Link href={`/${org}/beneficiaries` as any} className="btn-primary mt-6 inline-block text-sm">
            Back to players
          </Link>
        </div>
      ) : (
        <>
          {/* Select all / deselect */}
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-[var(--fg-muted)] cursor-pointer">
              <input
                type="checkbox"
                className="!w-auto"
                checked={selected.size === records.length && records.length > 0}
                onChange={(e) => setSelected(e.target.checked ? new Set(records.map((r) => r.id)) : new Set())}
              />
              Select all ({records.length})
            </label>
          </div>

          {/* Player registrations */}
          {beneficiaryRecords.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                <Users className="h-3.5 w-3.5" />
                Player registrations ({beneficiaryRecords.length})
              </div>
              <div className="card !p-0 divide-y divide-[var(--border)] overflow-hidden">
                {beneficiaryRecords.map((r) => (
                  <RecordRow
                    key={r.id}
                    record={r}
                    state={states[r.id]}
                    checked={selected.has(r.id)}
                    onToggle={() => toggleSelect(r.id)}
                    onSync={() => syncRecord(r)}
                    onDelete={() => deleteRecord(r.id)}
                    online={online}
                  />
                ))}
              </div>
              <p className="text-xs text-[var(--fg-muted)]">
                Tip: use <strong>Export CSV</strong> to download these as a spreadsheet, then upload via{" "}
                <Link href={`/${org}/beneficiaries/upload` as any} className="underline">
                  Import CSV
                </Link>.
              </p>
            </section>
          )}

          {/* Rollcalls */}
          {rollcallRecords.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                <ClipboardList className="h-3.5 w-3.5" />
                Rollcalls ({rollcallRecords.length})
              </div>
              <div className="card !p-0 divide-y divide-[var(--border)] overflow-hidden">
                {rollcallRecords.map((r) => (
                  <RecordRow
                    key={r.id}
                    record={r}
                    state={states[r.id]}
                    checked={selected.has(r.id)}
                    onToggle={() => toggleSelect(r.id)}
                    onSync={() => syncRecord(r)}
                    onDelete={() => deleteRecord(r.id)}
                    online={online}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RecordRow({
  record, state, checked, onToggle, onSync, onDelete, online,
}: {
  record: QueuedRecord;
  state?: RecordState;
  checked: boolean;
  onToggle: () => void;
  onSync: () => void;
  onDelete: () => void;
  online: boolean;
}) {
  const status    = state?.status ?? "idle";
  const syncing   = status === "syncing";
  const done      = status === "done";
  const hasError  = status === "error";
  const savedAt   = new Date(record.createdAt).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${done ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        className="!w-auto shrink-0"
        checked={checked && !done}
        disabled={done}
        onChange={onToggle}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--fg)] truncate">{record.label}</p>
        <p className="text-xs text-[var(--fg-muted)]">Saved offline · {savedAt}</p>
        {hasError && (
          <p className="mt-1 text-xs text-red-600">{state?.message}</p>
        )}
        {done && (
          <p className="mt-1 text-xs text-emerald-600">{state?.message ?? "Synced"}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : syncing ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)]" />
        ) : (
          <>
            <button
              onClick={onSync}
              disabled={!online || syncing}
              title="Sync this record"
              className="rounded-md p-1.5 text-[var(--brand-primary)] hover:bg-[var(--bg-muted)] disabled:opacity-40"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              title="Discard this draft"
              className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
