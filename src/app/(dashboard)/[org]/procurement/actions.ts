"use server";

import { z } from "zod";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VendorSchema = z.object({
  name:        z.string().min(2),
  category:    z.enum(["SUPPLIES_STATIONERY","IT_TECHNOLOGY","EQUIPMENT","TRANSPORT_LOGISTICS","CATERING_EVENTS","PROFESSIONAL_SERVICES","UTILITIES","RENT_FACILITIES","MEDIA_COMMUNICATIONS","OTHER"]),
  contactName: z.string().optional().or(z.literal("")),
  email:       z.string().email().optional().or(z.literal("")),
  phone:       z.string().optional().or(z.literal("")),
  address:     z.string().optional().or(z.literal("")),
  county:      z.string().optional().or(z.literal("")),
  taxPin:      z.string().optional().or(z.literal("")),
  bankName:    z.string().optional().or(z.literal("")),
  bankAccount: z.string().optional().or(z.literal("")),
  bankBranch:  z.string().optional().or(z.literal("")),
  notes:       z.string().optional().or(z.literal("")),
});

export async function createVendor(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD" && ctx.role !== "FINANCE") throw new Error("Permission denied");

  const data = VendorSchema.parse(Object.fromEntries(formData.entries()));

  await dbRetry(() =>
    prisma.vendor.create({
      data: {
        organizationId: ctx.organization.id,
        name:        data.name,
        category:    data.category,
        contactName: data.contactName || null,
        email:       data.email || null,
        phone:       data.phone || null,
        address:     data.address || null,
        county:      data.county || null,
        taxPin:      data.taxPin || null,
        bankName:    data.bankName || null,
        bankAccount: data.bankAccount || null,
        bankBranch:  data.bankBranch || null,
        notes:       data.notes || null,
      },
    })
  );

  revalidatePath(`/${orgSlug}/procurement/vendors`);
  redirect(`/${orgSlug}/procurement/vendors`);
}

const POSchema = z.object({
  vendorId:    z.string().min(1),
  title:       z.string().min(2),
  description: z.string().optional().or(z.literal("")),
  department:  z.string().optional().or(z.literal("")),
  lineItems:   z.string(),
  subtotal:    z.coerce.number().min(0),
  taxAmount:   z.coerce.number().min(0).default(0),
  total:       z.coerce.number().min(0),
  currency:    z.string().default("KES"),
  requiredBy:  z.string().optional().or(z.literal("")),
  notes:       z.string().optional().or(z.literal("")),
  fromAccountId: z.string().optional().or(z.literal("")),
});

export async function createPurchaseOrder(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD" && ctx.role !== "FINANCE") throw new Error("Permission denied");

  const data = POSchema.parse(Object.fromEntries(formData.entries()));

  // Generate PO number
  const count = await dbRetry(() =>
    prisma.purchaseOrder.count({ where: { organizationId: ctx.organization.id } })
  );
  const year = new Date().getFullYear();
  const poNumber = `PO-${year}-${String(count + 1).padStart(4, "0")}`;

  let lineItems: any[] = [];
  try { lineItems = JSON.parse(data.lineItems); } catch {}

  const po = await dbRetry(() =>
    prisma.purchaseOrder.create({
      data: {
        organizationId: ctx.organization.id,
        poNumber,
        vendorId:      data.vendorId,
        requestedById: ctx.user.id,
        title:         data.title,
        description:   data.description || null,
        department:    data.department || null,
        lineItems,
        subtotal:      data.subtotal,
        taxAmount:     data.taxAmount,
        total:         data.total,
        currency:      data.currency,
        requiredBy:    data.requiredBy ? new Date(data.requiredBy) : null,
        notes:         data.notes || null,
        fromAccountId: data.fromAccountId || null,
        status:        ctx.role === "ADMIN" ? "APPROVED" : "PENDING_APPROVAL",
        ...(ctx.role === "ADMIN" ? { approvedById: ctx.user.id, approvedAt: new Date() } : {}),
      },
    })
  );

  revalidatePath(`/${orgSlug}/procurement/orders`);
  redirect(`/${orgSlug}/procurement/orders`);
}

export async function approvePurchaseOrder(orgSlug: string, poId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.purchaseOrder.updateMany({
      where: { id: poId, organizationId: ctx.organization.id },
      data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date() },
    })
  );

  revalidatePath(`/${orgSlug}/procurement/orders`);
}

export async function markPOReceived(orgSlug: string, poId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.purchaseOrder.updateMany({
      where: { id: poId, organizationId: ctx.organization.id },
      data: { status: "RECEIVED", receivedAt: new Date() },
    })
  );

  revalidatePath(`/${orgSlug}/procurement/orders`);
}

export async function cancelPurchaseOrder(orgSlug: string, poId: string) {
  const ctx = await requireTenant(orgSlug);
  if (ctx.role !== "ADMIN" && ctx.role !== "FINANCE_LEAD") throw new Error("Permission denied");

  await dbRetry(() =>
    prisma.purchaseOrder.updateMany({
      where: { id: poId, organizationId: ctx.organization.id, status: { in: ["DRAFT", "PENDING_APPROVAL"] } },
      data: { status: "CANCELLED" },
    })
  );

  revalidatePath(`/${orgSlug}/procurement/orders`);
}
