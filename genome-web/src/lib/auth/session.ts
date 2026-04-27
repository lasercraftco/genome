/**
 * Session helpers — read/write the shared Tyflix SSO cookie and look up the
 * current user. All API routes / server components should call requireUser()
 * or getUser() rather than touching cookies directly.
 *
 * Cookie is JWT, signed with TYFLIX_AUTH_JWT_SECRET, set at domain
 * .tyflix.net so genome / reel / karaoke share one sign-in.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLog, users, type Role, type User } from "@/lib/db/schema";
import { issueToken, slugifyName, verifyToken, OWNER_USERNAME, type TyflixClaims, TTL_SECONDS } from "./jwt";

export const COOKIE_NAME = process.env.TYFLIX_AUTH_COOKIE_NAME ?? "tyflix_auth";
export const COOKIE_DOMAIN = process.env.TYFLIX_AUTH_COOKIE_DOMAIN ?? ".tyflix.net";

/**
 * Find an existing user by username, or auto-create one with the given
 * display name. Slug-on-create is the responsibility of the caller.
 */
export async function findOrCreateUserByUsername(username: string, displayName?: string): Promise<User> {
  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) {
    // Touch last seen
    if (!existing.lastSeenAt || Date.now() - existing.lastSeenAt.getTime() > 60_000) {
      await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, existing.id));
    }
    return existing;
  }
  const isOwner = username === OWNER_USERNAME;
  const role: Role = isOwner ? "owner" : "friend";
  const inserted = await db
    .insert(users)
    .values({
      username,
      displayName: displayName ?? username,
      isOwner,
      role,
      lastSeenAt: new Date(),
    })
    .returning();
  await db.insert(auditLog).values({
    userId: inserted[0].id,
    action: "user.created",
    target: username,
    metadata: { role, source: "first_name_signin" },
  });
  return inserted[0];
}

/**
 * Sign in via first name. Slugifies the name, finds or creates the user,
 * mints a JWT, and returns it (the caller sets the cookie).
 */
export async function signInByFirstName(rawName: string): Promise<{ user: User; jwt: string }> {
  const display = rawName.trim().slice(0, 200);
  const username = slugifyName(display);
  if (!username) throw new Error("invalid_name");
  const user = await findOrCreateUserByUsername(username, display);
  // If display name has changed since first sign-in, refresh it
  if (display && user.displayName !== display) {
    await db.update(users).set({ displayName: display }).where(eq(users.id, user.id));
    user.displayName = display;
  }
  const claims: TyflixClaims = {
    sub: user.username,
    name: user.displayName ?? user.username,
    isOwner: user.isOwner ?? false,
    app: "genome",
  };
  const jwt = await issueToken(claims);
  await db.insert(auditLog).values({
    userId: user.id,
    action: "user.signin",
    target: user.username,
  });
  return { user, jwt };
}

export async function setSessionCookie(jwt: string): Promise<void> {
  const c = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  c.set({
    name: COOKIE_NAME,
    value: jwt,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    domain: isProd ? COOKIE_DOMAIN : undefined,
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  c.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    domain: isProd ? COOKIE_DOMAIN : undefined,
    path: "/",
    maxAge: 0,
  });
}

export async function getUser(): Promise<User | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const claims = await verifyToken(token);
  if (!claims?.sub) return null;
  // Resolve user by username from claims; auto-create if missing (covers
  // case where the JWT was issued by another tyflix app and this is the
  // user's first visit to genome).
  const user = await findOrCreateUserByUsername(claims.sub, claims.name);
  if (!user || user.banned) return null;
  return user;
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

export function isOwner(u: { isOwner?: boolean | null; role?: string | null }): boolean {
  return u.isOwner === true || u.role === "owner";
}

export function canDirectAdd(u: { role: string; autoApprove: boolean; isOwner?: boolean | null }): boolean {
  return u.isOwner === true || u.role === "owner" || u.role === "trusted" || u.autoApprove;
}

/**
 * Convenience: derive a "first name" friendly label for the user.
 * Falls back to username when displayName is missing.
 */
export function userFirstName(u: { displayName?: string | null; username?: string | null; email?: string | null }): string {
  return (u.displayName?.split(" ")[0]) || u.username || (u.email?.split("@")[0]) || "friend";
}

// Keep header() import to avoid breaking older callers — currently unused.
void headers;
