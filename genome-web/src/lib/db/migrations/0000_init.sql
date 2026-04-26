-- Genome initial schema
-- Drizzle-compatible: each statement separated by `--> statement-breakpoint`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar(40) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" varchar(320) NOT NULL,
  "name" varchar(200),
  "avatar_url" varchar(800),
  "role" varchar(20) NOT NULL DEFAULT 'friend',
  "banned" boolean NOT NULL DEFAULT false,
  "auto_approve" boolean NOT NULL DEFAULT false,
  "daily_add_quota" integer NOT NULL DEFAULT 5,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz,
  "onboarded_at" timestamptz,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email" ON "users" ("email");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "magic_tokens" (
  "id" serial PRIMARY KEY,
  "email" varchar(320) NOT NULL,
  "token" varchar(80) NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_magic_email" ON "magic_tokens" ("email");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" varchar(80) PRIMARY KEY,
  "user_id" varchar(40) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "user_agent" varchar(500),
  "ip" varchar(64)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" serial PRIMARY KEY,
  "user_id" varchar(40) REFERENCES "users" ("id") ON DELETE SET NULL,
  "action" varchar(80) NOT NULL,
  "target" varchar(200),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "audit_log" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_action" ON "audit_log" ("action");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tracks" (
  "id" varchar(40) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "mbid" varchar(40),
  "title" varchar(400) NOT NULL,
  "artist" varchar(300) NOT NULL,
  "album" varchar(300),
  "duration_ms" integer,
  "isrc" varchar(20),
  "spotify_id" varchar(50),
  "audio_features" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "artwork_url" varchar(800),
  "streaming_url_cached" text,
  "streaming_url_expires_at" timestamptz,
  "source" varchar(40),
  "source_id" varchar(80),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_artist_title" ON "tracks" ("artist", "title");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tracks_mbid" ON "tracks" ("mbid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tracks_artist" ON "tracks" ("artist");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stations" (
  "id" varchar(40) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" varchar(40) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "seed_type" varchar(20) NOT NULL,
  "seed_id" varchar(80) NOT NULL,
  "seed_label" varchar(300) NOT NULL,
  "weights" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "exploration_ratio" double precision NOT NULL DEFAULT 0.20,
  "pinned" boolean NOT NULL DEFAULT false,
  "auto_add" boolean NOT NULL DEFAULT false,
  "deep_think" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_played_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stations_user" ON "stations" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stations_last_played" ON "stations" ("last_played_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stations_pinned" ON "stations" ("pinned");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "station_tracks" (
  "id" serial PRIMARY KEY,
  "station_id" varchar(40) NOT NULL REFERENCES "stations" ("id") ON DELETE CASCADE,
  "user_id" varchar(40) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "track_id" varchar(40) NOT NULL REFERENCES "tracks" ("id"),
  "played_at" timestamptz NOT NULL DEFAULT now(),
  "feedback" varchar(10),
  "score" double precision,
  "explanation" jsonb NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_station_tracks_station" ON "station_tracks" ("station_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_station_tracks_user" ON "station_tracks" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" serial PRIMARY KEY,
  "user_id" varchar(40) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "track_id" varchar(40) NOT NULL REFERENCES "tracks" ("id"),
  "station_id" varchar(40) REFERENCES "stations" ("id") ON DELETE CASCADE,
  "signal" varchar(10) NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_user" ON "feedback" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_track" ON "feedback" ("track_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_station" ON "feedback" ("station_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "library_adds" (
  "id" serial PRIMARY KEY,
  "user_id" varchar(40) NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "track_id" varchar(40) NOT NULL REFERENCES "tracks" ("id"),
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "approved_at" timestamptz,
  "approved_by" varchar(40) REFERENCES "users" ("id") ON DELETE SET NULL,
  "denial_reason" text,
  "lidarr_request_id" integer,
  "playlistdl_request_id" varchar(80),
  "status" varchar(30) NOT NULL DEFAULT 'pending',
  "downloaded_path" text,
  "error" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_library_adds_user" ON "library_adds" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_library_adds_track" ON "library_adds" ("track_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_library_adds_status" ON "library_adds" ("status");
