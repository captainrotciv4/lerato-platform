import { requireTenant } from "@/lib/tenant/context";
import { createCommunication } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Compose — Lerato Platform" };

export default async function NewCommunicationPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await requireTenant(org);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${org}/communications` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to communications
      </Link>
      <div><h1 className="font-display text-3xl font-bold text-[var(--fg)]">Compose</h1></div>
      <form action={async (fd) => { "use server"; await createCommunication(org, fd); }} className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label>Channel *</label>
            <select name="type" required className="mt-1 w-full" defaultValue="SMS">
              <option value="SMS">SMS (Africa&apos;s Talking)</option>
              <option value="EMAIL">Email (Resend)</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PUSH_NOTIFICATION">Push notification</option>
              <option value="INTERNAL_ANNOUNCEMENT">Internal announcement</option>
            </select>
          </div>
          <div>
            <label>Audience</label>
            <select name="audience" className="mt-1 w-full" defaultValue="DRAFT_ONLY">
              <option value="DRAFT_ONLY">Draft only (no recipients yet)</option>
              <option value="ALL_BENEFICIARIES">All beneficiaries</option>
              <option value="ALL_DONORS">All donors</option>
              <option value="ALL_STAFF">All active staff</option>
            </select>
          </div>
        </div>
        <div><label>Subject (for email)</label><input name="subject" className="mt-1 w-full" placeholder="…" /></div>
        <div>
          <label>Message *</label>
          <textarea name="body" rows={8} required className="mt-1 w-full" placeholder="Type your message…" />
          <p className="mt-1 text-xs text-[var(--fg-muted)]">SMS limit: 160 characters per segment. Africa&apos;s Talking splits longer messages automatically.</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/communications` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save as draft</button>
        </div>
        <p className="text-xs text-[var(--fg-muted)]">
          Drafts are saved with audience count; actual send is triggered separately once integrations are configured in <code>.env</code>.
        </p>
      </form>
    </div>
  );
}
