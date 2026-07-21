"use server";

import { z } from "zod";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const AssetSchema = z.object({
  assetNumber:    z.string().min(1),
  name:           z.string().min(2),
  category:       z.enum(["LAND_BUILDING","VEHICLE","EQUIPMENT","FURNITURE","IT_EQUIPMENT","SPORTS_EQUIPMENT","OTHER"]),
  purchaseDate:   z.string().refine((d) => !isNaN(Date.parse(d))),
  purchaseCost:   z.coerce.number().positive(),
  usefulLifeYears:z.coerce.number().int().positive().optional().or(z.literal("")),
  salvageValue:   z.coerce.number().min(0).optional().or(z.literal("")),
  location:       z.string().optional().or(z.literal("")),
  serialNumber:   z.string().optional().or(z.literal("")),
  supplier:       z.string().optional().or(z.literal("")),
});

export async function createFixedAsset(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  const data = AssetSchema.parse(Object.fromEntries(formData.entries()));
  const cost = data.purchaseCost;
  const salvage = Number(data.salvageValue) || 0;

  await dbRetry(() =>
    prisma.fixedAsset.create({
      data: {
        organizationId: ctx.organization.id,
        assetNumber:    data.assetNumber,
        name:           data.name,
        category:       data.category,
        purchaseDate:   new Date(data.purchaseDate),
        purchaseCost:   cost,
        salvageValue:   salvage,
        currentValue:   cost,
        usefulLifeYears:data.usefulLifeYears ? Number(data.usefulLifeYears) : null,
        location:       data.location || null,
        serialNumber:   data.serialNumber || null,
        supplier:       data.supplier || null,
        createdById:    ctx.user.id,
      },
    })
  );

  revalidatePath(`/${orgSlug}/finance/assets`);
  redirect(`/${orgSlug}/finance/assets`);
}

export async function updateAssetStatus(orgSlug: string, assetId: string, status: string, condition?: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.fixedAsset.updateMany({
      where: { id: assetId, organizationId: ctx.organization.id },
      data: {
        status: status as any,
        ...(condition ? { condition: condition as any } : {}),
      },
    })
  );

  revalidatePath(`/${orgSlug}/finance/assets`);
}
