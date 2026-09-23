import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const publicPaths = new Set([
  "/login",
  "/sw.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.ico",
]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    publicPaths.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/api"
  )
    return NextResponse.next();
  if (request.cookies.has("__Host-inorganic_session")) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}
