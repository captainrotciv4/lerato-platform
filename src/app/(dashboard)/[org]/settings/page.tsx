import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { updateOrgSettings } from "./actions";
import { Settings, Mail, Globe, Building2, Phone } from "lucide-react";

export const metadata = { title: "Organisation Settings — Lerato Platform" };

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const ctx = await requireTenant(org);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.ORG_SETTINGS)) redirect(`/${org}`);

  const organization = await dbRetry(() =>
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization.id } })
  );

  const save = updateOrgSettings.bind(null, org);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Organisation Settings</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Manage {organization.name}&apos;s profile and communication preferences.
        </p>
      </div>

      <form action={save} className="space-y-8">
        {/* ── Identity ────────────────────────────────────────────── */}
        <section className="card space-y-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <Building2 className="h-4 w-4" /> Identity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display Name" name="name" defaultValue={organization.name} required />
            <Field label="Short Name" name="shortName" defaultValue={organization.shortName} required />
          </div>
          <Field label="Legal Name" name="legalName" defaultValue={organization.legalName ?? ""} />
          <Field label="Description" name="description" defaultValue={organization.description ?? ""} multiline />
        </section>

        {/* ── Contact ─────────────────────────────────────────────── */}
        <section className="card space-y-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <Phone className="h-4 w-4" /> Contact
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" type="email" defaultValue={organization.email ?? ""} />
            <Field label="Phone" name="phone" type="tel" defaultValue={organization.phone ?? ""} />
            <Field label="WhatsApp" name="whatsapp" type="tel" defaultValue={organization.whatsapp ?? ""} />
            <Field label="Website" name="website" type="url" defaultValue={organization.website ?? ""} />
          </div>
          <Field label="Physical Address" name="address" defaultValue={organization.address ?? ""} multiline />
        </section>

        {/* ── Email / Communications ───────────────────────────────── */}
        <section className="card space-y-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <Mail className="h-4 w-4" /> Email Sender
          </h2>
          <p className="text-sm text-[var(--fg-muted)]">
            Customise the sender name and address used when sending emails on behalf of this organisation.
            Leave blank to use the platform default.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="From Name"
              name="emailFromName"
              defaultValue={organization.emailFromName ?? ""}
              placeholder="e.g. Lerato Foundation"
            />
            <Field
              label="From Address"
              name="emailFromAddress"
              type="email"
              defaultValue={organization.emailFromAddress ?? ""}
              placeholder="e.g. no-reply@lerato.org"
            />
          </div>
          <Field
            label="Reply-To Address"
            name="emailReplyTo"
            type="email"
            defaultValue={organization.emailReplyTo ?? ""}
            placeholder="e.g. info@lerato.org"
          />
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  multiline,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  const base =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30";
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={3}
          placeholder={placeholder}
          className={base}
        />
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue}
          required={required}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  );
}
