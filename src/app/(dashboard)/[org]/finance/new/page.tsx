import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { createTransaction } from "../actions";
import { TransactionForm } from "./TransactionForm";

export const metadata = { title: "New transaction — Lerato Platform" };

export default async function NewTransactionPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const [accounts, programs] = await dbRetry(() =>
    Promise.all([
      prisma.account.findMany({
        where: { organizationId: ctx.organization.id, active: true },
        orderBy: [{ type: "asc" }, { code: "asc" }],
      }),
      prisma.program.findMany({
        where: { organizationId: ctx.organization.id, status: "ACTIVE", deletedAt: null },
        orderBy: { name: "asc" },
      }),
    ])
  );

  const action = createTransaction.bind(null, org);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <TransactionForm
      accounts={accounts.map((a) => ({
        ...a,
        balance: a.balance.toString(),
      }))}
      programs={programs}
      action={action}
      orgSlug={org}
      today={today}
    />
  );
}
