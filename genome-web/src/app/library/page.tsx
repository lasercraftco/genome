import { ExternalLink, Library } from "lucide-react";
import { desc, eq } from "drizzle-orm";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { libraryAdds, tracks } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  auto_approved: "Approved · adding…",
  requested: "Requested · awaiting Tyler",
  pending: "Pending",
  adding: "Adding…",
  downloading: "Downloading…",
  in_library: "In your library",
  denied: "Denied",
  failed: "Failed",
};

const STATUS_VARIANT: Record<string, "up" | "down" | "warn" | "secondary" | "outline"> = {
  in_library: "up",
  denied: "down",
  failed: "down",
  downloading: "warn",
  adding: "warn",
  auto_approved: "warn",
  requested: "outline",
  pending: "outline",
};

export default async function LibraryPage() {
  const user = await requireUser();
  const rows = await db
    .select({
      id: libraryAdds.id,
      status: libraryAdds.status,
      requestedAt: libraryAdds.requestedAt,
      track: tracks,
    })
    .from(libraryAdds)
    .innerJoin(tracks, eq(libraryAdds.trackId, tracks.id))
    .where(eq(libraryAdds.userId, user.id))
    .orderBy(desc(libraryAdds.requestedAt))
    .limit(200);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-28 md:pb-12 space-y-6">
        <header>
          <h1 className="text-3xl font-display text-text">Your library activity</h1>
          <p className="text-sm text-text-dim mt-1">Tracks you've added (or requested). Open in Plex / Navidrome from any landed track.</p>
        </header>

        {rows.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No additions yet</CardTitle>
              <CardDescription>Hit the heart on a song you love and Genome will start downloading it.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3 ring-1 ring-text/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.track.artworkUrl ?? "/placeholder-art.svg"}
                  alt=""
                  className="h-12 w-12 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text">{r.track.title}</div>
                  <div className="truncate text-xs text-text-dim">{r.track.artist}</div>
                </div>
                <div className="hidden md:block text-[11px] text-text-faint">
                  {formatRelative(r.requestedAt)}
                </div>
                <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                {r.status === "in_library" && (
                  <a
                    href={`https://music.tyflix.net`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-text-faint hover:text-text"
                    aria-label="Open in Navidrome"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-2xl bg-surface/60 ring-1 ring-text/5 p-5 flex items-start gap-3 text-sm text-text-dim">
          <Library className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-text">Wired into Tyler's existing stack:</p>
            <p>
              All adds go straight to <a href="https://lidarr.tyflix.net" className="text-primary underline" target="_blank" rel="noreferrer">Lidarr</a> for download.
              Friends are limited to 10 adds per day. Tracks land at <a href="https://music.tyflix.net" className="text-primary underline" target="_blank" rel="noreferrer">music.tyflix.net</a> (Navidrome) and <a href="https://plex.tyflix.net" className="text-primary underline" target="_blank" rel="noreferrer">Plex</a>.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
