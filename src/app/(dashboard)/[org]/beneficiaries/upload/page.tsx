import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { UploadBeneficiariesForm } from "./upload-form";

export const metadata = { title: "Import players — Lerato Platform" };

export default async function UploadPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  if (!can(ctx.role, ctx.permissions, PERMISSIONS.BENEFICIARY_WRITE)) {
    redirect(`/${org}/beneficiaries` as any);
  }

  return <UploadBeneficiariesForm org={org} />;
}
