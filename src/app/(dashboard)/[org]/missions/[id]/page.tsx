import { requireTenant } from "@/lib/tenant/context";
import { prisma } from "@/lib/db/prisma";
import { addDelegate } from "../actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { formatDate, formatKES } from "@/lib/utils";

export const metadata = { title: "Mission — Lerato Platform" };

const VISA_STYLE: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  APPLIED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-amber-100 text-amber-900",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  EXEMPT: "bg-purple-100 text-purple-900",
};

export default async function MissionDetailPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  const mission = await prisma.mission.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { delegates: { orderBy: { createdAt: "asc" } } },
  });
  if (!mission) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/${org}/missions` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to missions
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">{mission.type.replace("_", " ").toLowerCase()}</div>
            <h1 className="mt-1 font-display text-3xl font-bold text-[var(--fg)]">{mission.name}</h1>
            <div className="mt-2 text-sm text-[var(--fg-muted)]">{mission.destination}</div>
            {mission.description && <p className="mt-3 text-sm text-[var(--fg)]">{mission.description}</p>}
          </div>
          <span className="badge bg-purple-100 text-purple-900">{mission.status.replace("_", " ").toLowerCase()}</span>
        </div>
        <div className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-4 text-sm">
          <div><div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Departs</div><div className="font-medium text-[var(--fg)]">{formatDate(mission.departureDate)}</div></div>
          <div><div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Returns</div><div className="font-medium text-[var(--fg)]">{formatDate(mission.returnDate)}</div></div>
          <div><div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Delegates</div><div className="font-medium text-[var(--fg)]">{mission.delegates.length}</div></div>
          <div><div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">Budget</div><div className="font-medium text-[var(--fg)]">{mission.budget ? formatKES(Number(mission.budget)) : "—"}</div></div>
        </div>
      </div>

      {/* Add delegate */}
      <div className="card">
        <h2 className="font-display text-lg font-semibold text-[var(--fg)]">Add delegate</h2>
        <form action={async (fd) => { "use server"; await addDelegate(org, fd); }} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="missionId" value={mission.id} />
          <div><label>First name *</label><input name="firstName" required className="mt-1 w-full" /></div>
          <div><label>Last name *</label><input name="lastName" required className="mt-1 w-full" /></div>
          <div><label>Role</label><input name="role" className="mt-1 w-full" placeholder="Delegate / Accompanying" /></div>
          <div><label>Email</label><input name="email" type="email" className="mt-1 w-full" /></div>
          <div><label>Phone</label><input name="phone" type="tel" className="mt-1 w-full" /></div>
          <div>
            <label>Visa status</label>
            <select name="visaStatus" className="mt-1 w-full" defaultValue="NOT_STARTED">
              <option value="NOT_STARTED">Not started</option>
              <option value="APPLIED">Applied</option>
              <option value="PROCESSING">Processing</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXEMPT">Exempt (visa-free)</option>
            </select>
          </div>
          <div><label>Passport number</label><input name="passportNo" className="mt-1 w-full" /></div>
          <div><label>Passport expiry</label><input name="passportExpiry" type="date" className="mt-1 w-full" /></div>
          <div className="sm:col-span-3 flex items-center justify-end">
            <button type="submit" className="btn-primary inline-flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Add delegate
            </button>
          </div>
        </form>
      </div>

      {/* Delegate roster */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-[var(--fg)]">Delegate roster</h2>
        </div>
        {mission.delegates.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No delegates yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">Role</th>
                <th className="px-6 py-3 text-left font-medium">Passport</th>
                <th className="px-6 py-3 text-left font-medium">Visa</th>
              </tr>
            </thead>
            <tbody>
              {mission.delegates.map((d) => (
                <tr key={d.id} className="border-t border-[var(--border)]">
                  <td className="px-6 py-3 font-medium text-[var(--fg)]">{d.firstName} {d.lastName}
                    {d.email && <div className="text-xs font-normal text-[var(--fg-muted)]">{d.email}</div>}
                  </td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">{d.role || "—"}</td>
                  <td className="px-6 py-3 font-mono text-xs text-[var(--fg-muted)]">
                    {d.passportNo || "—"}
                    {d.passportExpiry && <div className="font-sans">Exp: {formatDate(d.passportExpiry)}</div>}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`badge ${VISA_STYLE[d.visaStatus]}`}>{d.visaStatus.replace("_", " ").toLowerCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
