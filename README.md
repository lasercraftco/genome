# Genome

Self-hosted, Pandora-style music discovery for the Tyflix homelab.

> Code name: **Genome** (after the Music Genome Project). Public name TBD —
> brand variables are centralized in `genome-web/src/lib/brand.ts` and
> `genome-web/src/app/brand.css` so a rename is one config change.

## What it does

- Pick an artist or song → get a station of similar tracks
- Tracks **stream** on demand from YouTube / SoundCloud / Bandcamp / Internet Archive (via `yt-dlp`)
- **Thumb up / thumb down / skip** to refine the station, Pandora-style
- **"Add to library"** → triggers a Lidarr download (with `playlist-dl` fallback)
  so the track lands in `/Volumes/Music` and shows up in Plex / Navidrome
- Why this song? — exposes the Music Genome–style breakdown
  (tempo, key, energy, danceability, mood tags, similarity sources)

## Stack

| Layer        | Choice                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Web          | Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui                                                   |
| Engine       | Python 3.12 + FastAPI                                                                               |
| DB           | Postgres 16 (`genome` database, on iMac alongside the existing instance)                            |
| Discovery    | Last.fm Similar API + ListenBrainz + MusicBrainz + Spotify audio-features + AcousticBrainz archive  |
| Streaming    | yt-dlp (YouTube primary, SoundCloud / Bandcamp / IA fallback). **No paid streaming sources.**       |
| Library wire | Lidarr API (existing `lidarr.tyflix.net`) → `playlist-dl` fallback (`dl.tyflix.net`)                |
| Auth         | None — Tailscale + Cloudflare Tunnel are the perimeter                                              |
| Deploy       | Docker Compose on iMac (192.168.1.92) → Watchtower auto-deploy from `ghcr.io/lasercraftco/genome-*` |
| Public URL   | `https://genome.tyflix.net` via the existing Cloudflare tunnel                                      |

## Ports

| Service         | Port | Why                                         |
| --------------- | ---- | ------------------------------------------- |
| `genome-web`    | 3032 | 3030 (lights), 3031 reserved by other apps  |
| `genome-engine` | 8001 | 8000 reserved                               |
| Postgres        | 5432 | Reuses the existing iMac Postgres instance  |

## Running

```bash
# Local dev (full stack via compose)
make dev

# Production deploy on iMac
ssh imac
cd ~/homelab/genome
docker compose pull && docker compose up -d
```

See [`DEPLOY.md`](./DEPLOY.md) for the first-time setup on the iMac.

## Architecture

```
┌────────────────────┐      ┌────────────────────┐      ┌────────────────┐
│  Browser (Tyler)   │ ───> │  genome-web :3032  │ ───> │ genome-engine  │
│                    │      │  Next.js 15        │      │ FastAPI :8001  │
└────────────────────┘      └────────────────────┘      └───────┬────────┘
                                                                │
                          ┌─────────────────────────────────────┼──────────────────────┐
                          │                                     │                      │
                  ┌───────▼───────┐                  ┌──────────▼────────┐   ┌────────▼────────┐
                  │  Postgres 16  │                  │  Discovery sources │   │  Library wire   │
                  │  `genome` DB  │                  │  Last.fm           │   │  Lidarr API     │
                  │               │                  │  ListenBrainz      │   │  playlist-dl    │
                  └───────────────┘                  │  MusicBrainz       │   └─────────────────┘
                                                    │  Spotify (meta)    │
                                                    │  yt-dlp            │
                                                    └────────────────────┘
```

## Repo layout

```
genome/
├── genome-web/         # Next.js 15 frontend + thin API routes
├── genome-engine/      # Python FastAPI service (recommendation + streaming)
├── genome-db/          # Drizzle migrations + schema (TypeScript source of truth)
├── deploy/             # docker-compose, cloudflared ingress rules, deploy scripts
├── .github/workflows/  # multi-arch ghcr.io builds
└── docs/               # operator notes
```
