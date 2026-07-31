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

        // Rate limit: block after 5 failures for this email in 15 minutes
        const windowStart = new Date(Date.now() - 15 * 60 * 1000);
        const recentFailures = await dbRetry(() =>
          prisma.loginLog.count({
            where: { email: parsed.data.email, success: false, createdAt: { gte: windowStart } },
          })
        );
        if (recentFailures >= 5) {
          prisma.loginLog.create({
            data: { email: parsed.data.email, success: false, ipAddress: ip, userAgent: ua },
          }).catch(() => null);
          return null;
        }

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

        // Fire-and-forget: update lastSeenAt
        prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => null);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: stamp userId and check time
      if (user?.id) {
        return { ...token, userId: user.id, checkedAt: Date.now() };
      }
      // Subsequent requests: re-validate user.active every 30 minutes
      if (token.userId) {
        const checkedAt = (token.checkedAt as number | undefined) ?? 0;
        if (Date.now() - checkedAt > 30 * 60 * 1000) {
          const dbUser = await dbRetry(() =>
            prisma.user.findUnique({
              where: { id: token.userId as string },
              select: { active: true },
            })
          ).catch(() => null);
          if (!dbUser?.active) {
            // Remove userId — session callback won't populate user.id → requireTenant redirects
            (token as any).userId = undefined;
            return token;
          }
          token.checkedAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
