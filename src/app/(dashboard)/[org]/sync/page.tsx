import { requireTenant } from "@/lib/tenant/context";
import { SyncClient } from "./sync-client";

export const metadata = { title: "Pending Sync — Lerato Platform" };

export default async function SyncPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  await requireTenant(org); // auth gate
  return <SyncClient org={org} />;
}
