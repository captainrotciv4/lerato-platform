"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateBeneficiary } from "../actions";

type BeneficiaryData = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string; // ISO string (yyyy-mm-dd)
  gender: string;
  nationalId: string | null;
  birthCertNo: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  county: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  guardianRelationship: string | null;
};

export function EditDetailsForm({
  org,
  beneficiaryId,
  data,
}: {
  org: string;
  beneficiaryId: string;
  data: BeneficiaryData;
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateBeneficiary(org, beneficiaryId, formData);
      if (res.ok) {
        setSaved(true);
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res.errors);
      }
    });
  }

  const err = (field: string) =>
    errors[field] ? (
      <p className="mt-0.5 text-xs text-red-600">{errors[field][0]}</p>
    ) : null;

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <Pencil className="h-4 w-4" /> Edit personal details
        </button>
        {saved && (
          <span className="text-xs font-medium text-emerald-600">
            Details updated ✓
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-[var(--fg)]">
          Edit personal details
        </h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setErrors({}); }}
          className="rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {errors._form && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors._form[0]}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-[var(--fg-muted)]">First name <span className="text-red-500">*</span></label>
            <input name="firstName" required defaultValue={data.firstName} className="mt-1 w-full" />
            {err("firstName")}
          </div>
          <div>
            <label className="text-xs text-[var(--fg-muted)]">Middle name</label>
            <input name="middleName" defaultValue={data.middleName ?? ""} className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs text-[var(--fg-muted)]">Last name <span className="text-red-500">*</span></label>
            <input name="lastName" required defaultValue={data.lastName} className="mt-1 w-full" />
            {err("lastName")}
          </div>
        </div>

        {/* DOB + gender + IDs */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-[var(--fg)]">
              Date of birth
            </label>
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={data.dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              className="mt-1 w-full"
            />
            <p className="mt-0.5 text-[10px] text-[var(--fg-muted)]">
              Age is calculated automatically from this date. Leave blank if unknown — the record stays incomplete.
            </p>
            {err("dateOfBirth")}
          </div>
          <div>
            <label className="text-xs text-[var(--fg-muted)]">Gender <span className="text-red-500">*</span></label>
            <select name="gender" required defaultValue={data.gender} className="mt-1 w-full">
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--fg-muted)]">Birth certificate no.</label>
            <input name="birthCertNo" defaultValue={data.birthCertNo ?? ""} className="mt-1 w-full font-mono" />
            {err("birthCertNo")}
          </div>
          <div>
            <label className="text-xs text-[var(--fg-muted)]">National ID</label>
            <input name="nationalId" defaultValue={data.nationalId ?? ""} className="mt-1 w-full font-mono" />
            {err("nationalId")}
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Contact</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Phone</label>
              <input name="phone" defaultValue={data.phone ?? ""} className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Email</label>
              <input name="email" type="email" defaultValue={data.email ?? ""} className="mt-1 w-full" />
              {err("email")}
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Address</label>
              <input name="address" defaultValue={data.address ?? ""} className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">County / area</label>
              <input name="county" defaultValue={data.county ?? ""} className="mt-1 w-full" />
            </div>
          </div>
        </div>

        {/* Guardian */}
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Guardian / Parent</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Guardian name</label>
              <input name="guardianName" defaultValue={data.guardianName ?? ""} className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Relationship</label>
              <input name="guardianRelationship" defaultValue={data.guardianRelationship ?? ""} className="mt-1 w-full" placeholder="e.g. Mother, Uncle" />
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Guardian phone</label>
              <input name="guardianPhone" defaultValue={data.guardianPhone ?? ""} className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-[var(--fg-muted)]">Guardian email</label>
              <input name="guardianEmail" type="email" defaultValue={data.guardianEmail ?? ""} className="mt-1 w-full" />
              {err("guardianEmail")}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={() => { setOpen(false); setErrors({}); }}
            className="btn-secondary text-sm"
            disabled={isPending}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary text-sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
