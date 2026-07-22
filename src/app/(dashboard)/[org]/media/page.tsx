import { requireTenant } from "@/lib/tenant/context";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/utils";
import { MediaLibraryClient } from "./media-library-client";

export const metadata = { title: "Media Library — Lerato Platform" };

export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ event?: string; program?: string; branch?: string; type?: string; q?: string }>;
}) {
  const { org } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(org);
  const canWrite = can(ctx.role, ctx.permissions, PERMISSIONS.COMM_SEND);

  const where: any = {
    organizationId: ctx.organization.id,
    ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
    ...(sp.event   ? { eventId: sp.event }     : {}),
    ...(sp.program ? { programId: sp.program } : {}),
    ...(sp.branch  ? { branchId: sp.branch }   : {}),
    ...(sp.type === "PHOTO" || sp.type === "VIDEO" ? { mediaType: sp.type } : {}),
    ...(sp.q ? {
      OR: [
        { title: { contains: sp.q, mode: "insensitive" } },
        { description: { contains: sp.q, mode: "insensitive" } },
        { fileName: { contains: sp.q, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [assets, events, programs, branches] = await Promise.all([
    dbRetry(() =>
      prisma.mediaAsset.findMany({
        where,
        orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
        include: {
          event:   { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
          branch:  { select: { id: true, name: true } },
        },
      })
    ),
    dbRetry(() =>
      prisma.event.findMany({
        where: { organizationId: ctx.organization.id, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { startsAt: "desc" },
        take: 100,
      })
    ),
    dbRetry(() =>
      prisma.program.findMany({
        where: { organizationId: ctx.organization.id, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 100,
      })
    ),
    dbRetry(() =>
      prisma.branch.findMany({
        where: { organizationId: ctx.organization.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    ),
  ]);

  return (
    <MediaLibraryClient
      orgSlug={org}
      canWrite={canWrite}
      assets={assets.map((a) => ({
        id: a.id,
        mediaType: a.mediaType,
        title: a.title,
        description: a.description,
        fileName: a.fileName,
        fileUrl: `/api/files/${a.fileKey}`,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        capturedAt: a.capturedAt ? formatDate(a.capturedAt) : null,
        createdAt: formatDate(a.createdAt),
        tags: a.tags,
        event: a.event ? { id: a.event.id, name: a.event.name } : null,
        program: a.program ? { id: a.program.id, name: a.program.name } : null,
        branch: a.branch ? { id: a.branch.id, name: a.branch.name } : null,
      }))}
      events={events}
      programs={programs}
      branches={ctx.branchId ? branches.filter((b) => b.id === ctx.branchId) : branches}
      filters={{ event: sp.event ?? "", program: sp.program ?? "", branch: sp.branch ?? "", type: sp.type ?? "", q: sp.q ?? "" }}
    />
  );
}
