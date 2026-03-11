import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next/static") || pathname.startsWith("/_next/image") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const isDashboardRoute =
    pathname === "/" ||
    pathname.startsWith("/sources") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/findings") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/audit-log") ||
    pathname.startsWith("/admin");

  if (!isDashboardRoute) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.userId) {
    console.error("Suspicious auth activity: missing or malformed token", {
      path: pathname,
    });
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
