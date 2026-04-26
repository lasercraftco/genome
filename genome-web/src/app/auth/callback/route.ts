import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { consumeToken, findOrCreateUser } from "@/lib/auth/magic";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) redirect("/signin?error=missing_token");
  const row = await consumeToken(token);
  if (!row) redirect("/signin?error=invalid_or_expired");
  const user = await findOrCreateUser(row.email);
  const sid = await createSession(user.id);
  await setSessionCookie(sid);
  await db.insert(auditLog).values({
    userId: user.id,
    action: "session.signin",
    target: user.email,
  });
  // First-time visitor → onboarding; returning users → home
  redirect(user.onboardedAt ? "/home" : "/welcome");
}
