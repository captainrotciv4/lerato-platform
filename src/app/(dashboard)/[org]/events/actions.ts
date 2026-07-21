"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenant/context";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const EventSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["TOURNAMENT", "FUNDRAISER", "TRAINING_CAMP", "MISSION_DEPARTURE", "COMMUNITY_DAY", "BOARD_MEETING", "OTHER"]),
  venue: z.string().optional().or(z.literal("")),
  startsAt: z.string().refine((d) => !isNaN(Date.parse(d))),
  endsAt: z.string().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(0).optional(),
  description: z.string().optional().or(z.literal("")),
});

export async function createEvent(orgSlug: string, formData: FormData) {
  const ctx = await requireTenant(orgSlug);
  if (!can(ctx.role, ctx.permissions, PERMISSIONS.EVENT_WRITE)) throw new Error("Permission denied");
  const data = EventSchema.parse(Object.fromEntries(formData.entries()));

  await prisma.$transaction(async (tx) => {
    const e = await tx.event.create({
      data: {
        organizationId: ctx.organization.id,
        name: data.name,
        type: data.type,
        venue: data.venue || null,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        capacity: data.capacity || null,
        description: data.description || null,
      },
    });
    await tx.auditLog.create({
      data: { organizationId: ctx.organization.id, actorId: ctx.user.id, action: "CREATE", entity: "Event", entityId: e.id, after: e as any },
    });
  });

  revalidatePath(`/${orgSlug}/events`);
  redirect(`/${orgSlug}/events`);
}
