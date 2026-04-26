/**
 * Session helpers — read/write the session cookie + look up the current
 * user. All API routes / server components should call requireUser() or
 * getUser() rather than touching cookies directly.
 */

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions, users, type Role, type User } from "@/lib/db/schema";

export const COOKIE_NAME = "genome_session";
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function newSessionId(): string {
  return randomBytes(36).toString("base64url");
}

export async function createSession(userId: string): Promise<string> {
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const ua = (await headers()).get("user-agent")?.slice(0, 500) ?? null;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await db.insert(sessions).values({ id, userId, expiresAt, userAgent: ua, ip });
  return id;
}

export async function setSessionCookie(sid: string): Promise<void> {
  const c = await cookies();
  c.set({
    name: COOKIE_NAME,
    value: sid,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getUser(): Promise<User | null> {
  const c = await cookies();
  const sid = c.get(COOKIE_NAME)?.value;
  if (!sid) return null;
  const row = await db.query.sessions.findFirst({
    where: (s, { and, eq, gt }) => and(eq(s.id, sid), gt(s.expiresAt, new Date())),
  });
  if (!row) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  if (!u || u.banned) return null;
  // Touch last_seen_at occasionally
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 60_000) {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, u.id));
  }
  return u;
}

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/signin");
  return u;
}

export async function requireRole(role: Role | Role[]): Promise<User> {
  const u = await requireUser();
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(u.role as Role)) redirect("/forbidden");
  return u;
}

export function isOwner(u: { role: string }): boolean {
  return u.role === "owner";
}

export function canDirectAdd(u: { role: string; autoApprove: boolean }): boolean {
  return u.role === "owner" || u.role === "trusted" || u.autoApprove;
}
