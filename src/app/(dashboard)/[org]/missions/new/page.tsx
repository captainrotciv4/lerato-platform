import { requireTenant } from "@/lib/tenant/context";
import { createMission } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New mission — Lerato Platform" };

export default async function NewMissionPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await requireTenant(org);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${org}/missions` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to missions
      </Link>
      <div><h1 className="font-display text-3xl font-bold text-[var(--fg)]">New mission</h1></div>
      <form action={async (fd) => { "use server"; await createMission(org, fd); }} className="card grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label>Mission name *</label>
          <input name="name" required className="mt-1 w-full" placeholder="e.g. World Cup Engagement Programme 2026" />
        </div>
        <div>
          <label>Type *</label>
          <select name="type" required className="mt-1 w-full" defaultValue="ENGAGEMENT_PROGRAMME">
            <option value="EVANGELISM">Evangelism</option>
            <option value="HUMANITARIAN">Humanitarian</option>
            <option value="ENGAGEMENT_PROGRAMME">Engagement programme</option>
            <option value="CAPACITY_BUILDING">Capacity building</option>
            <option value="PARTNERSHIP_VISIT">Partnership visit</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div><label>Destination summary *</label><input name="destination" required className="mt-1 w-full" placeholder="e.g. Senegal, Nigeria" /></div>
        <div className="sm:col-span-2">
          <label>Countries (comma-separated)</label>
          <input name="countries" className="mt-1 w-full" placeholder="Senegal, Nigeria" />
        </div>
        <div><label>Departure date</label><input name="departureDate" type="date" className="mt-1 w-full" /></div>
        <div><label>Return date</label><input name="returnDate" type="date" className="mt-1 w-full" /></div>
        <div><label>Budget (KES)</label><input name="budget" type="number" step="0.01" min="0" className="mt-1 w-full" placeholder="0" /></div>
        <div className="sm:col-span-2"><label>Description</label><textarea name="description" rows={3} className="mt-1 w-full" /></div>
        <div className="sm:col-span-2 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/missions` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create mission</button>
        </div>
      </form>
    </div>
  );
}
