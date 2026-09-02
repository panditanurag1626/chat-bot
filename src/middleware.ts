import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

// Page paths that require a logged-in admin user.
const PROTECTED_PREFIXES = ["/dashboard", "/bots", "/agent", "/messages", "/settings", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const uid = token ? await verifySession(token) : null;

  // Root: mirror Flask index() — authenticated → dashboard, else → login.
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = uid ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  // Bounce already-logged-in users away from auth pages.
  if ((pathname === "/login" || pathname === "/register") && uid) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isProtected && !uid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/bots/:path*", "/agent/:path*", "/messages/:path*", "/settings/:path*", "/admin/:path*"],
};
