"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, WifiOff, CheckCircle2, Loader2 } from "lucide-react";
import { createBeneficiary } from "../actions";
import { enqueue } from "@/lib/offline/queue";

interface Props {
  org: string;
  isAcademy: boolean;
}

function isNetworkError(err: unknown): boolean {
  const msg = (err as any)?.message ?? String(err);
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("Failed to fetch") ||
    msg.toLowerCase().includes("connection")
  );
}

export function BeneficiaryForm({ org, isAcademy }: Props) {
  const formRef               = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string[]>>({});

  const nounSingular = isAcademy ? "player" : "beneficiary";

  async function saveOffline(formData: FormData) {
    const firstName = (formData.get("firstName") as string) ?? "";
    const lastName  = (formData.get("lastName")  as string) ?? "";
    await enqueue({
      type:    "BENEFICIARY_REGISTER",
      org,
      label:   `${firstName} ${lastName}`.trim() || "Unnamed",
      payload: Object.fromEntries(formData.entries()),
    });
    setSavedOffline(true);
    formRef.current?.reset();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSavedOffline(false);
    setPending(true);

    const formData = new FormData(e.currentTarget);

    if (!navigator.onLine) {
      await saveOffline(formData);
      setPending(false);
      return;
    }

    try {
      const result = await createBeneficiary(org, formData);
      if (result && !result.ok) {
        setErrors(result.errors ?? {});
      }
      // Success: server calls redirect() — Next.js navigates automatically
    } catch (err: unknown) {
      // Redirect throws are handled by Next.js at the framework level; rethrow
      if ((err as any)?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;

      if (!navigator.onLine || isNetworkError(err)) {
        await saveOffline(formData);
      } else {
        setErrors({ _form: ["An unexpected error occurred. Please try again."] });
      }
    } finally {
      setPending(false);
    }
  }

  if (savedOffline) {
    return (
      <div className="card flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <WifiOff className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <p className="font-display text-lg font-bold text-[var(--fg)]">Saved offline</p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            This {nounSingular} was saved to your device. Go to{" "}
            <Link href={`/${org}/sync` as any} className="text-[var(--brand-primary)] underline">
              Pending Sync
            </Link>{" "}
            to upload when you're back online.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setSavedOffline(false)} className="btn-primary">
            Register another
          </button>
          <Link href={`/${org}/sync` as any} className="btn-secondary">
            View pending
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="card space-y-5">
      {errors._form && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors._form.join(" ")}
        </div>
      )}

      <Section title="Personal details">
        <Field label="First name" name="firstName" required error={errors.firstName?.[0]} />
        <Field label="Middle name (optional)" name="middleName" />
        <Field label="Last name" name="lastName" required error={errors.lastName?.[0]} />
        <Field label="Date of birth" name="dateOfBirth" type="date" required error={errors.dateOfBirth?.[0]} />
        <div>
          <label>Gender <span className="text-[var(--brand-accent)]">*</span></label>
          <select name="gender" required className="mt-1 w-full">
            <option value="">Select…</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </select>
          {errors.gender && <p className="mt-1 text-xs text-red-600">{errors.gender[0]}</p>}
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
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isAcademy ? "Register player" : "Save beneficiary"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label, name, type = "text", required, placeholder, error,
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label} {required && <span className="text-[var(--brand-accent)]">*</span>}
      </label>
      <input id={name} name={name} type={type} required={required} placeholder={placeholder} className="mt-1 w-full" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
