import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma, dbRetry } from "@/lib/db/prisma";

/** Root page — redirects authenticated users to their first accessible org. */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const membership = await dbRetry(() =>
    prisma.membership.findFirst({
      where: { userId: session.user.id, active: true, revokedAt: null },
      include: { organization: true },
      orderBy: { organization: { name: "asc" } },
    })
  );

  if (!membership) {
    redirect("/unauthorized");
  }

  redirect(`/${membership.organization.slug}`);
}
