import { requireTenant } from "@/lib/tenant/context";
import { createBranch } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Add branch — Lerato Platform" };

export default async function NewBranchPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await requireTenant(org);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/${org}/branches` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to branches
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Add branch</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Register a new training location or operational site.</p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await createBranch(org, formData);
        }}
        className="card space-y-5"
      >
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Branch details
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name">Branch name <span className="text-[var(--brand-accent)]">*</span></label>
              <input id="name" name="name" required placeholder="e.g. Darajani Elite" className="mt-1 w-full" />
            </div>
            <div>
              <label htmlFor="location">Location</label>
              <input id="location" name="location" placeholder="e.g. Mwiki, Nairobi Kasarani" className="mt-1 w-full" />
            </div>
            <div>
              <label htmlFor="county">County</label>
              <input id="county" name="county" placeholder="e.g. Nairobi" className="mt-1 w-full" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description">Description (optional)</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Brief description of this branch…"
                className="mt-1 w-full"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--border)] pt-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Theme colours
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="primaryColor">Primary colour</label>
              <div className="mt-1 flex items-center gap-2">
                <input id="primaryColor" name="primaryColor" type="color" defaultValue="#16A34A" className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] p-0.5" />
                <span className="text-xs text-[var(--fg-muted)]">Branch identity colour</span>
              </div>
            </div>
            <div>
              <label htmlFor="accentColor">Accent colour</label>
              <div className="mt-1 flex items-center gap-2">
                <input id="accentColor" name="accentColor" type="color" defaultValue="#FACC15" className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] p-0.5" />
                <span className="text-xs text-[var(--fg-muted)]">Buttons &amp; highlights</span>
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm pt-1">
            <input type="checkbox" name="isMain" value="true" className="!w-auto" />
            <span>This is the main / flagship location</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
          <Link href={`/${org}/branches` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save branch</button>
        </div>
      </form>
    </div>
  );
}
