import { requireTenant } from "@/lib/tenant/context";
import { createProgram } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New programme — Lerato Platform" };

export default async function NewProgramPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await requireTenant(org);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${org}/education` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to programmes
      </Link>
      <div><h1 className="font-display text-3xl font-bold text-[var(--fg)]">New programme</h1></div>
      <form action={async (fd) => { "use server"; await createProgram(org, fd); }} className="card grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label>Name *</label><input name="name" required className="mt-1 w-full" /></div>
        <div>
          <label>Type *</label>
          <select name="type" required className="mt-1 w-full" defaultValue="EDUCATION">
            <option value="EDUCATION">Education</option>
            <option value="LIFE_PROGRAM">Life Programme (A Meal A Day, Water)</option>
            <option value="SPORTS_DARAJANI">Sports — Darajani</option>
            <option value="MENTORSHIP">Mentorship</option>
            <option value="COMMUNITY_DEV">Community Development</option>
            <option value="AGAPE_MISSION">Agape Mission</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label>Status</label>
          <select name="status" className="mt-1 w-full" defaultValue="ACTIVE">
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div><label>Start date</label><input name="startDate" type="date" className="mt-1 w-full" /></div>
        <div><label>End date</label><input name="endDate" type="date" className="mt-1 w-full" /></div>
        <div className="sm:col-span-2"><label>Description</label><textarea name="description" rows={3} className="mt-1 w-full" /></div>
        <div className="sm:col-span-2 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/education` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create programme</button>
        </div>
      </form>
    </div>
  );
}
