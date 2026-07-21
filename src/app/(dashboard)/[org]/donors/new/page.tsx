import { requireTenant, getAccessibleOrganizations } from "@/lib/tenant/context";
import { createDonor } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Add donor — Lerato Platform" };

export default async function NewDonorPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  await requireTenant(org);
  const accessibleOrgs = await getAccessibleOrganizations();
  const otherOrgs = accessibleOrgs.filter((o) => o.slug !== org);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/${org}/donors` as any}
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to donors
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Add donor</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Register a new individual or institutional donor.
        </p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await createDonor(org, formData);
        }}
        className="card space-y-5"
      >
        <Section title="Donor type">
          <div>
            <label>Type</label>
            <select name="type" required className="mt-1 w-full" defaultValue="INDIVIDUAL">
              <option value="INDIVIDUAL">Individual person</option>
              <option value="ORGANIZATION">Organization / company</option>
              <option value="ANONYMOUS">Anonymous</option>
            </select>
          </div>
          <div>
            <label>Tier</label>
            <select name="tier" className="mt-1 w-full" defaultValue="BRONZE">
              <option value="BRONZE">Bronze</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
              <option value="PATRON">Patron</option>
            </select>
          </div>
        </Section>

        <Section title="Identity">
          <Field label="First name (if individual)" name="firstName" />
          <Field label="Last name (if individual)" name="lastName" />
          <div className="sm:col-span-2">
            <Field label="Organization name (if institutional)" name="organizationName" />
          </div>
        </Section>

        <Section title="Contact">
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" placeholder="+254…" />
          <Field label="WhatsApp" name="whatsapp" type="tel" />
          <Field label="Country" name="country" placeholder="Kenya" />
        </Section>

        <Section title="Tax">
          <Field label="Tax ID (KRA PIN, etc.)" name="taxId" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="taxExempt" value="true" className="!w-auto" />
            <span>Tax-exempt donor</span>
          </label>
        </Section>

        {otherOrgs.length > 0 && (
          <Section title="Cross-org sharing (optional)">
            <div className="sm:col-span-2">
              <label>Also link this donor to:</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {otherOrgs.map((o) => (
                  <label key={o.slug} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="shareWithOrgs"
                      value={o.slug}
                      className="!w-auto"
                    />
                    <span>{o.shortName}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--fg-muted)]">
                Useful when a single donor funds multiple organizations in the ecosystem.
              </p>
            </div>
          </Section>
        )}

        <Section title="Notes">
          <div className="sm:col-span-2">
            <label>Notes (optional)</label>
            <textarea name="notes" rows={3} className="mt-1 w-full" />
          </div>
        </Section>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
          <Link href={`/${org}/donors` as any} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            Save donor
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label, name, type = "text", placeholder,
}: {
  label: string; name: string; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} placeholder={placeholder} className="mt-1 w-full" />
    </div>
  );
}
