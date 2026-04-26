"use client";

import { Heart, Pause, Play, Plus, SkipForward, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { formatDuration } from "@/lib/utils";

export function MiniPlayer() {
  const { state, togglePlay, skip, thumb, addToLibrary } = usePlayer();
  const cur = state.current;
  if (!cur) return null;
  const pct = state.duration > 0 ? (state.position / state.duration) * 100 : 0;
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 px-3 pb-3 pointer-events-none">
      <div className="mx-auto max-w-3xl pointer-events-auto rounded-2xl bg-surface/90 backdrop-blur-md ring-1 ring-text/5 shadow-[var(--brand-shadow)] overflow-hidden">
        <div className="h-0.5 bg-text/5">
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Link href={`/stations/${cur.station_id}`} className="flex min-w-0 items-center gap-3 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.track.artwork_url ?? "/placeholder-art.svg"} alt="" className="h-10 w-10 rounded-md object-cover" />
            <div className="min-w-0">
              <div className="truncate text-sm text-text">{cur.track.title}</div>
              <div className="truncate text-xs text-text-dim">{cur.track.artist}</div>
            </div>
          </Link>
          <div className="hidden md:block text-xs text-text-faint tabular-nums">
            {formatDuration(state.position)} / {formatDuration(state.duration)}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => thumb("up")} aria-label="Thumb up" className="text-up">
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={togglePlay} aria-label="Play/Pause">
              {state.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={skip} aria-label="Skip">
              <SkipForward className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={addToLibrary} aria-label="Add to library">
              {cur.track.in_library ? <Heart className="h-4 w-4 fill-accent text-accent" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
