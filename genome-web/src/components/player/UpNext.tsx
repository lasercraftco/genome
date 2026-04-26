"use client";

import { ChevronRight } from "lucide-react";

import type { NowPlayingTrack } from "@/lib/engine";

export function UpNext({ items }: { items: NowPlayingTrack[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-text-faint mb-3">Up next</div>
      <ul className="space-y-2">
        {items.slice(0, 3).map((it, i) => (
          <li
            key={`${it.track.id}-${i}`}
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-text/5 transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.track.artwork_url ?? "/placeholder-art.svg"}
              alt=""
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-text">{it.track.title}</div>
              <div className="truncate text-xs text-text-dim">{it.track.artist}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-text-faint" />
          </li>
        ))}
      </ul>
    </div>
  );
}
