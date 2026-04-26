import { engine } from "@/lib/engine";
import { formatRelative } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface AuditEntry {
  id: number;
  action: string;
  target?: string;
  user_email?: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export default async function AdminAuditPage() {
  let entries: AuditEntry[] = [];

  try {
    const result = await engine.listAuditLog(30);
    entries = result.entries || [];
  } catch (err) {
    console.error("Failed to fetch audit log:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">Audit Log</h2>
        <p className="text-sm text-text-dim">All system actions and changes</p>
      </div>

      <div className="space-y-2">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{entry.action}</Badge>
                    {entry.user_email && (
                      <span className="text-sm text-text-dim">{entry.user_email}</span>
                    )}
                  </div>
                  {entry.target && (
                    <p className="text-sm text-text-dim">Target: {entry.target}</p>
                  )}
                </div>
                <span className="text-xs text-text-dim whitespace-nowrap">
                  {formatRelative(entry.timestamp)}
                </span>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center text-text-dim">
            No audit entries found
          </Card>
        )}
      </div>
    </div>
  );
}
