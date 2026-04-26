import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { COOKIE_NAME, clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const c = await cookies();
  const sid = c.get(COOKIE_NAME)?.value;
  if (sid) await db.delete(sessions).where(eq(sessions.id, sid));
  await clearSessionCookie();
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
