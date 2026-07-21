import { requireTenant } from "@/lib/tenant/context";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BeneficiaryForm } from "./beneficiary-form";

export const metadata = { title: "Add player — Lerato Platform" };

export default async function NewBeneficiaryPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  const isAcademy = ctx.organization.type === "ACADEMY";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/${org}/beneficiaries` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> {isAcademy ? "Back to players" : "Back to beneficiaries"}
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">
          {isAcademy ? "Register player" : "Add beneficiary"}
        </h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {isAcademy
            ? "Add a new player to the database. Works offline — data saves locally and syncs when you reconnect."
            : "Register a new student, player, or programme participant. Works offline."}
        </p>
      </div>

      <BeneficiaryForm org={org} isAcademy={isAcademy} />
    </div>
  );
}
