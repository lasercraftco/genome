import { NextResponse } from "next/server";
import { z } from "zod";

import { issueToken } from "@/lib/auth/magic";

const Body = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const { token, link } = await issueToken(parsed.data.email);
  // Don't return the token to the client; just confirm.
  // In dev (no RESEND_API_KEY), we surface the link so it's easy to test.
  const dev = !process.env.RESEND_API_KEY ? { devLink: link } : {};
  return NextResponse.json({ status: "sent", ...dev });
}
