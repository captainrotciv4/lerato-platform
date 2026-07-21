/**
 * Route protection middleware.
 *
 * - Public: /, /sign-in, /api/auth/*
 * - All other routes require an active session
 * - /[org]/* additionally checks the user has membership in that org (done in layout)
 */

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [/^\/$/, /^\/sign-in/, /^\/api\/auth/, /^\/_next/, /^\/favicon\.ico/];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((re) => re.test(pathname));
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)"],
};
