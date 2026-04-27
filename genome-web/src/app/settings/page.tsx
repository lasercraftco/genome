import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";

import { CrossfadeControl } from "./CrossfadeControl";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const u = await requireUser();
  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-28 md:pb-12 space-y-6">
        <header>
          <h1 className="text-3xl font-display text-text">Settings</h1>
          <p className="text-sm text-text-dim mt-1">Personal preferences for {BRAND.name}.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in as {u.displayName ?? u.username}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-dim">Role:</span>
              <Badge variant={u.role === "owner" ? "up" : "secondary"}>{u.role}</Badge>
            </div>
            {u.role === "friend" && (
              <p className="text-xs text-text-faint mt-3">
                Library adds you make are reviewed by Tyler. Daily quota: {u.dailyAddQuota}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Playback</CardTitle>
            <CardDescription>Tune how Genome blends tracks.</CardDescription>
          </CardHeader>
          <CardContent>
            <CrossfadeControl />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keyboard shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid sm:grid-cols-2 gap-y-2 text-sm">
              <li className="flex justify-between"><span className="text-text-dim">Play / pause</span><kbd className="rounded bg-text/10 px-2 py-0.5 text-xs">Space</kbd></li>
              <li className="flex justify-between"><span className="text-text-dim">Skip</span><kbd className="rounded bg-text/10 px-2 py-0.5 text-xs">→</kbd></li>
              <li className="flex justify-between"><span className="text-text-dim">Thumb up</span><kbd className="rounded bg-text/10 px-2 py-0.5 text-xs">↑</kbd></li>
              <li className="flex justify-between"><span className="text-text-dim">Thumb down</span><kbd className="rounded bg-text/10 px-2 py-0.5 text-xs">↓</kbd></li>
              <li className="flex justify-between"><span className="text-text-dim">Add to library</span><kbd className="rounded bg-text/10 px-2 py-0.5 text-xs">L</kbd></li>
              <li className="flex justify-between"><span className="text-text-dim">New station</span><kbd className="rounded bg-text/10 px-2 py-0.5 text-xs">N</kbd></li>
              <li className="flex justify-between"><span className="text-text-dim">Search</span><kbd className="rounded bg-text/10 px-2 py-0.5 text-xs">⌘K</kbd></li>
              <li className="flex justify-between"><span className="text-text-dim">Cinematic mode</span><kbd className="rounded bg-text/10 px-2 py-0.5 text-xs">F</kbd></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
