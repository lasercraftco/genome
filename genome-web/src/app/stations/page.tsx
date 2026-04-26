import { Plus } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engine } from "@/lib/engine";
import { requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StationsPage() {
  await requireUser();
  const { stations } = await engine.listStations().catch(() => ({ stations: [] }));

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-28 md:pb-12 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display text-text">Stations</h1>
            <p className="text-sm text-text-dim">Every station you've started.</p>
          </div>
        </header>

        {stations.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No stations yet</CardTitle>
              <CardDescription>Press ⌘K or N to start one.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/home">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Start one
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stations.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/stations/${s.id}`}
                  className="block rounded-2xl bg-surface ring-1 ring-text/5 p-4 hover:bg-surface-2 hover:ring-primary/30 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-text font-medium truncate">{s.name}</div>
                      <div className="text-xs text-text-dim mt-0.5 truncate">{s.seed_label}</div>
                    </div>
                    {s.pinned && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                        pinned
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-text-faint">
                    <span>{s.seed_type}</span>
                    <span>last played {formatRelative(s.last_played_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
