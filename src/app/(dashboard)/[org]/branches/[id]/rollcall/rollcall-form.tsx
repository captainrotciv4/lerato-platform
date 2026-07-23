"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckSquare, WifiOff, Loader2 } from "lucide-react";
import { createRollcall } from "./actions";
import { enqueue } from "@/lib/offline/queue";
import { fullName } from "@/lib/utils";

interface Player {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  nationalId: string | null;
  athleteProfile: { position: string | null; jerseyNumber: number | null } | null;
}

interface Props {
  org: string;
  branchId: string;
  branchName: string;
  players: Player[];
  today: string;
}

const SESSION_TYPES = [
  { value: "TRAINING",   label: "Training Session" },
  { value: "MATCH",      label: "Match / Fixture" },
  { value: "FITNESS",    label: "Fitness & Conditioning" },
  { value: "CAMP",       label: "Training Camp" },
  { value: "ASSESSMENT", label: "Assessment / Trials" },
];

function isNetworkError(err: unknown): boolean {
  const msg = (err as any)?.message ?? String(err);
  return msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch") || msg.toLowerCase().includes("connection");
}

export function RollcallForm({ org, branchId, branchName, players, today }: Props) {
  const formRef               = useRef<HTMLFormElement>(null);
  const searchRef             = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");

  const visible = search
    ? players.filter((p) => {
        const q = search.toLowerCase();
        return (
          fullName(p.firstName, p.middleName, p.lastName).toLowerCase().includes(q) ||
          (p.nationalId?.toLowerCase().includes(q) ?? false)
        );
      })
    : players;

  async function saveOffline(formData: FormData) {
    const date        = (formData.get("date") as string) ?? today;
    const sessionType = (formData.get("sessionType") as string) ?? "TRAINING";
    const notes       = (formData.get("notes") as string) ?? "";

    const allPlayerIds: string[]     = [];
    const presentPlayerIds: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("player_"))  allPlayerIds.push(key.replace("player_", ""));
      if (key.startsWith("present_") && value === "on") presentPlayerIds.push(key.replace("present_", ""));
    }

    await enqueue({
      type:     "ROLLCALL",
      org,
      branchId,
      label:    `${branchName} — ${date} (${SESSION_TYPES.find((t) => t.value === sessionType)?.label ?? sessionType})`,
      payload:  { date, sessionType, notes, allPlayerIds, presentPlayerIds },
    });
    setSavedOffline(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);

    const formData = new FormData(e.currentTarget);

    if (!navigator.onLine) {
      await saveOffline(formData);
      setPending(false);
      return;
    }

    try {
      await createRollcall(org, branchId, formData);
      // Success → server redirects back to branch page
    } catch (err: unknown) {
      if ((err as any)?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
      if (!navigator.onLine || isNetworkError(err)) {
        await saveOffline(formData);
      } else {
        setError("Failed to save. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  if (savedOffline) {
    return (
      <div className="card flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <WifiOff className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <p className="font-display text-lg font-bold text-[var(--fg)]">Rollcall saved offline</p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Go to{" "}
            <Link href={`/${org}/sync` as any} className="text-[var(--brand-primary)] underline">
              Pending Sync
            </Link>{" "}
            to upload when you're back online.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setSavedOffline(false)} className="btn-primary">Take another</button>
          <Link href={`/${org}/sync` as any} className="btn-secondary">View pending</Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Session details */}
      <div className="card space-y-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          Session details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="date">Date <span className="text-[var(--brand-accent)]">*</span></label>
            <input id="date" name="date" type="date" required defaultValue={today} className="mt-1 w-full" />
          </div>
          <div>
            <label htmlFor="sessionType">Session type</label>
            <select id="sessionType" name="sessionType" className="mt-1 w-full">
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="notes">Notes (optional)</label>
          <textarea id="notes" name="notes" rows={2}
            placeholder="e.g. Focus: set pieces, first 30 minutes only due to rain…"
            className="mt-1 w-full"
          />
        </div>
      </div>

      {/* Player list */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[var(--fg-muted)]" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Players ({players.length})
            </h2>
          </div>
          <span className="text-xs text-[var(--fg-muted)]">Tick = present · untick = absent</span>
        </div>

        <div className="border-b border-[var(--border)] px-5 py-3">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search players…"
            autoComplete="off"
            className="w-full text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="divide-y divide-[var(--border)]">
          {players.map((b, i) => {
            const name    = fullName(b.firstName, b.middleName, b.lastName);
            const q = search.toLowerCase();
            const hidden = search && !name.toLowerCase().includes(q) && !(b.nationalId?.toLowerCase().includes(q) ?? false);
            return (
              <label
                key={b.id}
                className={`flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-[var(--bg-muted)] ${hidden ? "hidden" : ""}`}
              >
                <input type="hidden" name={`player_${b.id}`} value={b.id} />
                <input
                  type="checkbox"
                  name={`present_${b.id}`}
                  defaultChecked
                  className="!w-auto h-4 w-4 accent-[var(--brand-primary)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--fg)] truncate">{name}</div>
                  <div className="text-xs text-[var(--fg-muted)]">
                    {b.nationalId && <span className="font-mono mr-2">{b.nationalId}</span>}
                    {b.athleteProfile?.position || "Player"}
                    {b.athleteProfile?.jerseyNumber != null && (
                      <span className="ml-2 font-mono">#{b.athleteProfile.jerseyNumber}</span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
          {visible.length === 0 && (
            <p className="px-5 py-4 text-sm text-[var(--fg-muted)]">No players match your search.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href={`/${org}/branches/${branchId}` as any} className="btn-secondary">Cancel</Link>
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save rollcall
        </button>
      </div>
    </form>
  );
}
