"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { revalidatePath } from "next/cache";
import { deleteObject } from "@/lib/storage/r2";

const SaveDocSchema = z.object({
  beneficiaryId: z.string().cuid(),
  docType: z.enum(["BIRTH_CERT", "PASSPORT_PHOTO", "PARENT_ID", "NATIONAL_ID", "MEDICAL_FORM", "CONSENT_FORM", "OTHER"]),
  label: z.string().optional().or(z.literal("")),
  fileName: z.string(),
  fileKey: z.string(),
  fileUrl: z.string().min(1),
  fileSize: z.coerce.number().int().positive(),
  mimeType: z.string(),
});

export async function saveDocument(orgSlug: string, payload: z.input<typeof SaveDocSchema>) {
  const ctx = await requireTenant(orgSlug);
  const data = SaveDocSchema.parse(payload);

  await prisma.document.create({
    data: {
      organizationId: ctx.organization.id,
      beneficiaryId: data.beneficiaryId,
      uploadedById: ctx.user.id,
      docType: data.docType as any,
      label: data.label || null,
      fileName: data.fileName,
      fileKey: data.fileKey,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
    },
  });

  revalidatePath(`/${orgSlug}/beneficiaries/${data.beneficiaryId}`);
}

export async function deleteDocument(orgSlug: string, documentId: string) {
  const ctx = await requireTenant(orgSlug);

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  if (doc.organizationId !== ctx.organization.id) throw new Error("Not found");

  await prisma.document.delete({ where: { id: documentId } });
  await deleteObject(doc.fileKey).catch(() => {}); // best-effort R2 cleanup

  revalidatePath(`/${orgSlug}/beneficiaries/${doc.beneficiaryId}`);
}
