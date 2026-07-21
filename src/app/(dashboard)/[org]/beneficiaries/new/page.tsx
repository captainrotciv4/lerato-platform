import { requireTenant } from "@/lib/tenant/context";
import { createBeneficiary } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
            ? "Add a new player to the Darajani database."
            : "Register a new student, player, or programme participant."}
        </p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await createBeneficiary(org, formData);
        }}
        className="card space-y-5"
      >
        <Section title="Personal details">
          <Field label="First name" name="firstName" required />
          <Field label="Middle name (optional)" name="middleName" />
          <Field label="Last name" name="lastName" required />
          <Field label="Date of birth" name="dateOfBirth" type="date" required />
          <div>
            <label>Gender</label>
            <select name="gender" required className="mt-1 w-full">
              <option value="">Select…</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </div>
          <Field label="National ID (optional)" name="nationalId" />
          <Field label="Birth certificate no. (optional)" name="birthCertNo" />
        </Section>

        <Section title="Contact & residential area">
          <Field label="Phone (optional)" name="phone" type="tel" placeholder="+254…" />
          <Field label="Email (optional)" name="email" type="email" />
          <Field label="County / area" name="county" placeholder="e.g. Nairobi" />
          <Field label="Address (optional)" name="address" placeholder="Estate, street…" />
        </Section>

        <Section title="Parent / guardian">
          <Field label="Guardian name" name="guardianName" />
          <Field label="Guardian phone" name="guardianPhone" type="tel" placeholder="+254…" />
          <Field label="Guardian email (optional)" name="guardianEmail" type="email" />
          <div>
            <label>Relationship</label>
            <select name="guardianRelationship" className="mt-1 w-full">
              <option value="">— select —</option>
              <option value="Mother">Mother</option>
              <option value="Father">Father</option>
              <option value="Uncle">Uncle</option>
              <option value="Aunt">Aunt</option>
              <option value="Grandparent">Grandparent</option>
              <option value="Legal Guardian">Legal Guardian</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </Section>

        <Section title="Profile type">
          <div className="sm:col-span-2 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isAthlete" value="true" defaultChecked={isAcademy} className="!w-auto" />
              <span>This person is an athlete (creates an athlete profile with FIFA/FKF fields)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isStudent" value="true" defaultChecked={isAcademy} className="!w-auto" />
              <span>This person is a student (creates an education profile)</span>
            </label>
          </div>
        </Section>

        <Section title="Athlete details (if athlete)">
          <div>
            <label>Playing position</label>
            <select name="position" className="mt-1 w-full">
              <option value="">— select —</option>
              <option value="GK">Goalkeeper</option>
              <option value="CB">Centre Back</option>
              <option value="LB">Left Back</option>
              <option value="RB">Right Back</option>
              <option value="LWB">Left Wing Back</option>
              <option value="RWB">Right Wing Back</option>
              <option value="CDM">Defensive Mid</option>
              <option value="CM">Central Mid</option>
              <option value="CAM">Attacking Mid</option>
              <option value="LM">Left Mid</option>
              <option value="RM">Right Mid</option>
              <option value="LW">Left Winger</option>
              <option value="RW">Right Winger</option>
              <option value="CF">Centre Forward</option>
              <option value="ST">Striker</option>
            </select>
          </div>
          <div>
            <label>Preferred foot</label>
            <select name="preferredFoot" className="mt-1 w-full">
              <option value="">—</option>
              <option value="RIGHT">Right</option>
              <option value="LEFT">Left</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
          <Field label="Current club (if any)" name="currentClub" placeholder="e.g. Gor Mahia Youth" />
        </Section>

        <Section title="Academic details (if student)">
          <Field label="School" name="school" placeholder="e.g. St. Mary's Primary" />
          <Field label="Grade / class" name="grade" placeholder="e.g. Form 2A" />
        </Section>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
          <Link href={`/${org}/beneficiaries` as any} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            {isAcademy ? "Register player" : "Save beneficiary"}
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
  label, name, type = "text", required, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>{label} {required && <span className="text-[var(--brand-accent)]">*</span>}</label>
      <input id={name} name={name} type={type} required={required} placeholder={placeholder} className="mt-1 w-full" />
    </div>
  );
}
