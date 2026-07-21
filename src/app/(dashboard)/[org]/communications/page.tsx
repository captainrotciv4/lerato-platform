import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { Plus, Mail, MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Communications — Lerato Platform" };

const TYPE_ICON: Record<string, any> = {
  SMS: MessageSquare,
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  PUSH_NOTIFICATION: MessageSquare,
  INTERNAL_ANNOUNCEMENT: Mail,
};

export default async function CommunicationsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const comms = await dbRetry(() => prisma.communication.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Communications</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Bulk SMS, email campaigns, WhatsApp, and internal announcements.
          </p>
        </div>
        <Link href={`/${org}/communications/new` as any} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Compose
        </Link>
      </div>

      <div className="card !p-0 overflow-hidden">
        {comms.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No communications sent yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Channel</th>
                <th className="px-6 py-3 text-left font-medium">Subject</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Recipients</th>
                <th className="px-6 py-3 text-right font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {comms.map((c) => {
                const Icon = TYPE_ICON[c.type] || Mail;
                return (
                  <tr key={c.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-muted)]">
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-2 text-[var(--fg)]">
                        <Icon className="h-4 w-4 text-[var(--fg-muted)]" />
                        {c.type.replace("_", " ").toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium text-[var(--fg)]">{c.subject || "(no subject)"}
                      <div className="text-xs font-normal text-[var(--fg-muted)] truncate max-w-md">{c.body.slice(0, 80)}…</div>
                    </td>
                    <td className="px-6 py-3 text-[var(--fg-muted)]">{c.status.toLowerCase()}</td>
                    <td className="px-6 py-3 text-right text-[var(--fg)]">
                      <div>{c.recipientCount}</div>
                      {c.recipientCount > 0 && (
                        <div className="text-xs text-[var(--fg-muted)]">
                          {c.successCount} ✓ · {c.failureCount} ✗
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right text-[var(--fg-muted)]">{formatDate(c.sentAt) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
