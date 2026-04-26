/**
 * GenomeAudioEngine — gapless / crossfade playback via the Web Audio API.
 *
 * Two HTMLAudioElement decks (A & B) routed through GainNodes into the
 * AudioContext destination. The next track is preloaded on deck B while
 * deck A plays. On track-change we ramp A.gain → 0 and B.gain → 1 over
 * `crossfadeMs` (default 1500). Then we swap which deck is "current".
 *
 * The engine emits events: 'tick' (every 250ms), 'ended', 'error',
 * 'meta' (when current track metadata changes), 'queue' (when the up-next
 * stack changes).
 */

import type { NowPlayingTrack } from "@/lib/engine";

export interface PlayerState {
  current: NowPlayingTrack | null;
  upNext: NowPlayingTrack[];
  position: number; // ms
  duration: number; // ms
  playing: boolean;
  loading: boolean;
  crossfadeMs: number;
  volume: number;
}

type EventName = "state" | "ended" | "error";
type Listener = (state: PlayerState) => void;

export class GenomeAudioEngine {
  private ctx: AudioContext | null = null;
  private deckA = new Audio();
  private deckB = new Audio();
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private current: "A" | "B" = "A";
  private upNext: NowPlayingTrack[] = [];
  private currentTrack: NowPlayingTrack | null = null;
  private listeners = new Map<EventName, Set<Listener>>();
  private tickHandle: number | null = null;
  private crossfadeMs = 1500;
  private volume = 1.0;
  private endHandlers = new Map<HTMLAudioElement, () => void>();

  constructor() {
    [this.deckA, this.deckB].forEach((a) => {
      a.crossOrigin = "anonymous";
      a.preload = "auto";
    });
  }

  // ---------- public API ----------

  init(): void {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.gainA = this.ctx.createGain();
    this.gainB = this.ctx.createGain();
    this.gainA.gain.value = 1;
    this.gainB.gain.value = 0;
    const srcA = this.ctx.createMediaElementSource(this.deckA);
    const srcB = this.ctx.createMediaElementSource(this.deckB);
    srcA.connect(this.gainA).connect(this.ctx.destination);
    srcB.connect(this.gainB).connect(this.ctx.destination);
  }

  on(event: EventName, listener: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  setCrossfade(ms: number): void {
    this.crossfadeMs = Math.max(0, Math.min(8000, ms));
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gainA && this.gainB) {
      const cur = this.current === "A" ? this.gainA : this.gainB;
      cur.gain.setTargetAtTime(this.volume, this.ctx!.currentTime, 0.05);
    }
  }

  /**
   * Plays a track immediately (replacing current). Used for the very first track
   * or for "pick this from up-next now" jumps.
   */
  async play(track: NowPlayingTrack): Promise<void> {
    this.init();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
    const deck = this.activeDeck();
    deck.src = track.stream_url;
    deck.currentTime = 0;
    this.currentTrack = track;
    this.emit("state");
    try {
      await deck.play();
      this.startTicking();
    } catch (e) {
      this.emit("error");
      throw e;
    }
  }

  /**
   * Set the up-next stack — engine pre-buffers the next item on the inactive deck.
   */
  setUpNext(next: NowPlayingTrack[]): void {
    this.upNext = next;
    this.preloadNext();
    this.emit("state");
  }

  /**
   * Crossfade to the first item in upNext. Called automatically on `ended`,
   * also wired to the Skip button.
   */
  async advance(): Promise<void> {
    const next = this.upNext.shift();
    if (!next) {
      // Nothing queued; let the consumer fetch more.
      this.emitEnded();
      return;
    }
    const inactive = this.inactiveDeck();
    if (inactive.src !== next.stream_url) {
      inactive.src = next.stream_url;
      inactive.currentTime = 0;
    }
    try {
      await inactive.play();
    } catch (e) {
      this.emit("error");
      return;
    }
    this.crossfadeTo(this.current === "A" ? "B" : "A");
    this.currentTrack = next;
    this.preloadNext();
    this.emit("state");
  }

  togglePlay(): void {
    const deck = this.activeDeck();
    if (deck.paused) deck.play().catch(() => this.emit("error"));
    else deck.pause();
    this.emit("state");
  }

  seek(ms: number): void {
    const deck = this.activeDeck();
    deck.currentTime = ms / 1000;
    this.emit("state");
  }

  destroy(): void {
    this.stopTicking();
    [this.deckA, this.deckB].forEach((a) => {
      a.pause();
      a.src = "";
    });
    if (this.ctx) this.ctx.close().catch(() => undefined);
  }

  state(): PlayerState {
    const deck = this.activeDeck();
    return {
      current: this.currentTrack,
      upNext: this.upNext,
      position: (deck.currentTime || 0) * 1000,
      duration: ((this.currentTrack?.track.duration_ms ?? deck.duration * 1000) || 0),
      playing: !deck.paused,
      loading: deck.readyState < 3,
      crossfadeMs: this.crossfadeMs,
      volume: this.volume,
    };
  }

  // ---------- failover ----------

  /**
   * Called by the consumer when an `error` is emitted; pass alternative URLs
   * to swap into the active deck without dropping playback or counting the
   * previous track as a thumb-down.
   */
  async tryAlternative(url: string): Promise<void> {
    const deck = this.activeDeck();
    const wasPlaying = !deck.paused;
    const t = deck.currentTime;
    deck.src = url;
    deck.currentTime = t;
    if (wasPlaying) {
      try {
        await deck.play();
      } catch {
        this.emit("error");
      }
    }
  }

  // ---------- internals ----------

  private activeDeck(): HTMLAudioElement {
    return this.current === "A" ? this.deckA : this.deckB;
  }
  private inactiveDeck(): HTMLAudioElement {
    return this.current === "A" ? this.deckB : this.deckA;
  }

  private preloadNext(): void {
    const next = this.upNext[0];
    if (!next) return;
    const inactive = this.inactiveDeck();
    if (inactive.src !== next.stream_url) {
      inactive.src = next.stream_url;
      try {
        inactive.load();
      } catch {
        /* ignore */
      }
    }
  }

  private crossfadeTo(deck: "A" | "B"): void {
    if (!this.ctx || !this.gainA || !this.gainB) return;
    const t = this.ctx.currentTime;
    const fade = this.crossfadeMs / 1000;
    if (deck === "A") {
      this.gainA.gain.linearRampToValueAtTime(this.volume, t + fade);
      this.gainB.gain.linearRampToValueAtTime(0, t + fade);
    } else {
      this.gainA.gain.linearRampToValueAtTime(0, t + fade);
      this.gainB.gain.linearRampToValueAtTime(this.volume, t + fade);
    }
    this.current = deck;
  }

  private startTicking(): void {
    if (this.tickHandle != null) return;
    const tick = () => {
      this.maybeAutoAdvance();
      this.emit("state");
    };
    this.tickHandle = window.setInterval(tick, 250);
    // wire ended handler on each deck
    [this.deckA, this.deckB].forEach((a) => {
      const handler = () => this.advance().catch(() => undefined);
      this.endHandlers.set(a, handler);
      a.addEventListener("ended", handler);
    });
  }

  private maybeAutoAdvance(): void {
    const deck = this.activeDeck();
    if (!deck.duration || isNaN(deck.duration)) return;
    const remainingSec = deck.duration - deck.currentTime;
    // start crossfade slightly before track ends
    if (remainingSec * 1000 < this.crossfadeMs && this.upNext.length > 0 && this.gainA && this.gainB) {
      // Trigger fade-in of the inactive deck if it isn't already playing
      const inactive = this.inactiveDeck();
      if (inactive.paused && inactive.readyState >= 2) {
        inactive.play().catch(() => undefined);
        this.crossfadeTo(this.current === "A" ? "B" : "A");
        const next = this.upNext.shift()!;
        this.currentTrack = next;
        this.preloadNext();
      }
    }
  }

  private stopTicking(): void {
    if (this.tickHandle != null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    [this.deckA, this.deckB].forEach((a) => {
      const h = this.endHandlers.get(a);
      if (h) a.removeEventListener("ended", h);
    });
  }

  private emit(name: EventName): void {
    const set = this.listeners.get(name);
    if (!set) return;
    const s = this.state();
    set.forEach((fn) => fn(s));
    if (name !== "state") {
      this.listeners.get("state")?.forEach((fn) => fn(s));
    }
  }

  private emitEnded(): void {
    this.listeners.get("ended")?.forEach((fn) => fn(this.state()));
  }
}

// Singleton: the engine survives client-side navigations.
let _engine: GenomeAudioEngine | null = null;
export function getEngine(): GenomeAudioEngine {
  if (typeof window === "undefined") throw new Error("audio engine is browser only");
  if (!_engine) _engine = new GenomeAudioEngine();
  return _engine;
}
