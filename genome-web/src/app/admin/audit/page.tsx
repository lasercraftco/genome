import { db } from "@/lib/db";
import { formatRelative } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { libraryAdds, tracks, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface LibraryAuditEntry {
  id: number;
  userEmail: string;
  trackTitle: string;
  trackArtist: string;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
}

export default async function AdminAuditPage() {
  let entries: LibraryAuditEntry[] = [];

  try {
    const rows = await db
      .select({
        id: libraryAdds.id,
        userEmail: users.email,
        trackTitle: tracks.title,
        trackArtist: tracks.artist,
        status: libraryAdds.status,
        requestedAt: libraryAdds.requestedAt,
        approvedAt: libraryAdds.approvedAt,
      })
      .from(libraryAdds)
      .innerJoin(users, eq(libraryAdds.userId, users.id))
      .innerJoin(tracks, eq(libraryAdds.trackId, tracks.id))
      .orderBy(desc(libraryAdds.requestedAt))
      .limit(200);

    entries = rows.map(r => ({
      id: r.id,
      userEmail: r.userEmail,
      trackTitle: r.trackTitle,
      trackArtist: r.trackArtist,
      status: r.status,
      requestedAt: typeof r.requestedAt === 'string' ? r.requestedAt : new Date(r.requestedAt).toISOString(),
      approvedAt: r.approvedAt ? (typeof r.approvedAt === 'string' ? r.approvedAt : new Date(r.approvedAt).toISOString()) : null,
    }));
  } catch (err) {
    console.error("Failed to fetch library audit:", err);
  }

  const STATUS_BADGE_COLOR: Record<string, string> = {
    auto_approved: "up",
    adding: "warn",
    downloading: "warn",
    in_library: "up",
    denied: "down",
    failed: "down",
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">Library Audit</h2>
        <p className="text-sm text-text-dim">Track requests and library additions</p>
      </div>

      <div className="space-y-2">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text">{entry.trackTitle}</span>
                      <span className="text-xs text-text-dim">by {entry.trackArtist}</span>
                    </div>
                    <div className="text-xs text-text-dim">{entry.userEmail}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGE_COLOR[entry.status] as any ?? "secondary"}>
                      {entry.status}
                    </Badge>
                    <span className="text-xs text-text-dim whitespace-nowrap">
                      {formatRelative(entry.requestedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center text-text-dim">
            No library activity found
          </Card>
        )}
      </div>
    </div>
  );
}
