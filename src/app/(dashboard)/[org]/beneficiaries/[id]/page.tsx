import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2, ClipboardList } from "lucide-react";
import { fullName, formatDate, initials } from "@/lib/utils";
import {
  updateAthleteProfile,
  updateSeasonStats,
  updateStudentProfile,
  createScoutReport,
  deleteBeneficiary,
} from "../actions";
import { DocumentsPanel } from "../documents/documents-panel";
import { EditDetailsForm } from "./edit-details-form";

export const metadata = { title: "Player Profile — Lerato Platform" };

const POSITIONS: Record<string, string> = {
  GK: "Goalkeeper",    CB: "Centre Back",        LB: "Left Back",
  RB: "Right Back",    LWB: "Left Wing Back",    RWB: "Right Wing Back",
  CDM: "Def. Mid",     CM: "Central Mid",        CAM: "Attacking Mid",
  LM: "Left Mid",      RM: "Right Mid",          LW: "Left Winger",
  RW: "Right Winger",  CF: "Centre Forward",     ST: "Striker",
};

const REC_STYLES: Record<string, { cls: string; label: string }> = {
  SIGN:         { cls: "bg-emerald-100 text-emerald-800", label: "Sign" },
  MONITOR:      { cls: "bg-amber-100 text-amber-800",    label: "Monitor" },
  DECLINE:      { cls: "bg-red-100 text-red-800",        label: "Decline" },
  REVIEW_LATER: { cls: "bg-blue-100 text-blue-800",      label: "Review later" },
};

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);
  const canEdit = can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE);
  const isAcademy = ctx.organization.type === "ACADEMY";

  const beneficiary = await dbRetry(() =>
    prisma.beneficiary.findFirst({
      where: { id, organizationId: ctx.organization.id, deletedAt: null },
      include: {
        athleteProfile: true,
        studentProfile: true,
        branch: true,
        trainingAttendances: {
          include: { session: true },
          orderBy: { session: { date: "desc" } },
          take: 30,
        },
        scoutReports: {
          include: { scout: { select: { id: true, name: true } } },
          orderBy: { reportDate: "desc" },
        },
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    })
  );
  if (!beneficiary) notFound();

  const ap = beneficiary.athleteProfile;
  const sp = beneficiary.studentProfile;
  const name = fullName(beneficiary.firstName, beneficiary.middleName, beneficiary.lastName);

  // Attendance
  const attended = beneficiary.trainingAttendances;
  const presentCount = attended.filter((a) => a.present).length;
  const attendanceRate = attended.length > 0 ? Math.round((presentCount / attended.length) * 100) : null;
  const eligibility =
    attendanceRate === null ? null
    : attendanceRate >= 75 ? { label: "Eligible",     cls: "bg-emerald-100 text-emerald-800" }
    : attendanceRate >= 60 ? { label: "At risk",      cls: "bg-amber-100 text-amber-800" }
    :                        { label: "Not eligible", cls: "bg-red-100 text-red-800" };

  // Age
  const age = beneficiary.dateOfBirth
    ? Math.floor((Date.now() - new Date(beneficiary.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href={`/${org}/beneficiaries` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {isAcademy ? "Back to players" : "Back to beneficiaries"}
      </Link>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden !p-0">
        <div
          className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 12%, transparent), transparent 55%)" }}
        >
          {/* Avatar + jersey badge */}
          <div className="relative shrink-0">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
              style={{ background: "var(--brand-primary)" }}
            >
              {initials(name)}
            </div>
            {ap?.jerseyNumber != null && (
              <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fg)] text-xs font-bold text-[var(--bg)] shadow">
                #{ap.jerseyNumber}
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            {beneficiary.admissionNo && (
              <p className="mb-1 font-mono text-xs text-[var(--fg-muted)]">{beneficiary.admissionNo}</p>
            )}
            <h1 className="font-display text-3xl font-bold text-[var(--fg)]">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {ap?.position && (
                <span className="badge text-white" style={{ background: "var(--brand-primary)" }}>
                  {POSITIONS[ap.position] ?? ap.position}
                </span>
              )}
              {ap?.preferredFoot && (
                <span className="badge bg-gray-100 text-gray-700">
                  {ap.preferredFoot.charAt(0) + ap.preferredFoot.slice(1).toLowerCase()} foot
                </span>
              )}
              {eligibility && (
                <span className={`badge ${eligibility.cls}`}>{eligibility.label}</span>
              )}
              <span className="badge bg-gray-100 text-gray-700 capitalize">
                {beneficiary.gender.toLowerCase().replace(/_/g, " ")}
              </span>
              {age != null && (
                <span className="text-sm text-[var(--fg-muted)]">{age} yrs</span>
              )}
              {beneficiary.county && (
                <span className="text-sm text-[var(--fg-muted)]">· {beneficiary.county}</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {ap?.currentClub && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-0.5 text-xs text-[var(--fg-muted)]">
                  Also at: {ap.currentClub}
                </span>
              )}
              {sp?.school && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-0.5 text-xs text-[var(--fg-muted)]">
                  {sp.school}{sp.grade ? ` · ${sp.grade}` : ""}
                </span>
              )}
              {beneficiary.branch && (
                <Link
                  href={`/${org}/branches/${beneficiary.branch.id}` as any}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-0.5 text-xs font-medium text-[var(--fg)] hover:bg-[var(--bg-muted)]"
                >
                  {beneficiary.branch.name}
                </Link>
              )}
              <span className="text-xs text-[var(--fg-muted)]">
                Added {formatDate(beneficiary.createdAt)}
              </span>
            </div>
          </div>

          {/* Quick stats strip */}
          {ap && (
            <div className="flex shrink-0 items-stretch gap-0 divide-x divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm overflow-x-auto">
              {attendanceRate !== null && (
                <div className="px-4 py-3 text-center">
                  <div className={`font-display text-2xl font-bold ${
                    attendanceRate >= 75 ? "text-emerald-600"
                    : attendanceRate >= 60 ? "text-amber-600"
                    : "text-red-600"
                  }`}>{attendanceRate}%</div>
                  <div className="text-[10px] text-[var(--fg-muted)]">Attendance</div>
                </div>
              )}
              <div className="px-4 py-3 text-center">
                <div className="font-display text-2xl font-bold text-[var(--fg)]">{ap.matchesPlayed}</div>
                <div className="text-[10px] text-[var(--fg-muted)]">Played</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className="font-display text-2xl font-bold text-emerald-600">{ap.goals}</div>
                <div className="text-[10px] text-[var(--fg-muted)]">Goals</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className="font-display text-2xl font-bold text-blue-600">{ap.assists}</div>
                <div className="text-[10px] text-[var(--fg-muted)]">Assists</div>
              </div>
            </div>
          )}

          {/* Delete */}
          {canEdit && (
            <form action={async () => { "use server"; await deleteBeneficiary(org, id); }}>
              <button type="submit" className="btn-secondary inline-flex items-center gap-2 text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Physical + Season ───────────────────────────────────────────── */}
      {ap && (
        <div className="grid gap-6 md:grid-cols-2">

          {/* Physical profile */}
          <div className="card space-y-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Physical profile
            </h2>
            <div className="space-y-4">
              {ap.heightCm != null && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-[var(--fg-muted)]">Height</span>
                    <span className="font-semibold text-[var(--fg)]">{ap.heightCm} cm</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(((ap.heightCm - 150) / 60) * 100, 100)}%`, background: "var(--brand-primary)" }}
                    />
                  </div>
                  <div className="mt-0.5 flex justify-between text-[10px] text-[var(--fg-muted)]">
                    <span>150 cm</span><span>210 cm</span>
                  </div>
                </div>
              )}
              {ap.weightKg != null && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-[var(--fg-muted)]">Weight</span>
                    <span className="font-semibold text-[var(--fg)]">{ap.weightKg} kg</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(((ap.weightKg - 50) / 60) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 flex justify-between text-[10px] text-[var(--fg-muted)]">
                    <span>50 kg</span><span>110 kg</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
                {ap.preferredFoot && (
                  <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                    <div className="text-xs text-[var(--fg-muted)]">Preferred foot</div>
                    <div className="mt-0.5 font-semibold text-[var(--fg)] capitalize">{ap.preferredFoot.toLowerCase()}</div>
                  </div>
                )}
                {ap.jerseyNumber != null && (
                  <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                    <div className="text-xs text-[var(--fg-muted)]">Squad number</div>
                    <div className="font-display mt-0.5 text-xl font-bold text-[var(--fg)]">#{ap.jerseyNumber}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Season performance */}
          <div className="card space-y-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Season performance
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "Matches",      value: ap.matchesPlayed, cls: "text-[var(--fg)]"   },
                { label: "Goals",        value: ap.goals,         cls: "text-emerald-600"   },
                { label: "Assists",      value: ap.assists,       cls: "text-blue-600"      },
                { label: "Clean sheets", value: ap.cleanSheets,   cls: "text-violet-600"    },
                { label: "Yellow cards", value: ap.yellowCards,   cls: "text-amber-500"     },
                { label: "Red cards",    value: ap.redCards,      cls: "text-red-600"       },
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-xl bg-[var(--bg-muted)] p-3 text-center">
                  <div className={`font-display text-2xl font-bold ${cls}`}>{value}</div>
                  <div className="mt-0.5 text-[10px] text-[var(--fg-muted)]">{label}</div>
                </div>
              ))}
            </div>

            {canEdit && (
              <details className="border-t border-[var(--border)] pt-3">
                <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-primary)] hover:underline">
                  Update season stats
                </summary>
                <form action={updateSeasonStats.bind(null, org, id)} className="mt-3 grid grid-cols-3 gap-2">
                  {([
                    ["matchesPlayed", "Matches",      ap.matchesPlayed],
                    ["goals",         "Goals",        ap.goals],
                    ["assists",       "Assists",      ap.assists],
                    ["cleanSheets",   "Clean sheets", ap.cleanSheets],
                    ["yellowCards",   "Yellow",       ap.yellowCards],
                    ["redCards",      "Red",          ap.redCards],
                  ] as [string, string, number][]).map(([fname, label, val]) => (
                    <div key={fname}>
                      <label className="text-[10px] text-[var(--fg-muted)]">{label}</label>
                      <input name={fname} type="number" min="0" defaultValue={val} className="mt-0.5 w-full text-sm" />
                    </div>
                  ))}
                  <div className="col-span-3 flex justify-end pt-1">
                    <button type="submit" className="btn-primary py-1.5 text-sm">Save stats</button>
                  </div>
                </form>
              </details>
            )}
          </div>
        </div>
      )}

      {/* ── Scouting database ───────────────────────────────────────────── */}
      {ap && (ap.playingStrengths || ap.areasToImprove || ap.characterNotes || ap.currentClub) && (
        <div className="card space-y-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Scouting database
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            {ap.currentClub && (
              <div>
                <div className="text-xs text-[var(--fg-muted)]">Current club</div>
                <div className="mt-0.5 text-[var(--fg)]">{ap.currentClub}</div>
              </div>
            )}
            {ap.playingStrengths && (
              <div className="sm:col-span-2">
                <div className="text-xs text-[var(--fg-muted)]">Playing strengths</div>
                <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{ap.playingStrengths}</div>
              </div>
            )}
            {ap.areasToImprove && (
              <div className="sm:col-span-2">
                <div className="text-xs text-[var(--fg-muted)]">Areas to improve</div>
                <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{ap.areasToImprove}</div>
              </div>
            )}
            {ap.characterNotes && (
              <div className="sm:col-span-2">
                <div className="text-xs text-[var(--fg-muted)]">Character observations</div>
                <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{ap.characterNotes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Training attendance ─────────────────────────────────────────── */}
      {attended.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Training attendance
            </h2>
            {attendanceRate !== null && (
              <span className={`badge ${eligibility?.cls ?? "bg-gray-100 text-gray-700"}`}>
                {presentCount}/{attended.length} sessions — {attendanceRate}%
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...attended].reverse().map((a) => (
              <div
                key={a.id}
                title={`${formatDate(a.session.date)} — ${a.session.sessionType} — ${a.present ? "Present" : "Absent"}`}
                className={`h-5 w-5 rounded ${a.present ? "bg-emerald-500" : "bg-[var(--border)]"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--fg-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500" /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[var(--border)]" /> Absent
            </span>
          </div>
        </div>
      )}

      {/* ── FIFA / FKF compliance ───────────────────────────────────────── */}
      {ap && (ap.fifaPlayerId || ap.fkfRegistrationNo || ap.registrationStatus || ap.passportNo) && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              FIFA / FKF compliance
            </h2>
            {ap.registrationStatus && (
              <span className={`badge ${
                ap.registrationStatus === "REGISTERED" ? "bg-emerald-100 text-emerald-800"
                : ap.registrationStatus === "PENDING"    ? "bg-amber-100 text-amber-800"
                : ap.registrationStatus === "EXPIRED"    ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-700"
              }`}>
                {ap.registrationStatus.toLowerCase()}
              </span>
            )}
          </div>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-3 text-sm">
            {ap.fifaPlayerId && (
              <div>
                <div className="text-xs text-[var(--fg-muted)]">FIFA player ID</div>
                <div className="mt-0.5 font-mono text-[var(--fg)]">{ap.fifaPlayerId}</div>
              </div>
            )}
            {ap.fkfRegistrationNo && (
              <div>
                <div className="text-xs text-[var(--fg-muted)]">FKF registration</div>
                <div className="mt-0.5 font-mono text-[var(--fg)]">{ap.fkfRegistrationNo}</div>
              </div>
            )}
            {ap.passportNo && (
              <div>
                <div className="text-xs text-[var(--fg-muted)]">Passport no.</div>
                <div className="mt-0.5 font-mono text-[var(--fg)]">{ap.passportNo}</div>
              </div>
            )}
            {ap.registeredAt && (
              <div>
                <div className="text-xs text-[var(--fg-muted)]">Registered</div>
                <div className="mt-0.5 text-[var(--fg)]">{formatDate(ap.registeredAt)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit athlete profile (admin / coach) ────────────────────────── */}
      {canEdit && ap && (
        <details className="card">
          <summary className="cursor-pointer font-display text-sm font-semibold text-[var(--brand-primary)] hover:underline">
            Edit athlete profile
          </summary>
          <form action={updateAthleteProfile.bind(null, org, id)} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Jersey no.</label>
                <input name="jerseyNumber" type="number" min="1" max="99" defaultValue={ap.jerseyNumber ?? ""} className="mt-1 w-full" />
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Position</label>
                <select name="position" defaultValue={ap.position ?? ""} className="mt-1 w-full">
                  <option value="">— select —</option>
                  {Object.entries(POSITIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Preferred foot</label>
                <select name="preferredFoot" defaultValue={ap.preferredFoot ?? ""} className="mt-1 w-full">
                  <option value="">—</option>
                  <option value="RIGHT">Right</option>
                  <option value="LEFT">Left</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Height (cm)</label>
                <input name="heightCm" type="number" step="0.1" min="100" max="250" defaultValue={ap.heightCm ?? ""} className="mt-1 w-full" />
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Weight (kg)</label>
                <input name="weightKg" type="number" step="0.1" min="30" max="150" defaultValue={ap.weightKg ?? ""} className="mt-1 w-full" />
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Current club</label>
                <input name="currentClub" defaultValue={ap.currentClub ?? ""} className="mt-1 w-full" placeholder="e.g. Gor Mahia Youth" />
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Registration status</label>
                <select name="registrationStatus" defaultValue={ap.registrationStatus ?? ""} className="mt-1 w-full">
                  <option value="">—</option>
                  <option value="REGISTERED">Registered</option>
                  <option value="PENDING">Pending</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="UNREGISTERED">Unregistered</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">FIFA player ID</label>
                <input name="fifaPlayerId" defaultValue={ap.fifaPlayerId ?? ""} className="mt-1 w-full font-mono" placeholder="FIFA-..." />
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">FKF registration no.</label>
                <input name="fkfRegistrationNo" defaultValue={ap.fkfRegistrationNo ?? ""} className="mt-1 w-full font-mono" placeholder="FKF-..." />
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Passport no.</label>
                <input name="passportNo" defaultValue={ap.passportNo ?? ""} className="mt-1 w-full font-mono" />
              </div>
            </div>
            <div className="space-y-3 border-t border-[var(--border)] pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Scouting notes</p>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Playing strengths</label>
                <textarea name="playingStrengths" rows={3} defaultValue={ap.playingStrengths ?? ""} className="mt-1 w-full" placeholder="Describe key strengths…" />
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Areas to improve</label>
                <textarea name="areasToImprove" rows={3} defaultValue={ap.areasToImprove ?? ""} className="mt-1 w-full" placeholder="Development areas…" />
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Character observations</label>
                <textarea name="characterNotes" rows={3} defaultValue={ap.characterNotes ?? ""} className="mt-1 w-full" placeholder="Attitude, discipline, teamwork…" />
              </div>
            </div>
            <div className="flex justify-end border-t border-[var(--border)] pt-3">
              <button type="submit" className="btn-primary">Save profile</button>
            </div>
          </form>
        </details>
      )}

      {/* Create athlete profile if none exists */}
      {canEdit && !ap && (
        <div className="card space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Athlete profile
          </h2>
          <p className="text-sm text-[var(--fg-muted)]">No athlete profile yet. Create one to track position, physical stats, and compliance.</p>
          <form action={updateAthleteProfile.bind(null, org, id)} className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Jersey no.</label>
              <input name="jerseyNumber" type="number" min="1" max="99" className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Position</label>
              <select name="position" className="mt-1 w-full">
                <option value="">— select —</option>
                {Object.entries(POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Preferred foot</label>
              <select name="preferredFoot" className="mt-1 w-full">
                <option value="">—</option>
                <option value="RIGHT">Right</option>
                <option value="LEFT">Left</option>
                <option value="BOTH">Both</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Current club</label>
              <input name="currentClub" className="mt-1 w-full" placeholder="e.g. Gor Mahia Youth" />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button type="submit" className="btn-primary">Create athlete profile</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Identity ────────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          Identity
        </h2>
        {canEdit && (
          <EditDetailsForm
            org={org}
            beneficiaryId={id}
            data={{
              firstName:            beneficiary.firstName,
              middleName:           beneficiary.middleName,
              lastName:             beneficiary.lastName,
              dateOfBirth:          beneficiary.dateOfBirth ? new Date(beneficiary.dateOfBirth).toISOString().slice(0, 10) : "",
              gender:               beneficiary.gender,
              nationalId:           beneficiary.nationalId,
              birthCertNo:          beneficiary.birthCertNo,
              phone:                beneficiary.phone,
              email:                beneficiary.email,
              address:              beneficiary.address,
              county:               beneficiary.county,
              guardianName:         beneficiary.guardianName,
              guardianPhone:        beneficiary.guardianPhone,
              guardianEmail:        beneficiary.guardianEmail,
              guardianRelationship: beneficiary.guardianRelationship,
            }}
          />
        )}
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
          <div>
            <div className="text-xs text-[var(--fg-muted)]">Date of birth</div>
            {beneficiary.dateOfBirth ? (
              <div className="mt-0.5 text-[var(--fg)]">
                {formatDate(beneficiary.dateOfBirth)}
                {age != null && <span className="ml-2 text-[var(--fg-muted)]">({age} years old)</span>}
              </div>
            ) : (
              <div className="mt-0.5 text-[var(--fg-muted)]">Not recorded — pending registration</div>
            )}
          </div>
          {beneficiary.nationalId && (
            <div>
              <div className="text-xs text-[var(--fg-muted)]">National ID</div>
              <div className="mt-0.5 font-mono text-[var(--fg)]">{beneficiary.nationalId}</div>
            </div>
          )}
          {beneficiary.birthCertNo && (
            <div>
              <div className="text-xs text-[var(--fg-muted)]">Birth certificate</div>
              <div className="mt-0.5 font-mono text-[var(--fg)]">{beneficiary.birthCertNo}</div>
            </div>
          )}
          {beneficiary.phone && (
            <div>
              <div className="text-xs text-[var(--fg-muted)]">Phone</div>
              <div className="mt-0.5 text-[var(--fg)]">{beneficiary.phone}</div>
            </div>
          )}
          {beneficiary.email && (
            <div>
              <div className="text-xs text-[var(--fg-muted)]">Email</div>
              <div className="mt-0.5 text-[var(--fg)]">{beneficiary.email}</div>
            </div>
          )}
          {(beneficiary.address || beneficiary.county) && (
            <div className="sm:col-span-2">
              <div className="text-xs text-[var(--fg-muted)]">Residential area</div>
              <div className="mt-0.5 text-[var(--fg)]">
                {[beneficiary.address, beneficiary.county].filter(Boolean).join(", ")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guardian */}
      {beneficiary.guardianName && (
        <div className="card space-y-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Guardian / Parent
          </h2>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-xs text-[var(--fg-muted)]">Name</div>
              <div className="mt-0.5 text-[var(--fg)]">
                {beneficiary.guardianName}
                {beneficiary.guardianRelationship && (
                  <span className="ml-2 text-[var(--fg-muted)]">({beneficiary.guardianRelationship})</span>
                )}
              </div>
            </div>
            {beneficiary.guardianPhone && (
              <div>
                <div className="text-xs text-[var(--fg-muted)]">Phone</div>
                <div className="mt-0.5 text-[var(--fg)]">{beneficiary.guardianPhone}</div>
              </div>
            )}
            {beneficiary.guardianEmail && (
              <div>
                <div className="text-xs text-[var(--fg-muted)]">Email</div>
                <div className="mt-0.5 text-[var(--fg)]">{beneficiary.guardianEmail}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Academic profile */}
      {(sp || canEdit) && (
        <div className="card space-y-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Academic profile
          </h2>
          {sp ? (
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
              {sp.school && (
                <div>
                  <div className="text-xs text-[var(--fg-muted)]">School</div>
                  <div className="mt-0.5 text-[var(--fg)]">{sp.school}</div>
                </div>
              )}
              {sp.grade && (
                <div>
                  <div className="text-xs text-[var(--fg-muted)]">Grade / class</div>
                  <div className="mt-0.5 text-[var(--fg)]">{sp.grade}</div>
                </div>
              )}
              {sp.scholarshipType && (
                <div>
                  <div className="text-xs text-[var(--fg-muted)]">Scholarship</div>
                  <div className="mt-0.5 text-[var(--fg)]">{sp.scholarshipType}</div>
                </div>
              )}
              {sp.academicScore != null && (
                <div>
                  <div className="text-xs text-[var(--fg-muted)]">Academic score</div>
                  <div className="mt-0.5 text-[var(--fg)]">{sp.academicScore}</div>
                </div>
              )}
              {sp.enrolledAt && (
                <div>
                  <div className="text-xs text-[var(--fg-muted)]">Enrolled</div>
                  <div className="mt-0.5 text-[var(--fg)]">{formatDate(sp.enrolledAt)}</div>
                </div>
              )}
              {sp.academicNotes && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-[var(--fg-muted)]">Academic performance notes</div>
                  <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{sp.academicNotes}</div>
                </div>
              )}
              {sp.notes && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-[var(--fg-muted)]">Notes</div>
                  <div className="mt-0.5 text-[var(--fg)]">{sp.notes}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">No academic profile yet.</p>
          )}

          {canEdit && (
            <details className={sp ? "border-t border-[var(--border)] pt-3" : ""}>
              <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-primary)] hover:underline">
                {sp ? "Edit academic profile" : "Create academic profile"}
              </summary>
              <form action={updateStudentProfile.bind(null, org, id)} className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--fg-muted)]">School</label>
                  <input name="school" defaultValue={sp?.school ?? ""} className="mt-1 w-full" placeholder="e.g. St. Mary's Primary" />
                </div>
                <div>
                  <label className="text-xs text-[var(--fg-muted)]">Grade / class</label>
                  <input name="grade" defaultValue={sp?.grade ?? ""} className="mt-1 w-full" placeholder="e.g. Form 2A" />
                </div>
                <div>
                  <label className="text-xs text-[var(--fg-muted)]">Scholarship type</label>
                  <input name="scholarshipType" defaultValue={sp?.scholarshipType ?? ""} className="mt-1 w-full" placeholder="e.g. Full, Partial" />
                </div>
                <div>
                  <label className="text-xs text-[var(--fg-muted)]">Academic score (0–100)</label>
                  <input name="academicScore" type="number" min="0" max="100" step="0.1" defaultValue={sp?.academicScore ?? ""} className="mt-1 w-full" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-[var(--fg-muted)]">Academic performance notes</label>
                  <textarea name="academicNotes" rows={3} defaultValue={sp?.academicNotes ?? ""} className="mt-1 w-full" placeholder="Performance narrative, strengths, concerns…" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-[var(--fg-muted)]">General notes</label>
                  <textarea name="notes" rows={2} defaultValue={sp?.notes ?? ""} className="mt-1 w-full" />
                </div>
                <div className="sm:col-span-2 flex justify-end pt-1">
                  <button type="submit" className="btn-primary py-1.5 text-sm">Save</button>
                </div>
              </form>
            </details>
          )}
        </div>
      )}

      {/* ── Documents ──────────────────────────────────────────────────── */}
      <DocumentsPanel
        orgSlug={org}
        beneficiaryId={id}
        documents={beneficiary.documents}
        canWrite={canEdit}
      />

      {/* ── Scout reports ───────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-4 w-4 text-[var(--fg-muted)]" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Scout reports
          </h2>
          {beneficiary.scoutReports.length > 0 && (
            <span className="badge bg-[var(--bg-muted)] text-[var(--fg-muted)]">
              {beneficiary.scoutReports.length}
            </span>
          )}
        </div>

        {beneficiary.scoutReports.length > 0 ? (
          <div className="space-y-3">
            {beneficiary.scoutReports.map((report) => {
              const rec = REC_STYLES[report.recommendation] ?? { cls: "bg-gray-100 text-gray-700", label: report.recommendation };
              return (
                <div key={report.id} className="rounded-xl border border-[var(--border)] p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${rec.cls}`}>{rec.label}</span>
                    <span className="text-xs text-[var(--fg-muted)]">{formatDate(report.reportDate)}</span>
                    {report.scout?.name && (
                      <span className="text-xs text-[var(--fg-muted)]">· by {report.scout.name}</span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    {report.strengths && (
                      <div>
                        <div className="text-xs text-[var(--fg-muted)]">Strengths</div>
                        <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{report.strengths}</div>
                      </div>
                    )}
                    {report.areasToImprove && (
                      <div>
                        <div className="text-xs text-[var(--fg-muted)]">Areas to improve</div>
                        <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{report.areasToImprove}</div>
                      </div>
                    )}
                    {report.characterNotes && (
                      <div>
                        <div className="text-xs text-[var(--fg-muted)]">Character</div>
                        <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{report.characterNotes}</div>
                      </div>
                    )}
                    {report.academicNotes && (
                      <div>
                        <div className="text-xs text-[var(--fg-muted)]">Academic</div>
                        <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{report.academicNotes}</div>
                      </div>
                    )}
                    {report.notes && (
                      <div className="sm:col-span-2">
                        <div className="text-xs text-[var(--fg-muted)]">Additional notes</div>
                        <div className="mt-0.5 whitespace-pre-line text-[var(--fg)]">{report.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No scout reports yet.</p>
        )}

        {canEdit && (
          <details className={beneficiary.scoutReports.length > 0 ? "border-t border-[var(--border)] pt-4" : ""}>
            <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-primary)] hover:underline">
              Add scout report
            </summary>
            <form action={createScoutReport.bind(null, org, id)} className="mt-3 space-y-3">
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Recommendation <span className="text-[var(--brand-accent)]">*</span></label>
                <select name="recommendation" required className="mt-1 w-full">
                  <option value="">— select —</option>
                  <option value="SIGN">Sign</option>
                  <option value="MONITOR">Monitor</option>
                  <option value="DECLINE">Decline</option>
                  <option value="REVIEW_LATER">Review later</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--fg-muted)]">Playing strengths</label>
                  <textarea name="strengths" rows={3} className="mt-1 w-full" placeholder="Key strengths observed…" />
                </div>
                <div>
                  <label className="text-xs text-[var(--fg-muted)]">Areas to improve</label>
                  <textarea name="areasToImprove" rows={3} className="mt-1 w-full" placeholder="Development areas…" />
                </div>
                <div>
                  <label className="text-xs text-[var(--fg-muted)]">Character observations</label>
                  <textarea name="characterNotes" rows={3} className="mt-1 w-full" placeholder="Attitude, discipline, coachability…" />
                </div>
                <div>
                  <label className="text-xs text-[var(--fg-muted)]">Academic notes</label>
                  <textarea name="academicNotes" rows={3} className="mt-1 w-full" placeholder="School performance, attendance…" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--fg-muted)]">Additional notes</label>
                <textarea name="notes" rows={2} className="mt-1 w-full" placeholder="Any other observations…" />
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" className="btn-primary">Submit report</button>
              </div>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
