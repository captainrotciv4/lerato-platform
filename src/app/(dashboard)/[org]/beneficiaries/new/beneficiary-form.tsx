"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, WifiOff, CheckCircle2, Loader2, Upload, X, FileText, Image } from "lucide-react";
import { createBeneficiary } from "../actions";
import { enqueue } from "@/lib/offline/queue";

interface Props {
  org: string;
  isAcademy: boolean;
}

type UploadedDoc = {
  docType: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
};

function isNetworkError(err: unknown): boolean {
  const msg = (err as any)?.message ?? String(err);
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("Failed to fetch") ||
    msg.toLowerCase().includes("connection")
  );
}

async function uploadFile(
  file: File,
  orgSlug: string,
  docType: string
): Promise<UploadedDoc | null> {
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, purpose: "document", orgSlug }),
  });
  if (!presignRes.ok) return null;
  const { uploadUrl, key, fileUrl } = await presignRes.json();
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) return null;
  return { docType, fileName: file.name, fileKey: key, fileUrl, fileSize: file.size, mimeType: file.type };
}

export function BeneficiaryForm({ org, isAcademy }: Props) {
  const formRef               = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string[]>>({});

  // Document uploads
  const [birthCertFile, setBirthCertFile]     = useState<File | null>(null);
  const [passportFile, setPassportFile]       = useState<File | null>(null);
  const [parentIdFile, setParentIdFile]       = useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs]     = useState(false);

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

    // Validate required docs for Academy (online only)
    if (isAcademy) {
      const missing: string[] = [];
      if (!birthCertFile) missing.push("Birth Certificate");
      if (!passportFile)  missing.push("Passport Photo");
      if (missing.length > 0) {
        setErrors({ _form: [`Please upload the required documents: ${missing.join(", ")}.`] });
        setPending(false);
        return;
      }
    }

    // Upload documents
    setUploadingDocs(true);
    const docs: UploadedDoc[] = [];
    try {
      const uploads = [
        birthCertFile ? uploadFile(birthCertFile, org, "BIRTH_CERT") : null,
        passportFile  ? uploadFile(passportFile,  org, "PASSPORT_PHOTO") : null,
        parentIdFile  ? uploadFile(parentIdFile,  org, "PARENT_ID") : null,
      ];
      const results = await Promise.all(uploads);
      for (const r of results) {
        if (r) docs.push(r);
      }
      // Check all required docs uploaded successfully
      if (isAcademy) {
        const missing: string[] = [];
        if (birthCertFile && !docs.find((d) => d.docType === "BIRTH_CERT"))   missing.push("Birth Certificate");
        if (passportFile  && !docs.find((d) => d.docType === "PASSPORT_PHOTO")) missing.push("Passport Photo");
        if (missing.length > 0) {
          setErrors({ _form: [`Document upload failed for: ${missing.join(", ")}. Please try again.`] });
          setPending(false);
          setUploadingDocs(false);
          return;
        }
      }
    } catch {
      setErrors({ _form: ["Document upload failed. Please check your connection and try again."] });
      setPending(false);
      setUploadingDocs(false);
      return;
    }
    setUploadingDocs(false);

    if (docs.length > 0) {
      formData.append("_docs", JSON.stringify(docs));
    }

    try {
      const result = await createBeneficiary(org, formData);
      if (result && !result.ok) {
        setErrors(result.errors ?? {});
      }
    } catch (err: unknown) {
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
          {isAcademy && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Documents (birth cert, passport photo) could not be saved offline. Upload them from the player's profile once synced.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setSavedOffline(false)} className="btn-primary">Register another</button>
          <Link href={`/${org}/sync` as any} className="btn-secondary">View pending</Link>
        </div>
      </div>
    );
  }

  const isSubmitting = pending || uploadingDocs;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="card space-y-5">
      {errors._form && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors._form.join(" ")}
        </div>
      )}

      <Section title="Personal details">
        <Field label="First name" name="firstName" required error={errors.firstName?.[0]} />
        <Field label="Middle name" name="middleName" optional error={errors.middleName?.[0]} />
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
        <Field label="Birth certificate no." name="birthCertNo" required error={errors.birthCertNo?.[0]} placeholder="e.g. BC/2010/123456" />
        <Field label="National ID" name="nationalId" optional error={errors.nationalId?.[0]} />
      </Section>

      <Section title="Contact & location">
        <Field label="Phone number" name="phone" type="tel" required placeholder="+254…" error={errors.phone?.[0]} />
        <Field label="Email" name="email" type="email" optional error={errors.email?.[0]} />
        <Field label="County / area" name="county" required placeholder="e.g. Nairobi" error={errors.county?.[0]} />
        <Field label="Address" name="address" optional placeholder="Estate, street…" error={errors.address?.[0]} />
      </Section>

      <Section title="Parent / guardian">
        <Field label="Guardian name" name="guardianName" required error={errors.guardianName?.[0]} />
        <Field label="Guardian phone" name="guardianPhone" type="tel" required placeholder="+254…" error={errors.guardianPhone?.[0]} />
        <Field label="Guardian email" name="guardianEmail" type="email" optional error={errors.guardianEmail?.[0]} />
        <div>
          <label>Relationship <span className="text-[var(--brand-accent)]">*</span></label>
          <select name="guardianRelationship" required className="mt-1 w-full">
            <option value="">— select —</option>
            <option value="Mother">Mother</option>
            <option value="Father">Father</option>
            <option value="Uncle">Uncle</option>
            <option value="Aunt">Aunt</option>
            <option value="Grandparent">Grandparent</option>
            <option value="Legal Guardian">Legal Guardian</option>
            <option value="Other">Other</option>
          </select>
          {errors.guardianRelationship && <p className="mt-1 text-xs text-red-600">{errors.guardianRelationship[0]}</p>}
        </div>
      </Section>

      {/* ── Document uploads ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Registration documents
          </h2>
          {isAcademy && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-2 py-0.5">
              Required for approval
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--fg-muted)]">
          {isAcademy
            ? "Birth certificate and passport photo are required. Parent/Guardian ID is recommended."
            : "Upload any supporting documents. Works online only — offline registrations can have documents added later."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <DocUploadField
            label="Birth Certificate"
            required={isAcademy}
            file={birthCertFile}
            onFile={setBirthCertFile}
            accept="image/jpeg,image/png,image/webp,application/pdf"
          />
          <DocUploadField
            label="Passport Photo"
            required={isAcademy}
            file={passportFile}
            onFile={setPassportFile}
            accept="image/jpeg,image/png,image/webp"
          />
          <DocUploadField
            label="Parent / Guardian ID"
            required={false}
            file={parentIdFile}
            onFile={setParentIdFile}
            accept="image/jpeg,image/png,image/webp,application/pdf"
          />
        </div>
      </div>

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
        <Field label="Current club (if any)" name="currentClub" optional placeholder="e.g. Gor Mahia Youth" />
      </Section>

      <Section title="Academic details (if student)">
        <Field label="School" name="school" optional placeholder="e.g. St. Mary's Primary" />
        <Field label="Grade / class" name="grade" optional placeholder="e.g. Form 2A" />
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
        <Link href={`/${org}/beneficiaries` as any} className="btn-secondary">Cancel</Link>
        <button type="submit" disabled={isSubmitting} className="btn-primary inline-flex items-center gap-2">
          {uploadingDocs && <><Loader2 className="h-4 w-4 animate-spin" /> Uploading docs…</>}
          {pending && !uploadingDocs && <><Loader2 className="h-4 w-4 animate-spin" /></>}
          {!isSubmitting && (isAcademy ? "Register player" : "Save beneficiary")}
        </button>
      </div>
    </form>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label, name, type = "text", required, optional, placeholder, error,
}: {
  label: string; name: string; type?: string; required?: boolean; optional?: boolean; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>
        {label}
        {required && <span className="text-[var(--brand-accent)]"> *</span>}
        {optional && <span className="text-[var(--fg-muted)] font-normal"> (optional)</span>}
      </label>
      <input id={name} name={name} type={type} required={required} placeholder={placeholder} className="mt-1 w-full" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function DocUploadField({
  label, required, file, onFile, accept,
}: {
  label: string; required: boolean; file: File | null; onFile: (f: File | null) => void; accept: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isImage  = file?.type.startsWith("image/");

  return (
    <div>
      <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1.5">
        {label} {required && <span className="text-[var(--brand-accent)]">*</span>}
        {!required && <span className="text-[var(--fg-muted)] font-normal"> (optional)</span>}
      </label>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />

      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950">
          {isImage
            ? <Image className="h-4 w-4 shrink-0 text-green-600" />
            : <FileText className="h-4 w-4 shrink-0 text-green-600" />
          }
          <span className="min-w-0 flex-1 truncate text-xs text-green-800 dark:text-green-300">{file.name}</span>
          <button type="button" onClick={() => { onFile(null); if (inputRef.current) inputRef.current.value = ""; }} className="shrink-0 text-green-600 hover:text-green-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2.5 text-xs text-[var(--fg-muted)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span>Choose file (PDF or image)</span>
        </button>
      )}
    </div>
  );
}
