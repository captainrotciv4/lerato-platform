import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { removeMember } from "./actions";
import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { initials } from "@/lib/utils";

export const metadata = { title: "Team — Lerato Platform" };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PROGRAMME_MANAGER: "Programme Manager",
  FINANCE: "Finance",
  FINANCE_LEAD: "Finance Lead",
  COMMUNICATIONS: "Communications",
  FIELD_STAFF: "Field Staff",
  BOARD_OBSERVER: "Board Observer",
  BOARD_MEMBER: "Board Member",
};

export default async function TeamPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ORG_SETTINGS)) redirect(`/${org}`);

  const members = await dbRetry(() =>
    prisma.membership.findMany({
      where: { organizationId: ctx.organization.id, active: true, revokedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true, title: true, lastSeenAt: true } },
        branch: { select: { name: true } },
      },
      orderBy: { joinedAt: "asc" },
    })
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Team</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Platform users with access to {ctx.organization.shortName}.
          </p>
        </div>
        <Link href={`/${org}/settings/team/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add member
        </Link>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Member</th>
              <th className="px-5 py-3 text-left font-medium">Role</th>
              <th className="px-5 py-3 text-left font-medium">Branch</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: ctx.organization.primaryColor }}
                    >
                      {initials(m.user.name)}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--fg)]">
                        {m.user.name}
                        {m.user.id === ctx.user.id && (
                          <span className="ml-1.5 text-[10px] text-[var(--fg-muted)]">(you)</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--fg-muted)]">{m.user.email}</div>
                      {m.user.title && <div className="text-xs text-[var(--fg-muted)]">{m.user.title}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="badge bg-[var(--bg-muted)] text-[var(--fg)]">
                    {ROLE_LABELS[m.role] ?? m.role.toLowerCase().replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-3 text-[var(--fg-muted)]">
                  {m.branch ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {m.branch.name}
                    </span>
                  ) : (
                    <span className="text-xs italic">All branches</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {m.user.id !== ctx.user.id && (
                    <form action={removeMember.bind(null, org, m.id)}>
                      <button className="text-xs text-red-500 hover:underline">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
