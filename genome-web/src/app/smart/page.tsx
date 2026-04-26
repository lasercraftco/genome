import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth/session";
import { SmartActions } from "./SmartActions";

export const dynamic = "force-dynamic";

export default async function SmartPage() {
  await requireUser();
  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-28 md:pb-12 space-y-8">
        <header>
          <h1 className="text-3xl font-display text-text">Smart stations</h1>
          <p className="text-sm text-text-dim mt-1">Generated from your taste — refresh whenever.</p>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          <SmartActions />
        </section>

        <Section icon={<Sparkles className="h-4 w-4 text-primary" />} title="What these are">
          <p>
            <span className="text-text">Daily Mixes</span> — up to six stations, each a cluster of artists you've
            thumb-upped that share a mood / genre.
          </p>
          <p id="discovery-weekly">
            <span className="text-text">Discovery Weekly</span> — a fresh station every Monday with thirty tracks
            you've never heard, chosen by Genome's full ensemble.
          </p>
          <p>
            <span className="text-text">Time Machine</span> — pick a year; Genome seeds a station from your
            most-loved tracks from that year (uses your ListenBrainz scrobble history).
          </p>
          <p>
            <span className="text-text">Mood-of-the-moment</span> — current time-of-day plus your recent thumb-ups
            picks a vibe.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface/60 ring-1 ring-text/5 p-5 space-y-2 text-sm text-text-dim leading-relaxed">
      <h2 className="flex items-center gap-2 text-text text-sm font-medium">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
