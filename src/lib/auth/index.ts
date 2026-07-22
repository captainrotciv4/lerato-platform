/**
 * Auth.js v5 configuration for the Lerato Platform.
 *
 * Strategy: email + password (passwordless OTP can be added later).
 * Session uses JWT — keeps the DB out of every request.
 * On login, we attach the user's accessible orgs + memberships to the JWT.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma, dbRetry } from "@/lib/db/prisma";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./config";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = CredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const ip =
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request?.headers?.get("x-real-ip") ??
          null;
        const ua = request?.headers?.get("user-agent") ?? null;

        const user = await dbRetry(() =>
          prisma.user.findUnique({ where: { email: parsed.data.email } })
        );

        if (!user || !user.hashedPassword || !user.active) {
          prisma.loginLog.create({
            data: { email: parsed.data.email, success: false, ipAddress: ip, userAgent: ua },
          }).catch(() => null);
          return null;
        }

        const valid = await compare(parsed.data.password, user.hashedPassword);

        prisma.loginLog.create({
          data: { userId: user.id, email: parsed.data.email, success: valid, ipAddress: ip, userAgent: ua },
        }).catch(() => null);

        if (!valid) return null;

        // Fire-and-forget: update lastSeenAt + opportunistically rehash to cost 10
        // (passwords were originally hashed at cost 12 — this gradually lowers it)
        const currentHash = user.hashedPassword; // capture — TS narrowing doesn't cross async boundary
        (async () => {
          const updates: { lastSeenAt: Date; hashedPassword?: string } = { lastSeenAt: new Date() };
          const costMatch = currentHash.match(/^\$2[ab]\$(\d+)\$/);
          const currentCost = costMatch ? parseInt(costMatch[1], 10) : 12;
          if (currentCost > 10) {
            const { hash: bcryptHash } = await import("bcryptjs");
            updates.hashedPassword = await bcryptHash(parsed.data.password, 10);
          }
          prisma.user.update({ where: { id: user.id }, data: updates }).catch(() => null);
        })();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        };
      },
    }),
  ],
});
