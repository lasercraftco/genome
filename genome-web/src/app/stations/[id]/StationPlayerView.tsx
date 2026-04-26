"use client";

import { Maximize2, Pin, PinOff, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NowPlaying } from "@/components/player/NowPlaying";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { engine, type HistoryEntry, type Station } from "@/lib/engine";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { formatRelative } from "@/lib/utils";

export function StationPlayerView({
  station: initial,
  initialHistory = [],
}: {
  station: Station;
  initialHistory?: HistoryEntry[];
}) {
  const [station, setStation] = useState<Station>(initial);
  const [history] = useState<HistoryEntry[]>(initialHistory);
  const [cinematic, setLocalCinematic] = useState(false);
  const router = useRouter();
  const { startStation, deepThink, setDeepThink } = usePlayer();

  // Auto-start station playback on mount
  useEffect(() => {
    void startStation(station.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.id]);

  // Cinematic mode toggle (F key)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && !(e.target instanceof HTMLInputElement)) {
        setLocalCinematic((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function patchWeights(body: Parameters<typeof engine.updateWeights>[1]) {
    try {
      const updated = await engine.updateWeights(station.id, body);
      setStation(updated);
    } catch (e) {
      toast.error("Failed to update mix", { description: String(e) });
    }
  }

  async function togglePin() {
    try {
      const r = await engine.pinStation(station.id);
      setStation((s) => ({ ...s, pinned: r.pinned }));
      toast(r.pinned ? "Pinned" : "Unpinned");
    } catch (e) {
      toast.error("Couldn't pin", { description: String(e) });
    }
  }

  async function deleteStation() {
    if (!confirm(`Delete "${station.name}"?`)) return;
    try {
      await engine.deleteStation(station.id);
      toast("Station deleted");
      router.push("/home");
    } catch (e) {
      toast.error("Delete failed", { description: String(e) });
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-text-faint">{station.seed_type} radio</p>
          <h1 className="text-2xl md:text-3xl font-display text-text">{station.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setLocalCinematic(true)} aria-label="Cinematic">
            <Maximize2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={togglePin} aria-label="Pin station">
            {station.pinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Tunable mix">
                <Settings2 className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>Tunable mix</SheetTitle>
              <SheetDescription>Slide to bias what comes next.</SheetDescription>

              <div className="mt-6 space-y-6">
                <Knob
                  label="Audio similarity"
                  hint="Cosine on tempo, key, energy, mood"
                  value={station.weights.content ?? 0.30}
                  onChange={(v) => patchWeights({ feature_weight: v })}
                />
                <Knob
                  label="Tag overlap"
                  hint="Last.fm + MusicBrainz + Discogs"
                  value={station.weights.tag ?? 0.20}
                  onChange={(v) => patchWeights({ tag_weight: v })}
                />
                <Knob
                  label="Crowd ('people who like X')"
                  hint="Last.fm similar, ListenBrainz CF"
                  value={station.weights.collaborative ?? 0.25}
                  onChange={(v) => patchWeights({ lastfm_weight: v / 2, listenbrainz_weight: v / 2 })}
                />
                <Knob
                  label="Exploration"
                  hint="How willing to go off-pattern. 0 = stay on, 1 = wild"
                  value={station.exploration_ratio}
                  onChange={(v) => patchWeights({ exploration_ratio: v })}
                />

                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                  <div>
                    <div className="text-sm text-text">Auto-add thumb-ups</div>
                    <div className="text-xs text-text-dim">Every 👍 triggers a library add</div>
                  </div>
                  <Switch
                    checked={station.auto_add}
                    onCheckedChange={(v) => patchWeights({ auto_add: v })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                  <div>
                    <div className="text-sm text-text flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Deep think (LLM rerank)
                    </div>
                    <div className="text-xs text-text-dim">Slower, smarter picks. Costs tokens.</div>
                  </div>
                  <Switch checked={deepThink} onCheckedChange={setDeepThink} />
                </div>

                <button
                  onClick={deleteStation}
                  className="mt-4 w-full rounded-xl border border-down/30 px-3 py-2.5 text-sm text-down hover:bg-down/10 transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete station
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <NowPlaying stationName={station.name} cinematic={cinematic} />
      {cinematic && (
        <button
          aria-label="Exit cinematic"
          className="fixed top-4 right-4 z-50 rounded-full bg-surface/70 backdrop-blur px-3 py-1.5 text-xs text-text-dim hover:text-text"
          onClick={() => setLocalCinematic(false)}
        >
          Esc
        </button>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-text-faint">Recently played on this station</h2>
          <ul className="space-y-2">
            {history.slice(0, 30).map((h, i) => (
              <li
                key={`${h.track_id}-${i}`}
                className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2 ring-1 ring-text/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.artwork_url ?? "/placeholder-art.svg"}
                  alt=""
                  className="h-10 w-10 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text">{h.title}</div>
                  <div className="truncate text-xs text-text-dim">{h.artist}</div>
                </div>
                <span className="text-[11px] text-text-faint">{formatRelative(h.played_at)}</span>
                {h.feedback && (
                  <Badge variant={h.feedback === "up" ? "up" : h.feedback === "down" ? "down" : "secondary"}>
                    {h.feedback === "up" ? "👍" : h.feedback === "down" ? "👎" : "skipped"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Knob({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-text">{label}</div>
        <div className="font-mono text-xs text-text-dim">{(local * 100).toFixed(0)}%</div>
      </div>
      <p className="text-[11px] text-text-faint">{hint}</p>
      <Slider
        value={[local]}
        min={0}
        max={1}
        step={0.05}
        className="mt-2"
        onValueChange={(v) => setLocal(v[0])}
        onValueCommit={(v) => onChange(v[0])}
      />
    </div>
  );
}
