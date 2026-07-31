import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ShieldAlert, Check, X, ClipboardList, LogIn } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Audit Logs — Lerato Platform" };

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN:  "bg-violet-100 text-violet-700",
  EXPORT: "bg-amber-100 text-amber-700",
};

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { org } = await params;
  const { tab = "activity" } = await searchParams;
  const ctx = await requireTenant(org);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.AUDIT_VIEW)) redirect(`/${org}`);

  const base = `/${org}/settings/audit`;

  if (tab === "logins") {
    const memberIds = await dbRetry(() =>
      prisma.membership.findMany({
        where: { organizationId: ctx.organization.id },
        select: { userId: true },
      })
    );
    const userIds = memberIds.map((m) => m.userId);

    const logs = await dbRetry(() =>
      prisma.loginLog.findMany({
        where: { userId: { in: userIds } },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    );

    return (
      <AuditShell org={org} tab="logins" base={base}>
        {logs.length === 0 ? (
          <EmptyState message="No sign-in events recorded yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Result</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">IP Address</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Browser / Device</th>
                <th className="px-4 py-3 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--fg)]">{log.user?.name ?? "—"}</div>
                    <div className="text-xs text-[var(--fg-muted)]">{log.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${log.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {log.success ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {log.success ? "Success" : "Failed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="font-mono text-xs text-[var(--fg-muted)]">{log.ipAddress ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="max-w-[260px] truncate block text-xs text-[var(--fg-muted)]">
                      {log.userAgent ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <time
                      dateTime={log.createdAt.toISOString()}
                      className="text-xs text-[var(--fg-muted)]"
                      title={log.createdAt.toLocaleString()}
                    >
                      {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {logs.length === 200 && (
          <p className="px-4 py-2 text-xs text-[var(--fg-muted)] border-t border-[var(--border)]">
            Showing the 200 most recent sign-in events.
          </p>
        )}
      </AuditShell>
    );
  }

  // ── Activity log (default) ──────────────────────────────────────────────────
  const logs = await dbRetry(() =>
    prisma.auditLog.findMany({
      where: { organizationId: ctx.organization.id },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  );

  return (
    <AuditShell org={org} tab="activity" base={base}>
      {logs.length === 0 ? (
        <EmptyState message="No platform activity recorded yet." />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Actor</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Record</th>
              <th className="px-4 py-3 text-right font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                <td className="px-4 py-3">
                  {log.actor ? (
                    <>
                      <div className="font-medium text-[var(--fg)]">{log.actor.name}</div>
                      <div className="text-xs text-[var(--fg-muted)]">{log.actor.email}</div>
                    </>
                  ) : (
                    <span className="text-xs italic text-[var(--fg-muted)]">System</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action] ?? "bg-[var(--bg-muted)] text-[var(--fg-muted)]"}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-[var(--fg)]">{log.entity}</span>
                  {log.entityId && (
                    <span className="ml-1.5 font-mono text-xs text-[var(--fg-muted)]">
                      #{log.entityId.slice(-6)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <time
                    dateTime={log.createdAt.toISOString()}
                    className="text-xs text-[var(--fg-muted)]"
                    title={log.createdAt.toLocaleString()}
                  >
                    {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {logs.length === 200 && (
        <p className="px-4 py-2 text-xs text-[var(--fg-muted)] border-t border-[var(--border)]">
          Showing the 200 most recent activity entries.
        </p>
      )}
    </AuditShell>
  );
}

function AuditShell({
  org,
  tab,
  base,
  children,
}: {
  org: string;
  tab: string;
  base: string;
  children: React.ReactNode;
}) {
  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-[var(--brand-primary)] text-white"
        : "text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
    }`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Audit Logs</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Full record of who did what and when across {org}.
          </p>
        </div>
        <ShieldAlert className="h-6 w-6 text-[var(--fg-muted)]" />
      </div>

      <div className="flex gap-2">
        <Link href={`${base}?tab=activity` as any} className={tabCls(tab === "activity")}>
          <ClipboardList className="h-4 w-4" />
          Platform Activity
        </Link>
        <Link href={`${base}?tab=logins` as any} className={tabCls(tab === "logins")}>
          <LogIn className="h-4 w-4" />
          Sign-in Logs
        </Link>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-6 py-12 text-center text-sm text-[var(--fg-muted)]">{message}</div>
  );
}
