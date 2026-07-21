"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const StaffSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  type: z.enum(["EMPLOYEE", "VOLUNTEER", "COACH", "MENTOR", "INTERN", "CONSULTANT"]),
  position: z.string().optional().or(z.literal("")),
  department: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
});

export async function createStaff(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.STAFF_WRITE)) {
    throw new Error("Permission denied");
  }
  const data = StaffSchema.parse(Object.fromEntries(formData.entries()));

  const created = await prisma.$transaction(async (tx) => {
    const s = await tx.staffVolunteer.create({
      data: {
        organizationId: ctx.organization.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        type: data.type,
        position: data.position || null,
        department: data.department || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        action: "CREATE",
        entity: "StaffVolunteer",
        entityId: s.id,
        after: s as any,
      },
    });
    return s;
  });

  revalidatePath(`/${orgSlug}/staff`);
  redirect(`/${orgSlug}/staff`);
}
