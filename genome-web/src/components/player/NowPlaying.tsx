"use client";

import { Heart, Library, Pause, Play, Plus, SkipForward, Sparkles, ThumbsDown, ThumbsUp, Volume2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { formatDuration } from "@/lib/utils";

import { UpNext } from "./UpNext";
import { WhyPanel } from "./WhyPanel";

interface Props {
  stationName?: string;
  cinematic?: boolean;
}

export function NowPlaying({ stationName, cinematic = false }: Props) {
  const { state, togglePlay, skip, thumb, addToLibrary, seek } = usePlayer();
  const cur = state.current;

  // Keyboard shortcuts: Space play/pause, → skip, ↑ up, ↓ down, L library
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        skip();
      } else if (e.code === "ArrowUp") {
        thumb("up");
      } else if (e.code === "ArrowDown") {
        thumb("down");
      } else if (e.key.toLowerCase() === "l") {
        addToLibrary();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, skip, thumb, addToLibrary]);

  if (!cur) {
    return (
      <div className="rounded-3xl bg-surface/60 backdrop-blur p-12 text-center text-text-dim">
        <Sparkles className="mx-auto mb-4 h-10 w-10 text-primary opacity-60" />
        <p className="text-lg">Pick a station to start the radio.</p>
      </div>
    );
  }

  const art = cur.track.artwork_url ?? "/placeholder-art.svg";
  const pct = state.duration > 0 ? (state.position / state.duration) * 100 : 0;

  return (
    <div
      className={
        cinematic
          ? "fixed inset-0 z-40 bg-bg overflow-hidden"
          : "rounded-3xl bg-gradient-to-b from-surface to-surface-2 p-6 md:p-10 shadow-[var(--brand-shadow)]"
      }
    >
      {cinematic && art ? (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 cinematic-art opacity-40 blur-3xl"
          style={{ background: `radial-gradient(circle at 50% 40%, transparent 0%, var(--brand-bg) 80%), url(${art}) center/cover` }}
        />
      ) : null}

      {stationName ? (
        <div className="mb-3 text-xs uppercase tracking-[0.18em] text-text-faint">{stationName}</div>
      ) : null}

      <div className={cinematic ? "flex flex-col items-center justify-center h-full gap-8 px-6" : "grid md:grid-cols-[1fr_2fr] gap-8 items-center"}>
        <div className="relative aspect-square w-full max-w-[420px] mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={art}
            alt=""
            className={`h-full w-full rounded-2xl object-cover shadow-2xl ${cinematic ? "cinematic-art" : ""}`}
          />
          {cur.track.source ? (
            <Badge variant="outline" className="absolute bottom-3 left-3 backdrop-blur">
              {cur.track.source}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-col">
          <h1 className={cinematic ? "text-4xl md:text-6xl font-display font-semibold text-text" : "text-3xl md:text-4xl font-display font-semibold text-text"}>
            {cur.track.title}
          </h1>
          <p className="mt-1 text-lg md:text-xl text-text-dim">{cur.track.artist}</p>

          {cur.track.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {cur.track.tags.slice(0, 5).map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-6">
            <div
              className="h-1.5 rounded-full bg-text/10 overflow-hidden cursor-pointer"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const f = (e.clientX - r.left) / r.width;
                seek(f * state.duration);
              }}
            >
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-text-faint tabular-nums">
              <span>{formatDuration(state.position)}</span>
              <span>{formatDuration(state.duration)}</span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 md:gap-5">
            <Button size="xl" variant="ghost" onClick={() => thumb("down")} aria-label="Thumb down">
              <ThumbsDown className="h-7 w-7" />
            </Button>
            <Button size="xl" onClick={togglePlay} aria-label={state.playing ? "Pause" : "Play"}>
              {state.playing ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
            </Button>
            <Button size="xl" variant="ghost" onClick={skip} aria-label="Skip">
              <SkipForward className="h-7 w-7" />
            </Button>
            <Button size="xl" variant="ghost" onClick={() => thumb("up")} aria-label="Thumb up" className="text-up">
              <ThumbsUp className="h-7 w-7" />
            </Button>
            <Button
              size="xl"
              variant={cur.track.in_library ? "outline" : "default"}
              onClick={addToLibrary}
              aria-label={cur.track.in_library ? "In library" : "Add to library"}
              className={cur.track.in_library ? "text-accent border-accent/40" : ""}
            >
              {cur.track.in_library ? <Heart className="h-6 w-6 fill-accent text-accent" /> : <Plus className="h-6 w-6" />}
            </Button>
          </div>

          <div className="mt-5 flex items-center gap-3 text-xs text-text-faint">
            <Sheet>
              <SheetTrigger asChild>
                <button className="underline underline-offset-4 hover:text-text-dim">
                  Why this song?
                </button>
              </SheetTrigger>
              <SheetContent>
                <SheetTitle>Why this song?</SheetTitle>
                <SheetDescription>The signals Genome combined to pick this track.</SheetDescription>
                <WhyPanel current={cur} />
              </SheetContent>
            </Sheet>
            <span aria-hidden>·</span>
            <span>{cur.track.in_library ? "✓ in your library" : cur.track.library_status ?? "not in library"}</span>
          </div>
        </div>
      </div>

      {!cinematic && state.upNext.length > 0 ? (
        <div className="mt-8 border-t border-text/5 pt-6">
          <UpNext items={state.upNext} />
        </div>
      ) : null}
    </div>
  );
}
