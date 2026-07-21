import { requireTenant } from "@/lib/tenant/context";
import { createEvent } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New event — Lerato Platform" };

export default async function NewEventPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await requireTenant(org);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${org}/events` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>
      <div><h1 className="font-display text-3xl font-bold text-[var(--fg)]">New event</h1></div>
      <form action={async (fd) => { "use server"; await createEvent(org, fd); }} className="card grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label>Event name *</label><input name="name" required className="mt-1 w-full" /></div>
        <div>
          <label>Type *</label>
          <select name="type" required className="mt-1 w-full" defaultValue="TOURNAMENT">
            <option value="TOURNAMENT">Tournament</option>
            <option value="FUNDRAISER">Fundraiser</option>
            <option value="TRAINING_CAMP">Training camp</option>
            <option value="MISSION_DEPARTURE">Mission departure</option>
            <option value="COMMUNITY_DAY">Community day</option>
            <option value="BOARD_MEETING">Board meeting</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div><label>Venue</label><input name="venue" className="mt-1 w-full" /></div>
        <div><label>Starts *</label><input name="startsAt" type="datetime-local" required className="mt-1 w-full" /></div>
        <div><label>Ends</label><input name="endsAt" type="datetime-local" className="mt-1 w-full" /></div>
        <div><label>Capacity</label><input name="capacity" type="number" min="0" className="mt-1 w-full" /></div>
        <div className="sm:col-span-2"><label>Description</label><textarea name="description" rows={3} className="mt-1 w-full" /></div>
        <div className="sm:col-span-2 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/events` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create event</button>
        </div>
      </form>
    </div>
  );
}
