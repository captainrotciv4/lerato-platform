import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { createStaff } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Add staff/volunteer — Lerato Platform" };

export default async function NewStaffPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const branches = await dbRetry(() => prisma.branch.findMany({
    where: { organizationId: ctx.organization.id, active: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${org}/staff` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to staff
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Add staff or volunteer</h1>
      </div>
      <form
        action={async (formData) => { "use server"; await createStaff(org, formData); }}
        className="card grid gap-3 sm:grid-cols-2"
      >
        <div><label>First name *</label><input name="firstName" required className="mt-1 w-full" /></div>
        <div><label>Last name *</label><input name="lastName" required className="mt-1 w-full" /></div>
        <div><label>Email</label><input name="email" type="email" className="mt-1 w-full" /></div>
        <div><label>Phone</label><input name="phone" type="tel" className="mt-1 w-full" /></div>
        <div>
          <label>Type *</label>
          <select name="type" required className="mt-1 w-full" defaultValue="VOLUNTEER">
            <option value="EMPLOYEE">Employee</option>
            <option value="VOLUNTEER">Volunteer</option>
            <option value="COACH">Coach</option>
            <option value="MENTOR">Mentor</option>
            <option value="INTERN">Intern</option>
            <option value="CONSULTANT">Consultant</option>
          </select>
        </div>
        <div><label>Position</label><input name="position" className="mt-1 w-full" placeholder="e.g. Head Coach" /></div>
        <div><label>Department</label><input name="department" className="mt-1 w-full" placeholder="e.g. Sports, Programmes" /></div>
        <div><label>Start date</label><input name="startDate" type="date" className="mt-1 w-full" /></div>
        {branches.length > 0 && (
          <div>
            <label>Branch</label>
            <select name="branchId" className="mt-1 w-full" defaultValue={ctx.branchId ?? ""}>
              <option value="">— All / unassigned —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/staff` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
