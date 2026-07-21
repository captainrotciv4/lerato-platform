import { requireTenant, getAccessibleOrganizations } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { createAllocation } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New allocation — Lerato Platform" };

export default async function NewAllocationPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const [allOrgs, programsInSource] = await dbRetry(() =>
    Promise.all([
      prisma.organization.findMany({ orderBy: { name: "asc" } }),
      prisma.program.findMany({
        where: { organizationId: ctx.organization.id, deletedAt: null },
        orderBy: { name: "asc" },
      }),
    ])
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${org}/allocations` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to allocations
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">New fund allocation</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Move funds between organizations or between programmes. Approval requirements are determined by amount.
        </p>
      </div>

      <form
        action={async (formData) => { "use server"; await createAllocation(org, formData); }}
        className="card space-y-5"
      >
        {/* Hidden source = current org */}
        <input type="hidden" name="sourceOrgSlug" value={ctx.organization.slug} />

        <Section title="What & Why">
          <div className="sm:col-span-2">
            <label>Title *</label>
            <input name="title" required className="mt-1 w-full" placeholder="e.g. Q3 Darajani training equipment top-up" />
          </div>
          <div className="sm:col-span-2">
            <label>Description</label>
            <textarea name="description" rows={3} className="mt-1 w-full" placeholder="Context for the approvers..." />
          </div>
          <div>
            <label>Category</label>
            <input name="category" className="mt-1 w-full" placeholder="Equipment / Travel / Programme top-up" />
          </div>
        </Section>

        <Section title="Money">
          <div>
            <label>Amount (KES) *</label>
            <input name="amount" type="number" step="0.01" min="0.01" required className="mt-1 w-full" placeholder="0.00" />
          </div>
          <div>
            <label>Currency</label>
            <select name="currency" className="mt-1 w-full" defaultValue="KES">
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </Section>

        <Section title="Flow">
          <div>
            <label>From (source)</label>
            <input value={ctx.organization.shortName} disabled className="mt-1 w-full !bg-[var(--bg-muted)]" />
            <p className="mt-1 text-xs text-[var(--fg-muted)]">Always your current organization</p>
          </div>
          <div>
            <label>To (destination) *</label>
            <select name="destinationOrgSlug" required className="mt-1 w-full" defaultValue={ctx.organization.slug}>
              {allOrgs.map((o) => (
                <option key={o.slug} value={o.slug}>{o.shortName} ({o.type.toLowerCase()})</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">Same org for inter-programme transfers</p>
          </div>
          <div>
            <label>Source programme (optional)</label>
            <select name="sourceProgramId" className="mt-1 w-full">
              <option value="">Main pool</option>
              {programsInSource.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label>Destination programme (optional)</label>
            <input name="destinationProgramId" className="mt-1 w-full" placeholder="(programme ID — coming in detail page)" />
            <p className="mt-1 text-xs text-[var(--fg-muted)]">Leave blank for the destination org&apos;s main pool</p>
          </div>
        </Section>

        <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>How approval works:</strong> Once you save this draft, you&apos;ll be taken to the detail page where you can submit it for approval. The system calculates required approvers from your org&apos;s thresholds — small amounts need 1, mid-tier need 2, large amounts need 3 (including a Board Member).
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
          <Link href={`/${org}/allocations` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save as draft</button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}
