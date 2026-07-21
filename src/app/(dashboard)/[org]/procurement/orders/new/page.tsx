import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PurchaseOrderForm from "./PurchaseOrderForm";
import { createPurchaseOrder } from "../../actions";

export const metadata = { title: "New Purchase Order — Lerato Platform" };

export default async function NewPurchaseOrderPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const [vendors, accounts] = await dbRetry(() =>
    Promise.all([
      prisma.vendor.findMany({
        where: { organizationId: ctx.organization.id, active: true, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, category: true },
      }),
      prisma.account.findMany({
        where: { organizationId: ctx.organization.id, type: "ASSET", active: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
    ])
  );

  const action = createPurchaseOrder.bind(null, org);

  return (
    <div className="space-y-6">
      <Link href={`/${org}/procurement/orders` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--fg)]">New Purchase Order</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {vendors.length === 0
            ? "No vendors registered yet — add a vendor first."
            : `Select vendor, add line items, and submit for approval.`}
        </p>
      </div>

      {vendors.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-[var(--fg-muted)]">You need at least one vendor before creating a PO.</p>
          <Link href={`/${org}/procurement/vendors` as any} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
            Add your first vendor
          </Link>
        </div>
      ) : (
        <div className="card">
          <PurchaseOrderForm vendors={vendors} accounts={accounts} action={action} />
        </div>
      )}
    </div>
  );
}
