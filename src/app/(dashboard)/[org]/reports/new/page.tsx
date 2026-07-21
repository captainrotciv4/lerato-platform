import { requireTenant } from "@/lib/tenant/context";
import { generateReport } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Generate report — Lerato Platform" };

const TYPES_ALL = [
  { value: "FINANCE_STATEMENT",   label: "Finance statement",    dept: "FINANCE"     },
  { value: "HR_PAYROLL",          label: "HR & Payroll",         dept: "HR"          },
  { value: "PROCUREMENT_SUMMARY", label: "Procurement summary",  dept: "PROCUREMENT" },
  { value: "ASSET_REGISTER",      label: "Asset register",       dept: "FINANCE"     },
  { value: "PROGRAMME_IMPACT",    label: "Programme impact",     dept: "PROGRAMMES"  },
  { value: "BOARD_QUARTERLY",     label: "Board quarterly",      dept: "ADMIN"       },
  { value: "DONOR_ANNUAL",        label: "Donor annual",         dept: "ADMIN"       },
  { value: "GRANT_FUNDER",        label: "Grant funder",         dept: "ADMIN"       },
  { value: "REGULATOR",           label: "Regulator",            dept: "ADMIN"       },
  { value: "INTERNAL",            label: "Internal",             dept: ""            },
];

const TYPES_ACADEMY = [
  { value: "FIFA_COMPLIANCE",    label: "FIFA compliance",  dept: "" },
  { value: "FKF_COMPLIANCE",     label: "FKF compliance",   dept: "" },
  { value: "BOARD_QUARTERLY",    label: "Board quarterly",  dept: "ADMIN" },
  { value: "DONOR_ANNUAL",       label: "Donor annual",     dept: "ADMIN" },
  { value: "GRANT_FUNDER",       label: "Grant funder",     dept: "ADMIN" },
  { value: "REGULATOR",          label: "Regulator",        dept: "" },
  { value: "INTERNAL",           label: "Internal",         dept: "" },
];

const DEPARTMENTS = [
  { value: "",             label: "— None / cross-department —" },
  { value: "FINANCE",      label: "Finance"      },
  { value: "HR",           label: "HR"           },
  { value: "PROCUREMENT",  label: "Procurement"  },
  { value: "PROGRAMMES",   label: "Programmes"   },
  { value: "ADMIN",        label: "Admin"        },
];

export default async function NewReportPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const ctx = await requireTenant(org);

  const today = new Date();
  const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);

  const types = ctx.organization.type === "ACADEMY" ? TYPES_ACADEMY : TYPES_ALL;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${org}/reports` as any} className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="h-4 w-4" /> Back to reports
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--fg)]">Generate report</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Snapshot a reporting period for board, donors, regulators, or internal departments.
        </p>
      </div>

      <form action={async (fd) => { "use server"; await generateReport(org, fd); }} className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">Title *</label>
          <input name="title" required className="mt-1 w-full" placeholder="e.g. Q2 2026 Finance Statement" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">Type *</label>
          <select name="type" required className="mt-1 w-full" defaultValue="INTERNAL">
            {types.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">Department</label>
          <select name="department" className="mt-1 w-full" defaultValue="">
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">Period start *</label>
          <input name="periodStart" type="date" required defaultValue={quarterStart.toISOString().slice(0, 10)} className="mt-1 w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">Period end *</label>
          <input name="periodEnd" type="date" required defaultValue={today.toISOString().slice(0, 10)} className="mt-1 w-full" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-[var(--fg-muted)] mb-1">Email recipients</label>
          <input name="recipients" className="mt-1 w-full" placeholder="board@example.org, treasurer@example.org" />
          <p className="mt-1 text-xs text-[var(--fg-muted)]">Comma-separated. Leave blank to skip sending.</p>
        </div>

        <div className="sm:col-span-2 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Link href={`/${org}/reports` as any} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Generate</button>
        </div>
      </form>
    </div>
  );
}
