/**
 * Edge middleware — gates everything but the public landing, /signin, and
 * /api/auth/* on a present Tyflix SSO cookie. Real validation happens in the
 * server-component layer (so we don't have to import jose into the edge
 * runtime here — keeps the middleware bundle tiny).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/signin", "/about", "/forbidden"]);
const PUBLIC_PREFIXES = ["/api/auth/", "/auth/", "/_next/", "/favicon", "/robots.txt", "/sitemap.xml"];

const COOKIE_NAME = process.env.TYFLIX_AUTH_COOKIE_NAME ?? "tyflix_auth";
const LEGACY_COOKIE = "genome_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const tyflixCookie = req.cookies.get(COOKIE_NAME)?.value;
  const legacyCookie = req.cookies.get(LEGACY_COOKIE)?.value;
  if (!tyflixCookie && !legacyCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
