"use client";

import { useState } from "react";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { usePlayer } from "@/lib/player/PlayerProvider";

export function CrossfadeControl() {
  const { state, setCrossfade, setVolume } = usePlayer();
  const [crossfade, setLocalCrossfade] = useState(state.crossfadeMs);
  const [vol, setLocalVol] = useState(state.volume);
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text">Crossfade</span>
          <span className="font-mono text-xs text-text-dim">{(crossfade / 1000).toFixed(1)}s</span>
        </div>
        <Slider
          value={[crossfade]}
          min={0}
          max={6000}
          step={250}
          className="mt-2"
          onValueChange={(v) => setLocalCrossfade(v[0])}
          onValueCommit={(v) => setCrossfade(v[0])}
        />
        <p className="text-[11px] text-text-faint mt-1">0 = gapless cuts, 6 = long beach-bar dissolves.</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text">Volume</span>
          <span className="font-mono text-xs text-text-dim">{Math.round(vol * 100)}%</span>
        </div>
        <Slider
          value={[vol]}
          min={0}
          max={1}
          step={0.02}
          className="mt-2"
          onValueChange={(v) => setLocalVol(v[0])}
          onValueCommit={(v) => setVolume(v[0])}
        />
      </div>
    </div>
  );
}
