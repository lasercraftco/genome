/**
 * Magic-link email token issuance + verification.
 * Email send goes via Resend if RESEND_API_KEY is set; otherwise we log the
 * link to the server console (dev convenience).
 */

import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLog, magicTokens, users } from "@/lib/db/schema";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const OWNER_EMAIL = process.env.GENOME_OWNER_EMAIL ?? "tylerheon@gmail.com";


export async function issueToken(email: string): Promise<{ token: string; link: string }> {
  const lower = email.trim().toLowerCase();
  const token = randomBytes(36).toString("base64url");
  await db.insert(magicTokens).values({
    email: lower,
    token,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? (process.env.NODE_ENV === "production" ? "https://genome.tyflix.net" : "http://localhost:3032");
  const link = `${baseUrl}/auth/callback?token=${encodeURIComponent(token)}`;
  await sendEmail(lower, link);
  await db.insert(auditLog).values({
    action: "magic.issued",
    target: lower,
  });
  return { token, link };
}


export async function consumeToken(token: string) {
  const row = await db.query.magicTokens.findFirst({
    where: and(eq(magicTokens.token, token), gt(magicTokens.expiresAt, new Date()), isNull(magicTokens.consumedAt)),
  });
  if (!row) return null;
  await db.update(magicTokens).set({ consumedAt: new Date() }).where(eq(magicTokens.id, row.id));
  return row;
}


export async function findOrCreateUser(email: string) {
  const lower = email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, lower) });
  if (existing) return existing;
  // First user with the configured owner email becomes owner; rest default to friend.
  const role = lower === OWNER_EMAIL.toLowerCase() ? "owner" : "friend";
  const inserted = await db
    .insert(users)
    .values({ email: lower, role, lastSeenAt: new Date() })
    .returning();
  await db.insert(auditLog).values({
    action: "user.created",
    target: lower,
    metadata: { role },
  });
  return inserted[0];
}


// ---------- email transport ----------

async function sendEmail(toEmail: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM ?? "Genome <noreply@tyflix.net>";
  if (!apiKey) {
    console.log(`\n[genome] dev magic link for ${toEmail}:\n  ${link}\n`);
    return;
  }
  const html = renderMagicEmail(link);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddr,
      to: [toEmail],
      subject: "Your sign-in link for Genome",
      html,
    }),
  });
  if (!r.ok) {
    console.error("[genome] resend send failed:", r.status, await r.text());
    throw new Error("email_send_failed");
  }
}


function renderMagicEmail(link: string): string {
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#08070d;color:#f5f3fb;border-radius:18px">
      <h1 style="font-size:22px;margin:0 0 8px 0">Sign in to <span style="color:#c084fc">Genome</span></h1>
      <p style="color:#b9b3cf;font-size:15px;line-height:1.55">Click the button below to sign in. The link is good for 15 minutes.</p>
      <p style="margin:28px 0">
        <a href="${link}" style="display:inline-block;background:#a855f7;color:#fff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:600">Sign me in</a>
      </p>
      <p style="color:#6c6585;font-size:12px">If the button doesn't work, paste this into your browser:<br/><span style="color:#b9b3cf">${link}</span></p>
    </div>`;
}
