/**
 * Drizzle schema for the `genome` Postgres database.
 * Source of truth for table structure — both genome-web and genome-engine
 * agree on these names + columns.
 *
 * Multi-user model: stations / station_tracks / feedback / library_adds
 * all carry a user_id. The `tracks` catalog is global (deduped across users).
 *
 * Auth model (2026-04 refactor): first-name sign-in, no email/magic-link.
 * `username` is the slugified first name; same name across all tyflix apps
 * resolves to the same user. JWT cookie at .tyflix.net.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ---------- users + auth ----------

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 40 }).primaryKey().default(sql`gen_random_uuid()::text`),
    username: varchar("username", { length: 50 }).notNull(),
    displayName: varchar("display_name", { length: 200 }),
    isOwner: boolean("is_owner").notNull().default(false),
    // email kept nullable for backward-compat with pre-refactor rows
    email: varchar("email", { length: 320 }),
    name: varchar("name", { length: 200 }),
    avatarUrl: varchar("avatar_url", { length: 800 }),
    role: varchar("role", { length: 20 }).notNull().default("friend"), // owner | trusted | friend | guest
    banned: boolean("banned").notNull().default(false),
    autoApprove: boolean("auto_approve").notNull().default(false),
    dailyAddQuota: integer("daily_add_quota").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    uniqueIndex("uq_users_username").on(t.username),
    index("idx_users_email").on(t.email),
  ],
);

// Audit log for sensitive actions
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 40 }).references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    target: varchar("target", { length: 200 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_audit_user").on(t.userId), index("idx_audit_action").on(t.action)],
);

// ---------- station + playback ----------

export const stations = pgTable(
  "stations",
  {
    id: varchar("id", { length: 40 }).primaryKey().default(sql`gen_random_uuid()::text`),
    userId: varchar("user_id", { length: 40 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    seedType: varchar("seed_type", { length: 20 }).notNull(),
    seedId: varchar("seed_id", { length: 80 }).notNull(),
    seedLabel: varchar("seed_label", { length: 300 }).notNull(),
    weights: jsonb("weights").$type<Record<string, number>>().notNull().default({}),
    explorationRatio: doublePrecision("exploration_ratio").notNull().default(0.20),
    pinned: boolean("pinned").notNull().default(false),
    autoAdd: boolean("auto_add").notNull().default(false),
    deepThink: boolean("deep_think").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_stations_user").on(t.userId),
    index("idx_stations_last_played").on(t.lastPlayedAt),
    index("idx_stations_pinned").on(t.pinned),
  ],
);

export const tracks = pgTable(
  "tracks",
  {
    id: varchar("id", { length: 40 }).primaryKey().default(sql`gen_random_uuid()::text`),
    mbid: varchar("mbid", { length: 40 }),
    title: varchar("title", { length: 400 }).notNull(),
    artist: varchar("artist", { length: 300 }).notNull(),
    album: varchar("album", { length: 300 }),
    durationMs: integer("duration_ms"),
    isrc: varchar("isrc", { length: 20 }),
    spotifyId: varchar("spotify_id", { length: 50 }),
    audioFeatures: jsonb("audio_features").$type<Record<string, number>>().notNull().default({}),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    artworkUrl: varchar("artwork_url", { length: 800 }),
    streamingUrlCached: text("streaming_url_cached"),
    streamingUrlExpiresAt: timestamp("streaming_url_expires_at", { withTimezone: true }),
    source: varchar("source", { length: 40 }),
    sourceId: varchar("source_id", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_artist_title").on(t.artist, t.title),
    index("idx_tracks_mbid").on(t.mbid),
    index("idx_tracks_artist").on(t.artist),
  ],
);

export const stationTracks = pgTable(
  "station_tracks",
  {
    id: serial("id").primaryKey(),
    stationId: varchar("station_id", { length: 40 })
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 40 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: varchar("track_id", { length: 40 })
      .notNull()
      .references(() => tracks.id),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
    feedback: varchar("feedback", { length: 10 }),
    score: doublePrecision("score"),
    explanation: jsonb("explanation").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index("idx_station_tracks_station").on(t.stationId),
    index("idx_station_tracks_user").on(t.userId),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 40 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: varchar("track_id", { length: 40 })
      .notNull()
      .references(() => tracks.id),
    stationId: varchar("station_id", { length: 40 }).references(() => stations.id, { onDelete: "cascade" }),
    signal: varchar("signal", { length: 10 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_feedback_user").on(t.userId),
    index("idx_feedback_track").on(t.trackId),
    index("idx_feedback_station").on(t.stationId),
  ],
);

export const libraryAdds = pgTable(
  "library_adds",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 40 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: varchar("track_id", { length: 40 })
      .notNull()
      .references(() => tracks.id),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: varchar("approved_by", { length: 40 }).references(() => users.id, { onDelete: "set null" }),
    denialReason: text("denial_reason"),
    lidarrRequestId: integer("lidarr_request_id"),
    playlistdlRequestId: varchar("playlistdl_request_id", { length: 80 }),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    // statuses: requested | pending | adding | downloading | in_library | denied | failed
    downloadedPath: text("downloaded_path"),
    error: text("error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_library_adds_user").on(t.userId),
    index("idx_library_adds_track").on(t.trackId),
    index("idx_library_adds_status").on(t.status),
  ],
);

export type User = typeof users.$inferSelect;
export type Station = typeof stations.$inferSelect;
export type NewStation = typeof stations.$inferInsert;
export type Track = typeof tracks.$inferSelect;
export type StationTrack = typeof stationTracks.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type LibraryAdd = typeof libraryAdds.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;

export type Role = "owner" | "trusted" | "friend" | "guest";
