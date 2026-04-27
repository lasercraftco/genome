import { NextResponse } from "next/server";
import { z } from "zod";

import { signInByFirstName, COOKIE_NAME, COOKIE_DOMAIN } from "@/lib/auth/session";
import { TTL_SECONDS } from "@/lib/auth/jwt";

const Body = z.object({
  name: z.string().trim().min(1, "name_required").max(200),
  next: z.string().optional(),
});

/**
 * First-name sign-in. Accepts JSON or HTML form. Slugifies the name into a
 * stable username, finds-or-creates the user (tyler -> owner, anyone else ->
 * friend), mints a Tyflix SSO JWT, and sets it as the .tyflix.net cookie.
 */
export async function POST(req: Request): Promise<Response> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  const isForm =
    ct.includes("application/x-www-form-urlencoded") ||
    ct.includes("multipart/form-data");

  let raw: unknown = null;
  try {
    if (isForm) {
      const fd = await req.formData();
      raw = Object.fromEntries(fd.entries());
    } else {
      raw = await req.json();
    }
  } catch {
    raw = null;
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    if (isForm) {
      const dest = new URL("/signin", req.url);
      dest.searchParams.set("error", "name_required");
      return NextResponse.redirect(dest, 303);
    }
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof signInByFirstName>>;
  try {
    result = await signInByFirstName(parsed.data.name);
  } catch (err) {
    console.error("[genome/sign-in]", err);
    if (isForm) {
      const dest = new URL("/signin", req.url);
      dest.searchParams.set("error", "invalid_name");
      return NextResponse.redirect(dest, 303);
    }
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }

  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : (result.user.onboardedAt ? "/home" : "/welcome");
  const isProd = process.env.NODE_ENV === "production";

  const res = isForm
    ? NextResponse.redirect(new URL(next, req.url), 303)
    : NextResponse.json({ ok: true, user: { id: result.user.id, username: result.user.username, displayName: result.user.displayName, isOwner: result.user.isOwner }, next });

  res.cookies.set({
    name: COOKIE_NAME,
    value: result.jwt,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    domain: isProd ? COOKIE_DOMAIN : undefined,
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return res;
}
