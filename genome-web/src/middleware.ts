/**
 * Edge middleware — gates everything but the public landing, /signin, and
 * /auth/* on a valid session cookie. Real session validation happens in the
 * app layer (this is just an optimistic check on the cookie's presence).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/signin", "/about", "/forbidden"]);
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/", "/_next/", "/favicon", "/robots.txt", "/sitemap.xml"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const sid = req.cookies.get("genome_session")?.value;
  if (!sid) {
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
