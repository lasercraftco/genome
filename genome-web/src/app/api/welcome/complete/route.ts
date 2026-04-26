import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { engine } from "@/lib/engine";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const u = await requireUser();

    const body = await req.json();
    const { artists } = body as { artists: Array<{ seed_type: string; seed_id: string; seed_label: string }> };

    if (!artists || artists.length === 0) {
      return NextResponse.json(
        { error: "At least one artist is required" },
        { status: 400 },
      );
    }

    // Mark user as onboarded
    await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, u.id));

    // Create seed stations via the engine
    for (const artist of artists) {
      try {
        await engine.createStation({
          seed_type: artist.seed_type,
          seed_id: artist.seed_id,
          seed_label: artist.seed_label,
          name: `${artist.seed_label} Radio`,
        });
      } catch (err) {
        console.error("Failed to create station:", err);
        // Continue if one fails
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Welcome complete error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
