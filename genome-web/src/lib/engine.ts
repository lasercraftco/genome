/**
 * Thin client for the Python FastAPI engine. Server-side fetches go direct;
 * client-side fetches go through the /api/engine/* rewrite to avoid CORS.
 *
 * On the server we forward the current user's id + role as headers so the
 * engine can scope queries per-user.
 */

import { getUser } from "@/lib/auth/session";

const BASE_SERVER = process.env.GENOME_ENGINE_URL ?? "http://localhost:8001";
const BASE_BROWSER = "/api/engine";

function base(): string {
  return typeof window === "undefined" ? `${BASE_SERVER}/api` : BASE_BROWSER;
}

async function userHeaders(): Promise<Record<string, string>> {
  if (typeof window !== "undefined") return {};
  const u = await getUser();
  if (!u) return {};
  return {
    "X-Genome-User-Id": u.id,
    "X-Genome-User-Role": u.role,
    "X-Genome-User-Email": u.email,
  };
}

async function request<T>(
  path: string,
  init?: RequestInit & { params?: Record<string, string | number | boolean> },
): Promise<T> {
  const search = new URLSearchParams();
  if (init?.params) {
    for (const [k, v] of Object.entries(init.params)) search.set(k, String(v));
  }
  const final = `${base()}${path}${search.toString() ? `?${search.toString()}` : ""}`;
  const r = await fetch(final, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(await userHeaders()),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!r.ok) {
    let body = "";
    try {
      body = await r.text();
    } catch {}
    throw new Error(`engine ${path} → ${r.status}: ${body.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

// ---------- types (mirror schemas.py) ----------

export interface SearchResult {
  kind: "artist" | "track" | "tag";
  id: string;
  label: string;
  sublabel?: string;
  artwork_url?: string;
  mbid?: string;
}

export interface Station {
  id: string;
  name: string;
  seed_type: string;
  seed_id: string;
  seed_label: string;
  weights: Record<string, number>;
  exploration_ratio: number;
  pinned: boolean;
  auto_add: boolean;
  created_at: string;
  last_played_at: string | null;
}

export interface TrackOut {
  id: string;
  mbid: string | null;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number | null;
  artwork_url: string | null;
  audio_features: Record<string, number>;
  tags: string[];
  source: string | null;
  in_library: boolean;
  library_status: string | null;
}

export interface WhyExplanation {
  reason: string;
  sources: string[];
  similarity_score: number | null;
  tag_overlap: string[];
  feature_breakdown: Record<string, number>;
}

export interface NowPlayingTrack {
  track: TrackOut;
  stream_url: string;
  stream_url_expires_at: string;
  station_id: string;
  queue_position: number;
  explanation: WhyExplanation;
}

export interface HistoryEntry {
  track_id: string;
  artist: string;
  title: string;
  artwork_url: string | null;
  played_at: string;
  feedback: string | null;
  score: number | null;
  explanation: Record<string, unknown>;
}

// ---------- engine API ----------

export const engine = {
  search: (q: string) => request<{ query: string; results: SearchResult[] }>(`/search`, { params: { q } }),

  listStations: () => request<{ stations: Station[] }>(`/stations`),
  createStation: (req: { seed_type: string; seed_id: string; seed_label: string; name?: string }) =>
    request<Station>(`/stations`, { method: "POST", body: JSON.stringify(req) }),
  getStation: (id: string) => request<Station>(`/stations/${id}`),
  deleteStation: (id: string) => request<{ status: string }>(`/stations/${id}`, { method: "DELETE" }),
  pinStation: (id: string) => request<{ pinned: boolean }>(`/stations/${id}/pin`, { method: "POST" }),
  updateWeights: (
    id: string,
    body: {
      feature_weight?: number;
      tag_weight?: number;
      lastfm_weight?: number;
      listenbrainz_weight?: number;
      exploration_ratio?: number;
      auto_add?: boolean;
    },
  ) => request<Station>(`/stations/${id}/weights`, { method: "PATCH", body: JSON.stringify(body) }),

  nextTrack: (id: string, deepThink = false) =>
    request<NowPlayingTrack>(`/play/${id}/next`, { params: { deep_think: deepThink } }),
  getQueue: (id: string, n = 3, deepThink = false) =>
    request<NowPlayingTrack[]>(`/play/${id}/queue`, { params: { n, deep_think: deepThink } }),
  failover: (id: string, trackId: string) =>
    request<{ alternatives: Array<{ url: string; expires_at: string; source: string }> }>(
      `/play/${id}/failover/${trackId}`,
    ),

  feedback: (body: {
    track_id: string;
    station_id?: string;
    signal: "up" | "down" | "skip" | "block_artist";
  }) => request<{ status: string }>(`/feedback`, { method: "POST", body: JSON.stringify(body) }),

  addToLibrary: (track_id: string) =>
    request<{ track_id: string; status: string }>(`/library/add`, {
      method: "POST",
      body: JSON.stringify({ track_id }),
    }),
  libraryStatus: (track_id: string) =>
    request<{ track_id: string; status: string }>(`/library/status/${track_id}`),

  history: (id: string, limit = 50) =>
    request<{ station_id: string; entries: HistoryEntry[] }>(`/stations/${id}/history`, {
      params: { limit },
    }),

  // Smart features
  dailyMix: () => request<{ stations: Station[] }>(`/smart/daily-mix`, { method: "POST" }),
  discoveryWeekly: () => request<Station>(`/smart/discovery-weekly`, { method: "POST" }),
  timeMachine: (year: number) =>
    request<Station>(`/smart/time-machine`, { method: "POST", params: { year } }),
  moodOfMoment: () => request<Station>(`/smart/mood-of-the-moment`, { method: "POST" }),

  // Admin API
  updateUser: (id: string, body: { role?: string; banned?: boolean; auto_approve?: boolean; daily_add_quota?: number }) =>
    request<{ status: string }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listUsers: () => request<{ users: Array<{ id: string; email: string; role: string; banned: boolean; auto_approve: boolean; daily_add_quota: number; last_seen_at?: string }> }>(`/admin/users`),

  listAuditLog: (days = 30) => request<{ entries: Array<{ id: number; action: string; target?: string; user_email?: string; timestamp: string; metadata: Record<string, any> }> }>(`/admin/audit`, { params: { days } }),

  listLibraryRequests: (status?: string) => request<{ requests: Array<{ id: number; user_email: string; track_title: string; track_artist: string; requested_at: string }> }>(`/library/requests`, { params: { status } }),

  approveRequest: (id: number) => request<{ status: string }>(`/library/requests/${id}/approve`, { method: "POST" }),

  denyRequest: (id: number, reason?: string) => request<{ status: string }>(`/library/requests/${id}/deny`, { method: "POST", body: JSON.stringify({ reason }) }),
};
