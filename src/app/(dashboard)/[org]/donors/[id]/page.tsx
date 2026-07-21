import { requireTenant } from "@/lib/tenant/context";
import { prisma } from "@/lib/db/prisma";
import { recordDonation } from "../actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart } from "lucide-react";
import { formatDate, formatKES } from "@/lib/utils";

export const metadata = { title: "Donor — Lerato Platform" };

export default async function DonorDetailPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  const ctx = await requireTenant(org);

  // Donor must be linked to this org
  const share = await prisma.donorShare.findUnique({
    where: { donorId_organizationId: { donorId: id, organizationId: ctx.organization.id } },
    include: {
      donor: {
        include: {
          donations: {
            where: { organizationId: ctx.organization.id },
            orderBy: { receivedAt: "desc" },
          },
          sharedWith: { include: { organization: true } },
        },
      },
    },
  });
  if (!share) notFound();
  const { donor } = share;

  const total = donor.donations.reduce((a, d) => a + Number(d.amount), 0);
  const displayName =
    donor.type === "ORGANIZATION"
      ? donor.organizationName
      : donor.type === "ANONYMOUS"
      ? "(Anonymous donor)"
      : `${donor.firstName || ""} ${donor.lastName || ""}`.trim();

  return (
    <div className="space-y-6">
      <Link href={`/${org}/donors` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to donors
      </Link>

      {/* Header card */}
      <div className="card flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--fg)]">{displayName || "—"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--fg-muted)]">
            <span className="badge bg-gray-100 text-gray-800">{donor.type.toLowerCase()}</span>
            <span className="badge bg-yellow-100 text-yellow-900">{donor.tier}</span>
            {donor.taxExempt && <span className="badge bg-green-100 text-green-900">Tax-exempt</span>}
          </div>
          <div className="mt-3 space-y-1 text-sm text-[var(--fg)]">
            {donor.email && <div>{donor.email}</div>}
            {donor.phone && <div>{donor.phone}</div>}
            {donor.taxId && <div className="text-xs text-[var(--fg-muted)]">Tax ID: {donor.taxId}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">Total given to {ctx.organization.shortName}</div>
          <div className="mt-1 font-display text-3xl font-bold text-[var(--fg)]">{formatKES(total)}</div>
          <div className="mt-1 text-xs text-[var(--fg-muted)]">{donor.donations.length} donation{donor.donations.length !== 1 && "s"}</div>
        </div>
      </div>

      {/* Cross-org sharing chips */}
      {donor.sharedWith.length > 1 && (
        <div className="card">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">Also a donor at</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {donor.sharedWith
              .filter((s) => s.organizationId !== ctx.organization.id)
              .map((s) => (
                <span key={s.id} className="badge bg-gray-100 text-gray-800">
                  {s.organization.shortName}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Record donation form */}
      <div className="card">
        <h2 className="font-display text-lg font-semibold text-[var(--fg)]">Record a donation</h2>
        <form
          action={async (formData) => {
            "use server";
            await recordDonation(org, formData);
          }}
          className="mt-4 grid gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="donorId" value={donor.id} />
          <div>
            <label>Amount</label>
            <input name="amount" type="number" step="0.01" min="0" required className="mt-1 w-full" placeholder="0.00" />
          </div>
          <div>
            <label>Currency</label>
            <select name="currency" className="mt-1 w-full" defaultValue="KES">
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label>Channel</label>
            <select name="channel" required className="mt-1 w-full" defaultValue="MPESA">
              <option value="MPESA">M-PESA</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Card</option>
              <option value="CRYPTO">Crypto</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label>M-PESA / bank reference</label>
            <input name="reference" className="mt-1 w-full" placeholder="QFG7L8K2NM" />
          </div>
          <div>
            <label>Designated for (optional)</label>
            <input name="designatedFor" className="mt-1 w-full" placeholder="e.g. Scholarship Programme" />
          </div>
          <div>
            <label>Received at</label>
            <input name="receivedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full" />
          </div>
          <div className="sm:col-span-3">
            <label>Notes (optional)</label>
            <textarea name="notes" rows={2} className="mt-1 w-full" />
          </div>
          <div className="sm:col-span-3 flex items-center justify-end">
            <button type="submit" className="btn-primary inline-flex items-center gap-2">
              <Heart className="h-4 w-4" /> Record donation
            </button>
          </div>
        </form>
      </div>

      {/* Donations history */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-[var(--fg)]">Donation history</h2>
        </div>
        {donor.donations.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--fg-muted)]">No donations recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Date</th>
                <th className="px-6 py-3 text-left font-medium">Channel</th>
                <th className="px-6 py-3 text-left font-medium">Reference</th>
                <th className="px-6 py-3 text-left font-medium">Designated for</th>
                <th className="px-6 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {donor.donations.map((d) => (
                <tr key={d.id} className="border-t border-[var(--border)]">
                  <td className="px-6 py-3 text-[var(--fg)]">{formatDate(d.receivedAt)}</td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">{d.channel.toLowerCase().replace("_", " ")}</td>
                  <td className="px-6 py-3 font-mono text-xs text-[var(--fg-muted)]">{d.reference || "—"}</td>
                  <td className="px-6 py-3 text-[var(--fg-muted)]">{d.designatedFor || "—"}</td>
                  <td className="px-6 py-3 text-right font-medium text-[var(--fg)]">
                    {d.currency} {formatKES(Number(d.amount)).replace("KES ", "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
