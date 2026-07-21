"use server";

import { z } from "zod";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ReportSchema = z.object({
  type: z.enum([
    "FIFA_COMPLIANCE", "FKF_COMPLIANCE", "BOARD_QUARTERLY", "DONOR_ANNUAL",
    "GRANT_FUNDER", "REGULATOR", "INTERNAL",
    "FINANCE_STATEMENT", "HR_PAYROLL", "PROCUREMENT_SUMMARY", "ASSET_REGISTER", "PROGRAMME_IMPACT",
  ]),
  title: z.string().min(2),
  department: z.string().optional().or(z.literal("")),
  periodStart: z.string().refine((d) => !isNaN(Date.parse(d))),
  periodEnd: z.string().refine((d) => !isNaN(Date.parse(d))),
  recipients: z.string().optional().or(z.literal("")),
});

export async function generateReport(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.REPORT_GENERATE)) throw new Error("Permission denied");
  const data = ReportSchema.parse(Object.fromEntries(formData.entries()));

  const periodStart = new Date(data.periodStart);
  const periodEnd = new Date(data.periodEnd);

  const [beneficiaries, donations, txs] = await Promise.all([
    dbRetry(() => prisma.beneficiary.count({
      where: { organizationId: ctx.organization.id, createdAt: { gte: periodStart, lte: periodEnd }, deletedAt: null },
    })),
    dbRetry(() => prisma.donation.aggregate({
      where: { organizationId: ctx.organization.id, receivedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true }, _count: true,
    })),
    dbRetry(() => prisma.transaction.aggregate({
      where: { organizationId: ctx.organization.id, occurredAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true }, _count: true,
    })),
  ]);

  // NeonHttp: split creates — no nested transaction
  const report = await dbRetry(() =>
    prisma.report.create({
      data: {
        organizationId: ctx.organization.id,
        type: data.type as any,
        title: data.title,
        department: data.department || null,
        periodStart,
        periodEnd,
        generatedBy: ctx.user.id,
        recipients: (data.recipients || "").split(",").map((s) => s.trim()).filter(Boolean),
        status: "GENERATED",
      },
    })
  );

  dbRetry(() =>
    prisma.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "GENERATE",
        entity: "Report",
        entityId: report.id,
        after: {
          ...report,
          metrics: {
            beneficiariesAdded: beneficiaries,
            donationsCount: donations._count,
            donationsTotal: donations._sum.amount,
            transactionsCount: txs._count,
          },
        } as any,
      },
    })
  ).catch(() => null);

  revalidatePath(`/${orgSlug}/reports`);
  redirect(`/${orgSlug}/reports`);
}
