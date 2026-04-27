# Deploying Genome

End-state goal: `https://genome.tyflix.net` loads, magic-link sign-in works, picking an artist starts a station that streams.

## One-shot deploy (recommended)

From your Mac:

```bash
# 1. Create the GitHub repo (gh auth must be set up; you have it for tyflix-karaoke)
cd /Users/tyler/Documents/genome
git init -b main
git add .
git commit -m "feat: Genome v1 — multi-source, multi-strategy music discovery"
gh repo create lasercraftco/genome --public --source=. --remote=origin --push

# 2. SSH to iMac, clone + bootstrap
ssh imac '
  cd ~/homelab && \
  git clone https://github.com/lasercraftco/genome.git && \
  cd genome && \
  bash deploy/bootstrap.sh
'
```

`bootstrap.sh` is idempotent. It:

1. Verifies Docker is running on iMac.
2. Reads secrets from `~/homelab/.env` (your existing Last.fm + ListenBrainz + Spotify + Lidarr keys).
3. Writes `genome/.env` (chmod 600) with stitched-in values.
4. `docker compose pull` (or build) for `genome-postgres`, `genome-engine`, `genome-web`, `genome-ytdlp-updater`.
5. Brings the stack up; web container's entrypoint runs `pnpm drizzle:migrate` first.
6. Verifies `/api/healthz` and `/healthz`.
7. Adds the `genome.tyflix.net` ingress rule to `cloudflared` on **infra** over SSH.
8. Creates the CNAME via the Cloudflare API using your existing `CF_API_TOKEN` / `CF_ZONE_ID` / `CF_TUNNEL_ID`.

When it finishes, hit https://genome.tyflix.net.

## First sign-in

The first email to sign in becomes the **owner** account. The default
`GENOME_OWNER_EMAIL` is `tylerheon@gmail.com`. To use a different one:

```bash
echo "GENOME_OWNER_EMAIL=you@example.com" >> ~/homelab/genome/.env
docker compose -f ~/homelab/genome/deploy/docker-compose.yml restart web
```

In dev (no `RESEND_API_KEY` set), the magic link prints to the web container's
log instead of sending email:

```bash
docker logs -f genome-web | grep "dev magic link"
```

Set `RESEND_API_KEY` + `RESEND_FROM` in `.env` for production email.

## Watchtower auto-deploy

Same pattern as `tyflix-karaoke`:

- Pushes to `lasercraftco/genome` `main` trigger GH Actions builds (`build-engine.yml`, `build-web.yml`).
- Multi-arch images (`linux/amd64,linux/arm64`) push to `ghcr.io/lasercraftco/genome-engine:latest` and `ghcr.io/lasercraftco/genome-web:latest`.
- The iMac's existing Watchtower polls every day at 02:00 UTC, sees new digests, and restarts both containers (label-gated via `com.centurylinklabs.watchtower.enable=true`).

If you want immediate deploy after a push:

```bash
ssh imac 'docker compose -f ~/homelab/genome/deploy/docker-compose.yml pull && docker compose -f ~/homelab/genome/deploy/docker-compose.yml up -d'
```

## Updating yt-dlp

The `genome-ytdlp-updater` container runs daily and `pip install --upgrade yt-dlp` so YouTube extractor breakage gets self-healed within 24h. No action needed.

## Adding new friends

1. Tyler shares `https://genome.tyflix.net` with a friend.
2. Friend signs in via email magic link → defaults to `friend` role.
3. Friend can add tracks to library immediately (no approval gate).
4. Friends are rate-limited to 10 adds per day; owners/trusted have unlimited.
5. Tyler can override per-friend quotas at `/admin/quotas`.
6. All library activity (adds, status) is logged at `/admin/audit` for transparency.

## Rollback

```bash
ssh imac '
  cd ~/homelab/genome && \
  docker compose -f deploy/docker-compose.yml down && \
  # pin to a prior digest:
  docker pull ghcr.io/lasercraftco/genome-web:sha-<7-char-hash> && \
  docker tag ghcr.io/lasercraftco/genome-web:sha-<hash> ghcr.io/lasercraftco/genome-web:latest && \
  docker compose -f deploy/docker-compose.yml up -d
'
```

## Decommission

```bash
ssh imac '
  cd ~/homelab/genome && \
  docker compose -f deploy/docker-compose.yml down -v && \
  cd .. && rm -rf genome
'
ssh infra 'sudo sed -i "/genome.tyflix.net/,/noTLSVerify: true/d" /etc/cloudflared/config.yml && sudo systemctl restart cloudflared'
# Then delete the genome.tyflix.net DNS record in the Cloudflare dashboard.
```
