import { requireTenant } from "@/lib/tenant/context";
import { prisma } from "@/lib/db/prisma";
import { formatDistanceToNow } from "date-fns";
import { Monitor, ShieldCheck, X, Check } from "lucide-react";
import { ChangePasswordForm } from "./change-password-form";

export default async function SecurityPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const logs = await prisma.loginLog.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Security</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Manage your password and review recent sign-in activity.</p>
      </div>

      <ChangePasswordForm />

      {/* Login history */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-[var(--fg-muted)]" />
          <h2 className="font-display text-base font-semibold text-[var(--fg)]">Recent sign-in activity</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">No sign-in history yet.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-4 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${log.success ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                    {log.success
                      ? <Check className="h-3.5 w-3.5" />
                      : <X className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--fg)]">
                      {log.success ? "Successful sign-in" : "Failed sign-in attempt"}
                    </p>
                    {log.ipAddress && (
                      <p className="mt-0.5 font-mono text-xs text-[var(--fg-muted)]">{log.ipAddress}</p>
                    )}
                    {log.userAgent && (
                      <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{log.userAgent}</p>
                    )}
                  </div>
                </div>
                <time
                  dateTime={log.createdAt.toISOString()}
                  className="shrink-0 text-xs text-[var(--fg-muted)]"
                  title={log.createdAt.toLocaleString()}
                >
                  {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                </time>
              </div>
            ))}
          </div>
        )}
        {logs.length === 30 && (
          <p className="text-xs text-[var(--fg-muted)]">Showing last 30 entries.</p>
        )}
      </div>
    </div>
  );
}
