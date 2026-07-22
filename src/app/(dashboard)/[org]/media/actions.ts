"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { revalidatePath } from "next/cache";
import { deleteObject } from "@/lib/storage/r2";

const SaveMediaSchema = z.object({
  mediaType: z.enum(["PHOTO", "VIDEO"]),
  title: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  fileName: z.string(),
  fileKey: z.string(),
  fileUrl: z.string().min(1),
  fileSize: z.coerce.number().int().positive(),
  mimeType: z.string(),
  eventId: z.string().cuid().optional().or(z.literal("")),
  programId: z.string().cuid().optional().or(z.literal("")),
  branchId: z.string().cuid().optional().or(z.literal("")),
  capturedAt: z.string().optional().or(z.literal("")),
  tags: z.string().optional().or(z.literal("")), // comma-separated
});

export async function saveMediaAsset(orgSlug: string, payload: z.input<typeof SaveMediaSchema>) {
  const ctx = await requireTenant(orgSlug);
  const data = SaveMediaSchema.parse(payload);

  const tags = data.tags
    ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  await prisma.mediaAsset.create({
    data: {
      organizationId: ctx.organization.id,
      uploadedById: ctx.user.id,
      mediaType: data.mediaType as "PHOTO" | "VIDEO",
      title: data.title || null,
      description: data.description || null,
      fileName: data.fileName,
      fileKey: data.fileKey,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      eventId: data.eventId || null,
      programId: data.programId || null,
      branchId: data.branchId || null,
      capturedAt: data.capturedAt ? new Date(data.capturedAt) : null,
      tags,
    },
  });

  revalidatePath(`/${orgSlug}/media`);
}

export async function deleteMediaAsset(orgSlug: string, assetId: string) {
  const ctx = await requireTenant(orgSlug);

  const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.organizationId !== ctx.organization.id) throw new Error("Not found");

  await prisma.mediaAsset.delete({ where: { id: assetId } });
  await deleteObject(asset.fileKey).catch(() => {});

  revalidatePath(`/${orgSlug}/media`);
}
