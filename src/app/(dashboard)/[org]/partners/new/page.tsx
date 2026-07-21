import { requireTenant } from "@/lib/tenant/context";
import { createPartner } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Add partner — Lerato Platform" };

export default async function NewPartnerPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await requireTenant(org);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${org}/partners` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to partners
      </Link>
      <div><h1 className="font-display text-3xl font-bold text-[var(--fg)]">Add partner</h1></div>
      <form action={async (fd) => { "use server"; await createPartner(org, fd); }} className="card grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label>Partner name *</label>
          <input name="partnerName" required className="mt-1 w-full" placeholder="e.g. Agape in Action" />
        </div>
        <div>
          <label>Type *</label>
          <select name="partnerType" required className="mt-1 w-full" defaultValue="STRATEGIC">
            <option value="STRATEGIC">Strategic</option>
            <option value="COMMUNITY">Community</option>
            <option value="SUPPORTING">Supporting</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div><label>Website</label><input name="website" type="url" className="mt-1 w-full" placeholder="https://" /></div>
        <div><label>Contact name</label><input name="contactName" className="mt-1 w-full" /></div>
        <div><label>Contact email</label><input name="contactEmail" type="email" className="mt-1 w-full" /></div>
        <div><label>Contact phone</label><input name="contactPhone" type="tel" className="mt-1 w-full" /></div>
        <div className="sm:col-span-2">
          <label>Description</label>
          <textarea name="description" rows={3} className="mt-1 w-full" placeholder="What this partnership covers…" />
        </div>
        <div className="sm:col-span-2 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/partners` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save partner</button>
        </div>
      </form>
    </div>
  );
}
