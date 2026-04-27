import { NextResponse } from "next/server";

import { COOKIE_DOMAIN, COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: Request): Promise<Response> {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    domain: isProd ? COOKIE_DOMAIN : undefined,
    path: "/",
    maxAge: 0,
  });
  return res;
}
