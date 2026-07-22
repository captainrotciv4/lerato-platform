import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { createTeamMember } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Add team member — Lerato Platform" };

const ROLES = [
  { value: "ADMIN",             label: "Admin — full access" },
  { value: "FINANCE_LEAD",      label: "Finance Lead — finance + approvals" },
  { value: "FINANCE",           label: "Finance — view & enter transactions" },
  { value: "PROGRAMME_MANAGER", label: "Programme Manager — programmes & beneficiaries" },
  { value: "COMMUNICATIONS",    label: "Communications — send & view comms" },
  { value: "FIELD_STAFF",       label: "Field Staff — limited field access" },
  { value: "BOARD_OBSERVER",    label: "Board Observer — read-only" },
  { value: "BOARD_MEMBER",      label: "Board Member — read + approvals" },
];

export default async function NewTeamMemberPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ORG_SETTINGS)) redirect(`/${org}`);

  const branches = await dbRetry(() =>
    prisma.branch.findMany({
      where: { organizationId: ctx.organization.id, active: true },
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    })
  );

  const action = createTeamMember.bind(null, org);

  const input = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30";
  const label = "block text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)] mb-1.5";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/${org}/settings/team` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to team
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Add team member</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Create a new login account and assign them to {ctx.organization.shortName}
          {branches.length > 0 ? " and optionally a specific branch." : "."}
        </p>
      </div>

      <form action={action} className="card space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Full name *</label>
            <input name="name" required placeholder="e.g. John Otieno" className={input} />
          </div>
          <div>
            <label className={label}>Job title</label>
            <input name="title" placeholder="e.g. Head Coach" className={input} />
          </div>
          <div>
            <label className={label}>Email address *</label>
            <input name="email" type="email" required placeholder="user@example.com" className={input} />
          </div>
          <div>
            <label className={label}>Temporary password *</label>
            <input name="password" type="password" required minLength={8} placeholder="Min 8 characters" className={input} />
          </div>
          <div>
            <label className={label}>Platform role *</label>
            <select name="role" required className={input} defaultValue="FIELD_STAFF">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {branches.length > 0 && (
            <div>
              <label className={label}>Assigned branch</label>
              <select name="branchId" className={input} defaultValue="">
                <option value="">— All branches (no restriction) —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Branch-scoped users only see data for their assigned branch.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/settings/team` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create account</button>
        </div>
      </form>
    </div>
  );
}
