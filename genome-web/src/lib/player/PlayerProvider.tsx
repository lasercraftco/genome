"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { NowPlayingTrack } from "@/lib/engine";
import { engine } from "@/lib/engine";
import { type PlayerState, getEngine } from "@/lib/player/audioEngine";

type Signal = "up" | "down" | "skip" | "block_artist";

interface PlayerCtx {
  state: PlayerState;
  startStation: (stationId: string) => Promise<void>;
  togglePlay: () => void;
  skip: () => Promise<void>;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
  setCrossfade: (ms: number) => void;
  thumb: (signal: Signal) => Promise<void>;
  addToLibrary: () => Promise<void>;
  cinematic: boolean;
  setCinematic: (v: boolean) => void;
  deepThink: boolean;
  setDeepThink: (v: boolean) => void;
}

const Context = createContext<PlayerCtx | null>(null);

const QUEUE_DEPTH = 3;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef<ReturnType<typeof getEngine> | null>(null);
  const [state, setState] = useState<PlayerState>({
    current: null,
    upNext: [],
    position: 0,
    duration: 0,
    playing: false,
    loading: false,
    crossfadeMs: 1500,
    volume: 0.85,
  });
  const [cinematic, setCinematic] = useState(false);
  const [deepThink, setDeepThink] = useState(false);
  const stationIdRef = useRef<string | null>(null);

  // Lazily create engine on first render
  useEffect(() => {
    engineRef.current = getEngine();
    engineRef.current.setVolume(0.85);
    const off1 = engineRef.current.on("state", setState);
    const off2 = engineRef.current.on("ended", () => {
      const sid = stationIdRef.current;
      if (!sid) return;
      // refill the queue
      void refillQueue(sid);
    });
    const off3 = engineRef.current.on("error", () => {
      void handleStreamError();
    });
    return () => {
      off1();
      off2();
      off3();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refillQueue = useCallback(async (stationId: string) => {
    try {
      const queue = await engine.getQueue(stationId, QUEUE_DEPTH, deepThink);
      if (!engineRef.current) return;
      // The first item becomes "current" (unless we already have a current playing)
      if (!engineRef.current.state().current && queue[0]) {
        await engineRef.current.play(queue[0]);
        engineRef.current.setUpNext(queue.slice(1));
      } else {
        engineRef.current.setUpNext(queue);
      }
    } catch (e) {
      toast.error("Couldn't queue more tracks", { description: String(e) });
    }
  }, [deepThink]);

  const startStation = useCallback(
    async (stationId: string) => {
      stationIdRef.current = stationId;
      if (!engineRef.current) engineRef.current = getEngine();
      try {
        const queue = await engine.getQueue(stationId, QUEUE_DEPTH, deepThink);
        if (!queue[0]) {
          toast.error("No playable tracks for this station");
          return;
        }
        await engineRef.current.play(queue[0]);
        engineRef.current.setUpNext(queue.slice(1));
      } catch (e) {
        toast.error("Failed to start station", { description: String(e) });
      }
    },
    [deepThink],
  );

  const togglePlay = useCallback(() => engineRef.current?.togglePlay(), []);
  const seek = useCallback((ms: number) => engineRef.current?.seek(ms), []);
  const setVolume = useCallback((v: number) => engineRef.current?.setVolume(v), []);
  const setCrossfade = useCallback((ms: number) => engineRef.current?.setCrossfade(ms), []);

  const skip = useCallback(async () => {
    const cur = engineRef.current?.state().current;
    if (cur) {
      void engine.feedback({
        track_id: cur.track.id,
        station_id: cur.station_id,
        signal: "skip",
      });
    }
    await engineRef.current?.advance();
    if (stationIdRef.current && (engineRef.current?.state().upNext.length ?? 0) < 2) {
      await refillQueue(stationIdRef.current);
    }
  }, [refillQueue]);

  const thumb = useCallback(
    async (signal: Signal) => {
      const cur = engineRef.current?.state().current;
      if (!cur) return;
      try {
        await engine.feedback({
          track_id: cur.track.id,
          station_id: cur.station_id,
          signal,
        });
        if (signal === "up") toast.success("Added to your taste profile");
        if (signal === "down") {
          toast("Skipped — Genome will avoid this");
          await engineRef.current?.advance();
        }
        if (signal === "block_artist") toast(`Blocked ${cur.track.artist}`);
      } catch (e) {
        toast.error("Failed to record", { description: String(e) });
      }
    },
    [],
  );

  const addToLibrary = useCallback(async () => {
    const cur = engineRef.current?.state().current;
    if (!cur) return;
    try {
      const r = await engine.addToLibrary(cur.track.id);
      if (r.status === "requested") toast("Request submitted to Tyler for approval");
      else if (r.status === "adding" || r.status === "downloading") toast.success("Adding to library…");
      else if (r.status === "in_library") toast("Already in your library");
      else toast(r.status);
    } catch (e) {
      toast.error("Failed to add", { description: String(e) });
    }
  }, []);

  const handleStreamError = useCallback(async () => {
    const cur = engineRef.current?.state().current;
    if (!cur || !stationIdRef.current) return;
    try {
      const fallback = await engine.failover(stationIdRef.current, cur.track.id);
      const alt = fallback.alternatives.find((a) => a.url !== cur.stream_url);
      if (alt) {
        await engineRef.current?.tryAlternative(alt.url);
        toast(`Switched source → ${alt.source}`);
      } else {
        toast("Skipping unplayable track");
        await engineRef.current?.advance();
      }
    } catch (e) {
      toast.error("Stream error", { description: String(e) });
    }
  }, []);

  const value = useMemo<PlayerCtx>(
    () => ({
      state,
      startStation,
      togglePlay,
      skip,
      seek,
      setVolume,
      setCrossfade,
      thumb,
      addToLibrary,
      cinematic,
      setCinematic,
      deepThink,
      setDeepThink,
    }),
    [state, startStation, togglePlay, skip, seek, setVolume, setCrossfade, thumb, addToLibrary, cinematic, deepThink],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePlayer(): PlayerCtx {
  const c = useContext(Context);
  if (!c) throw new Error("usePlayer must be used inside PlayerProvider");
  return c;
}
