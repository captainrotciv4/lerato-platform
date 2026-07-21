import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { createRollcall } from "../actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, CheckSquare } from "lucide-react";
import { fullName } from "@/lib/utils";

export const metadata = { title: "Take Rollcall — Lerato Platform" };

const SESSION_TYPES = [
  { value: "TRAINING", label: "Training Session" },
  { value: "MATCH", label: "Match / Fixture" },
  { value: "FITNESS", label: "Fitness & Conditioning" },
  { value: "CAMP", label: "Training Camp" },
  { value: "ASSESSMENT", label: "Assessment / Trials" },
];

export default async function NewRollcallPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  const branch = await dbRetry(() =>
    prisma.branch.findFirst({
      where: { id, organizationId: ctx.organization.id },
      include: {
        beneficiaries: {
          where: { deletedAt: null },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          include: { athleteProfile: true },
        },
      },
    })
  );
  if (!branch) notFound();

  const today = new Date().toISOString().split("T")[0];
  const branchTheme = {
    "--brand-primary": branch.primaryColor,
    "--brand-accent": branch.accentColor,
  } as React.CSSProperties;

  return (
    <div className="mx-auto max-w-2xl space-y-6" style={branchTheme}>
      <Link
        href={`/${org}/branches/${id}` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {branch.name}
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Take Rollcall</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {branch.name} — {branch.beneficiaries.length} player{branch.beneficiaries.length !== 1 && "s"} registered
        </p>
      </div>

      {branch.beneficiaries.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-40" />
          <p className="mt-3 text-sm text-[var(--fg-muted)]">No players are assigned to this branch yet.</p>
          <Link href={`/${org}/beneficiaries` as any} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
            Assign players from beneficiaries
          </Link>
        </div>
      ) : (
        <form
          action={async (formData) => {
            "use server";
            await createRollcall(org, id, formData);
          }}
          className="space-y-5"
        >
          {/* Session details */}
          <div className="card space-y-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Session details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="date">Date <span className="text-[var(--brand-accent)]">*</span></label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={today}
                  className="mt-1 w-full"
                />
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
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="e.g. Focus: set pieces, first 30 minutes only due to rain…"
                className="mt-1 w-full"
              />
            </div>
          </div>

          {/* Player rollcall */}
          <div className="card !p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-[var(--fg-muted)]" />
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  Players ({branch.beneficiaries.length})
                </h2>
              </div>
              <span className="text-xs text-[var(--fg-muted)]">Tick = present · untick = absent</span>
            </div>

            {/* Search */}
            <div className="border-b border-[var(--border)] px-5 py-3">
              <input
                id="player-search"
                type="search"
                placeholder="Search players…"
                autoComplete="off"
                className="w-full text-sm"
              />
            </div>

            <div id="player-list" className="divide-y divide-[var(--border)]">
              {branch.beneficiaries.map((b, i) => (
                <label
                  key={b.id}
                  data-name={fullName(b.firstName, b.middleName, b.lastName).toLowerCase()}
                  className="flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-[var(--bg-muted)]"
                >
                  {/* Hidden field so we know all player IDs regardless of checkbox state */}
                  <input type="hidden" name={`player_${b.id}`} value={b.id} />

                  <input
                    type="checkbox"
                    name={`present_${b.id}`}
                    defaultChecked
                    className="!w-auto h-4 w-4 accent-[var(--brand-primary)]"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--fg)] truncate">
                      {fullName(b.firstName, b.middleName, b.lastName)}
                    </div>
                    <div className="text-xs text-[var(--fg-muted)]">
                      {b.athleteProfile?.position || "Player"}
                      {b.athleteProfile?.jerseyNumber != null && (
                        <span className="ml-2 font-mono">#{b.athleteProfile.jerseyNumber}</span>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-xs text-[var(--fg-muted)]">#{i + 1}</span>
                </label>
              ))}
              <p id="player-no-results" className="hidden px-5 py-4 text-sm text-[var(--fg-muted)]">
                No players match your search.
              </p>
            </div>
          </div>

          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              var input = document.getElementById('player-search');
              var list = document.getElementById('player-list');
              var noResults = document.getElementById('player-no-results');
              if (!input || !list) return;
              input.addEventListener('input', function() {
                var q = input.value.trim().toLowerCase();
                var rows = list.querySelectorAll('label[data-name]');
                var visible = 0;
                rows.forEach(function(row) {
                  var match = !q || row.dataset.name.includes(q);
                  row.style.display = match ? '' : 'none';
                  if (match) visible++;
                });
                noResults.classList.toggle('hidden', visible > 0);
              });
            })();
          ` }} />

          <div className="flex items-center justify-end gap-3">
            <Link href={`/${org}/branches/${id}` as any} className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary">
              Save rollcall
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
