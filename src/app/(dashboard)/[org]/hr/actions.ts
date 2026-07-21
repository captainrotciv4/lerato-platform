"use server";

import { z } from "zod";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const LeaveSchema = z.object({
  staffId:    z.string().min(1),
  leaveType:  z.enum(["ANNUAL","SICK","MATERNITY","PATERNITY","COMPASSIONATE","STUDY","UNPAID"]),
  startDate:  z.string().refine((d) => !isNaN(Date.parse(d))),
  endDate:    z.string().refine((d) => !isNaN(Date.parse(d))),
  days:       z.coerce.number().int().positive(),
  reason:     z.string().optional().or(z.literal("")),
});

export async function createLeaveRequest(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  const data = LeaveSchema.parse(Object.fromEntries(formData.entries()));

  await dbRetry(() =>
    prisma.leaveRequest.create({
      data: {
        organizationId: ctx.organization.id,
        staffId:        data.staffId,
        leaveType:      data.leaveType,
        startDate:      new Date(data.startDate),
        endDate:        new Date(data.endDate),
        days:           data.days,
        reason:         data.reason || null,
        status:         "PENDING",
      },
    })
  );

  revalidatePath(`/${orgSlug}/hr/leave`);
  redirect(`/${orgSlug}/hr/leave`);
}

export async function approveLeave(orgSlug: string, leaveId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.leaveRequest.updateMany({
      where: { id: leaveId, organizationId: ctx.organization.id },
      data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date() },
    })
  );

  revalidatePath(`/${orgSlug}/hr/leave`);
}

export async function rejectLeave(orgSlug: string, leaveId: string, reason?: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.leaveRequest.updateMany({
      where: { id: leaveId, organizationId: ctx.organization.id },
      data: { status: "REJECTED", rejectedReason: reason || null },
    })
  );

  revalidatePath(`/${orgSlug}/hr/leave`);
}

const PayrollSchema = z.object({
  staffId:         z.string().min(1),
  period:          z.string().regex(/^\d{4}-\d{2}$/),
  grossSalary:     z.coerce.number().positive(),
  nhif:            z.coerce.number().min(0).default(0),
  nssf:            z.coerce.number().min(0).default(0),
  paye:            z.coerce.number().min(0).default(0),
  otherDeductions: z.coerce.number().min(0).default(0),
  notes:           z.string().optional().or(z.literal("")),
});

export async function createPayrollRecord(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  const data = PayrollSchema.parse(Object.fromEntries(formData.entries()));
  const net = data.grossSalary - data.nhif - data.nssf - data.paye - data.otherDeductions;

  await dbRetry(() =>
    prisma.payrollRecord.upsert({
      where: { staffId_period: { staffId: data.staffId, period: data.period } },
      create: {
        organizationId: ctx.organization.id,
        staffId:         data.staffId,
        period:          data.period,
        grossSalary:     data.grossSalary,
        nhif:            data.nhif,
        nssf:            data.nssf,
        paye:            data.paye,
        otherDeductions: data.otherDeductions,
        netSalary:       Math.max(0, net),
        notes:           data.notes || null,
        status:          "DRAFT",
      },
      update: {
        grossSalary:     data.grossSalary,
        nhif:            data.nhif,
        nssf:            data.nssf,
        paye:            data.paye,
        otherDeductions: data.otherDeductions,
        netSalary:       Math.max(0, net),
        notes:           data.notes || null,
      },
    })
  );

  revalidatePath(`/${orgSlug}/hr/payroll`);
  redirect(`/${orgSlug}/hr/payroll`);
}

export async function approvePayroll(orgSlug: string, payrollId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.payrollRecord.updateMany({
      where: { id: payrollId, organizationId: ctx.organization.id },
      data: { status: "APPROVED" },
    })
  );

  revalidatePath(`/${orgSlug}/hr/payroll`);
}

export async function markPayrollPaid(orgSlug: string, payrollId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.payrollRecord.updateMany({
      where: { id: payrollId, organizationId: ctx.organization.id },
      data: { status: "PAID", paidAt: new Date(), paidById: ctx.user.id },
    })
  );

  revalidatePath(`/${orgSlug}/hr/payroll`);
}
