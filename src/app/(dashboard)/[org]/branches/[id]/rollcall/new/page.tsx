import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { RollcallForm } from "../rollcall-form";

export const metadata = { title: "Take Rollcall — Lerato Platform" };

export default async function NewRollcallPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  const branch = await dbRetry(() =>
    prisma.branch.findFirst({
      where: { id, organizationId: ctx.organization.id },
      include: {
        beneficiaries: {
          where: { deletedAt: null },
          orderBy: [{ admissionNo: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
          include: { athleteProfile: { select: { position: true, jerseyNumber: true } } },
        },
      },
    })
  );
  if (!branch) notFound();

  const today = new Date().toISOString().split("T")[0];
  const branchTheme = {
    "--brand-primary": branch.primaryColor,
    "--brand-accent":  branch.accentColor,
  } as React.CSSProperties;

  return (
    <div className="mx-auto max-w-2xl space-y-6" style={branchTheme}>
      <Link
        href={`/${org}/branches/${id}` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {branch.name}
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Take Rollcall</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {branch.name} · {branch.beneficiaries.length} player{branch.beneficiaries.length !== 1 && "s"} · Works offline
        </p>
      </div>

      {branch.beneficiaries.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-[var(--fg-muted)] opacity-40" />
          <p className="mt-3 text-sm text-[var(--fg-muted)]">No players are assigned to this branch yet.</p>
          <Link href={`/${org}/beneficiaries` as any} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
            Assign players from beneficiaries
          </Link>
        </div>
      ) : (
        <RollcallForm
          org={org}
          branchId={id}
          branchName={branch.name}
          players={branch.beneficiaries}
          today={today}
        />
      )}
    </div>
  );
}
