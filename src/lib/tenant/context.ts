/**
 * Tenant context — resolves the active organization for the current request.
 *
 * Two-level caching:
 *   1. React cache()         — deduplicates within a single render pass
 *                              (layout + page both call requireTenant → 1 DB hit)
 *   2. Next.js unstable_cache — persists across requests for 30 s
 *                              (repeated navigations hit the server cache, not Neon)
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Organization, User, Role } from "@prisma/client";

export type TenantContext = {
  organization: Organization;
  user: User;
  role: Role;
  permissions: string[];
  branchId: string | null;
};

// ── Session (JWT decode — already fast, but deduplicate within the render) ──
const getSession = cache(() => auth());

// ── Memberships: persist for 30 s, tagged for targeted invalidation ──────────
function buildMembershipFetcher(userId: string) {
  return unstable_cache(
    () =>
      prisma.membership.findMany({
        where: { userId, active: true, revokedAt: null },
        include: { user: true, organization: true, branch: true },
        orderBy: { organization: { name: "asc" } },
      }),
    [`memberships-${userId}`],
    { revalidate: 30, tags: [`user-memberships-${userId}`] }
  );
}

// Within a request, share the same unstable_cache call across all components.
const getUserMemberships = cache((userId: string) =>
  buildMembershipFetcher(userId)()
);

// ─────────────────────────────────────────────────────────────────────────────

export async function requireTenant(slug: string): Promise<TenantContext> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/sign-in");

  const memberships = await getUserMemberships(session.user.id);
  const membership = memberships.find((m) => m.organization.slug === slug);

  if (!membership) redirect("/unauthorized");

  return {
    organization: membership.organization,
    user: membership.user,
    role: membership.role,
    permissions: membership.permissions,
    branchId: membership.branchId ?? null,
  };
}

export async function getAccessibleOrganizations(): Promise<Organization[]> {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const memberships = await getUserMemberships(session.user.id);
  return memberships.map((m) => m.organization);
}

export function hasPermission(ctx: TenantContext, permission: string): boolean {
  return ctx.role === "ADMIN" || ctx.permissions.includes(permission);
}
