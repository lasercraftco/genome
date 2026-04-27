import { NextResponse } from "next/server";
import { z } from "zod";

import { issueToken } from "@/lib/auth/magic";

const Body = z.object({ email: z.string().email() });

/**
 * Accept either a JSON body (`Content-Type: application/json`) or a classic
 * HTML form post (`application/x-www-form-urlencoded` / `multipart/form-data`).
 *
 * For form posts we redirect back to /signin with a status flag so the page
 * renders a "check your inbox" state instead of the browser navigating to
 * raw JSON. JSON callers (curl, fetch from a future client component) keep
 * getting JSON.
 */
export async function POST(req: Request) {
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
      dest.searchParams.set("error", "invalid_email");
      return NextResponse.redirect(dest, 303);
    }
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const { link } = await issueToken(parsed.data.email);
  // In dev (no RESEND_API_KEY) we surface the link so it's easy to test.
  const dev = !process.env.RESEND_API_KEY ? { devLink: link } : {};

  if (isForm) {
    const dest = new URL("/signin", req.url);
    dest.searchParams.set("sent", "1");
    if (dev.devLink) dest.searchParams.set("devLink", dev.devLink);
    return NextResponse.redirect(dest, 303);
  }
  return NextResponse.json({ status: "sent", ...dev });
}
