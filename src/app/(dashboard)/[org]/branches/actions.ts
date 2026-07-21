"use server";

import { requireTenant } from "@/lib/tenant/context";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export async function createBranch(org: string, formData: FormData) {
  const ctx = await requireTenant(org);

  const name = formData.get("name") as string;
  const location = (formData.get("location") as string) || null;
  const county = (formData.get("county") as string) || null;
  const description = (formData.get("description") as string) || null;
  const isMain = formData.get("isMain") === "true";
  const primaryColor = (formData.get("primaryColor") as string) || "#16A34A";
  const accentColor = (formData.get("accentColor") as string) || "#FACC15";

  let slug = toSlug(name);

  // Ensure slug uniqueness within org
  const existing = await prisma.branch.findUnique({
    where: { organizationId_slug: { organizationId: ctx.organization.id, slug } },
  });
  if (existing) slug = `${slug}-${Date.now()}`;

  const branch = await prisma.branch.create({
    data: {
      organizationId: ctx.organization.id,
      name,
      slug,
      location,
      county,
      description,
      isMain,
      primaryColor,
      accentColor,
    },
  });

  redirect(`/${org}/branches/${branch.id}`);
}

export async function updateBranch(org: string, branchId: string, formData: FormData) {
  const ctx = await requireTenant(org);

  const data: Record<string, unknown> = {
    name: formData.get("name") as string,
    location: (formData.get("location") as string) || null,
    county: (formData.get("county") as string) || null,
    description: (formData.get("description") as string) || null,
    isMain: formData.get("isMain") === "true",
  };
  if (formData.get("primaryColor")) data.primaryColor = formData.get("primaryColor");
  if (formData.get("accentColor")) data.accentColor = formData.get("accentColor");

  await prisma.branch.updateMany({
    where: { id: branchId, organizationId: ctx.organization.id },
    data,
  });

  redirect(`/${org}/branches/${branchId}`);
}
