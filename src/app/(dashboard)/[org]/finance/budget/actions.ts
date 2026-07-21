"use server";

import { z } from "zod";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { revalidatePath } from "next/cache";

const BudgetSchema = z.object({
  name:            z.string().min(2).max(200),
  code:            z.string().optional().or(z.literal("")),
  accountId:       z.string().optional().or(z.literal("")),
  fiscalYear:      z.coerce.number().int().min(2020).max(2100),
  startDate:       z.string().refine((d) => !isNaN(Date.parse(d))),
  endDate:         z.string().refine((d) => !isNaN(Date.parse(d))),
  allocatedAmount: z.coerce.number().positive(),
  currency:        z.string().default("KES"),
  category:        z.string().optional().or(z.literal("")),
  description:     z.string().optional().or(z.literal("")),
});

export async function createBudget(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  const data = BudgetSchema.parse(Object.fromEntries(formData.entries()));

  await dbRetry(() =>
    prisma.budget.create({
      data: {
        organizationId:  ctx.organization.id,
        name:            data.name,
        code:            data.code     || null,
        accountId:       data.accountId || null,
        fiscalYear:      data.fiscalYear,
        startDate:       new Date(data.startDate),
        endDate:         new Date(data.endDate),
        allocatedAmount: data.allocatedAmount,
        currency:        data.currency,
        category:        data.category    || null,
        description:     data.description || null,
        createdById:     ctx.user.id,
      },
    })
  );

  revalidatePath(`/${orgSlug}/finance/budget`);
}

export async function toggleBudgetActive(orgSlug: string, budgetId: string, active: boolean) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.budget.updateMany({
      where: { id: budgetId, organizationId: ctx.organization.id },
      data: { active },
    })
  );

  revalidatePath(`/${orgSlug}/finance/budget`);
}
