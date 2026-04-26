"use client";

import { CalendarDays, Clock, Cloud, Disc3, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { engine } from "@/lib/engine";

export function SmartActions() {
  const router = useRouter();
  const [year, setYear] = useState(2018);
  const [busy, setBusy] = useState<string | null>(null);

  async function run<T extends { id?: string; stations?: Array<{ id: string }> }>(
    name: string,
    fn: () => Promise<T>,
    successMessage: string,
    redirectTo?: (r: T) => string,
  ) {
    setBusy(name);
    try {
      const r = await fn();
      toast.success(successMessage);
      if (redirectTo && (r.id || (r.stations && r.stations[0]))) router.push(redirectTo(r));
    } catch (e) {
      toast.error(`${name} failed`, { description: String(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ActionCard
        icon={<Disc3 className="h-5 w-5 text-primary" />}
        title="Generate Daily Mixes"
        body="Six stations clustered by mood from your recent thumb-ups."
      >
        <Button
          onClick={() =>
            run(
              "Daily Mixes",
              () => engine.dailyMix(),
              "Daily mixes generated",
              (r) => (r.stations?.[0] ? `/stations/${r.stations[0].id}` : "/stations"),
            )
          }
          disabled={busy !== null}
        >
          {busy === "Daily Mixes" ? "Generating…" : "Generate"}
        </Button>
      </ActionCard>

      <ActionCard
        icon={<Sparkles className="h-5 w-5 text-accent" />}
        title="Discovery Weekly"
        body="Thirty unheard tracks based on your listening pattern. New every Monday."
      >
        <Button
          onClick={() =>
            run(
              "Discovery Weekly",
              () => engine.discoveryWeekly(),
              "Discovery Weekly is ready",
              (r) => `/stations/${r.id}`,
            )
          }
          disabled={busy !== null}
        >
          {busy === "Discovery Weekly" ? "Generating…" : "Generate"}
        </Button>
      </ActionCard>

      <ActionCard
        icon={<Clock className="h-5 w-5 text-warn" />}
        title="Time Machine"
        body="A station seeded from your most-played tracks of any year."
      >
        <div className="flex gap-2">
          <Input
            type="number"
            min={2000}
            max={new Date().getFullYear()}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28"
          />
          <Button
            onClick={() =>
              run(
                "Time Machine",
                () => engine.timeMachine(year),
                `Time Machine ${year} is ready`,
                (r) => `/stations/${r.id}`,
              )
            }
            disabled={busy !== null}
          >
            Go
          </Button>
        </div>
      </ActionCard>

      <ActionCard
        icon={<Cloud className="h-5 w-5 text-text-dim" />}
        title="Mood of the moment"
        body="Time of day + recent thumb-ups → instant vibe."
      >
        <Button
          onClick={() =>
            run(
              "Mood",
              () => engine.moodOfMoment(),
              "Mood station ready",
              (r) => `/stations/${r.id}`,
            )
          }
          disabled={busy !== null}
        >
          Build it
        </Button>
      </ActionCard>
    </>
  );
}

function ActionCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface ring-1 ring-text/5 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-text">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-sm text-text-dim flex-1">{body}</p>
      {children}
    </div>
  );
}
