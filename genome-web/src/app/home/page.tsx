import { Disc3, Pin, Plus, Sparkles } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { engine } from "@/lib/engine";
import { requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const data = await engine.listStations().catch(() => ({ stations: [] }));
  const pinned = data.stations.filter((s) => s.pinned);
  const recent = data.stations.filter((s) => !s.pinned).slice(0, 12);

  const greeting =
    new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-28 md:pb-12 space-y-10">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-text-faint">{greeting}</p>
            <h1 className="text-3xl md:text-4xl font-display text-text">
              What do you want to hear, {user.name?.split(" ")[0] ?? user.email.split("@")[0]}?
            </h1>
          </div>
        </header>

        <section>
          <SectionTitle>Quick start</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickCard href="/smart" label="Daily Mixes" icon={<Sparkles className="h-5 w-5" />} />
            <QuickCard href="/smart#discovery-weekly" label="Discovery Weekly" icon={<Sparkles className="h-5 w-5" />} />
            <QuickCard href="/library" label="Your library" icon={<Disc3 className="h-5 w-5" />} />
            <QuickCard href="/stations" label="All stations" icon={<Disc3 className="h-5 w-5" />} />
          </div>
        </section>

        {pinned.length > 0 && (
          <section>
            <SectionTitle>
              <Pin className="inline h-4 w-4 text-primary mr-2" />
              Pinned
            </SectionTitle>
            <StationGrid stations={pinned} />
          </section>
        )}

        <section>
          <div className="flex items-center justify-between">
            <SectionTitle>Recent stations</SectionTitle>
            <Link
              href="/stations"
              className="text-sm text-text-dim hover:text-text underline underline-offset-4"
            >
              See all
            </Link>
          </div>
          {recent.length === 0 ? (
            <Card className="text-center">
              <CardHeader>
                <CardTitle>No stations yet</CardTitle>
                <CardDescription>Hit ⌘K (or press N) to start one from any artist or song.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/stations">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Start your first station
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <StationGrid stations={recent} />
          )}
        </section>
      </div>
    </AppShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-text-faint flex items-center">
      {children}
    </h2>
  );
}

function QuickCard({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl bg-surface ring-1 ring-text/5 p-4 hover:bg-surface-2 hover:ring-primary/30 transition flex items-center gap-3"
    >
      <span className="rounded-lg bg-primary/15 p-2 text-primary group-hover:bg-primary/25 transition">{icon}</span>
      <span className="text-sm text-text">{label}</span>
    </Link>
  );
}

function StationGrid({ stations }: { stations: { id: string; name: string; seed_label: string; last_played_at: string | null }[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {stations.map((s) => (
        <Link
          key={s.id}
          href={`/stations/${s.id}`}
          className="group rounded-2xl bg-surface ring-1 ring-text/5 p-4 hover:bg-surface-2 hover:ring-primary/30 transition"
        >
          <div className="text-sm text-text font-medium truncate">{s.name}</div>
          <div className="text-xs text-text-dim mt-1 truncate">{s.seed_label}</div>
          <div className="text-[11px] text-text-faint mt-3">last played {formatRelative(s.last_played_at)}</div>
        </Link>
      ))}
    </div>
  );
}
