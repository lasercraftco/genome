#!/usr/bin/env bash
# Genome bootstrap — first-time install on iMac (192.168.1.92).
#
# Usage (from your Mac):
#   ssh imac
#   git clone https://github.com/lasercraftco/genome.git ~/homelab/genome
#   cd ~/homelab/genome
#   bash deploy/bootstrap.sh
#
# Idempotent: rerunning is safe. Mirrors the conventions Tyler already uses
# for tyflix-karaoke (compose under ~/homelab/<svc>, .env hardlinked from
# ~/homelab/.env, ghcr image, Watchtower auto-deploy, Cloudflare tunnel
# ingress added on infra over SSH).
set -euo pipefail

# Ensure docker is on PATH and the daemon socket is reachable when this script
# is run via SSH (Docker Desktop doesn't inject these into non-interactive shells).
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:${PATH:-/usr/bin:/bin}"
if [ -S "$HOME/.docker/run/docker.sock" ] && [ -z "${DOCKER_HOST:-}" ]; then
  export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOMELAB_ENV="$HOME/homelab/.env"
TARGET_DIR="$HOME/homelab/genome"
TUNNEL_HOST_INFRA="${TUNNEL_HOST_INFRA:-infra}"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
die()  { printf "  \033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }

bold "1. Verify environment"
[ -f "$HOMELAB_ENV" ] || die "missing $HOMELAB_ENV — this script expects to run on the iMac"
command -v docker >/dev/null || die "docker not on PATH (Docker Desktop should be running)"
docker ps >/dev/null 2>&1 || die "docker daemon not reachable (ps failed)"
ok "docker ok ($(docker --version))"

# Pull required values out of ~/homelab/.env using a tolerant key=value parser
# (the file has unquoted paths with spaces that break `source`).
read_env_key() {
  local key="$1"
  # take the part after the first =, strip optional surrounding quotes
  local v
  v="$(grep -E "^${key}=" "$HOMELAB_ENV" | head -1 | sed -E "s/^${key}=//" | sed -E 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//')"
  printf %s "$v"
}

LIDARR_KEY="$(read_env_key LIDARR_KEY)"
LASTFM_API_KEY="$(read_env_key LASTFM_API_KEY)"
LASTFM_API_SECRET="$(read_env_key LASTFM_API_SECRET)"
LISTENBRAINZ_USER="$(read_env_key LISTENBRAINZ_USER)"
LISTENBRAINZ_TOKEN="$(read_env_key LISTENBRAINZ_TOKEN)"
SPOTIPY_CLIENT_ID="$(read_env_key SPOTIPY_CLIENT_ID)"
SPOTIPY_CLIENT_SECRET="$(read_env_key SPOTIPY_CLIENT_SECRET)"
CF_API_TOKEN="$(read_env_key CF_API_TOKEN)"
CF_ZONE_ID="$(read_env_key CF_ZONE_ID)"
CF_TUNNEL_ID="$(read_env_key CF_TUNNEL_ID)"
PLEX_TOKEN="$(read_env_key PLEX_TOKEN)"
POSTGRES_PASSWORD="$(read_env_key POSTGRES_PASSWORD)"
export LIDARR_KEY LASTFM_API_KEY LASTFM_API_SECRET LISTENBRAINZ_USER LISTENBRAINZ_TOKEN
export SPOTIPY_CLIENT_ID SPOTIPY_CLIENT_SECRET CF_API_TOKEN CF_ZONE_ID CF_TUNNEL_ID PLEX_TOKEN POSTGRES_PASSWORD

[ -n "$LIDARR_KEY" ]        || die "LIDARR_KEY missing in ~/homelab/.env"
[ -n "$LASTFM_API_KEY" ]    || die "LASTFM_API_KEY missing in ~/homelab/.env"
[ -n "$SPOTIPY_CLIENT_ID" ] || die "SPOTIPY_CLIENT_ID missing in ~/homelab/.env"
[ -n "$LISTENBRAINZ_TOKEN" ] || die "LISTENBRAINZ_TOKEN missing in ~/homelab/.env"
ok "secrets present in ~/homelab/.env"

bold "2. Stage code under ~/homelab/genome"
if [ "$REPO_ROOT" != "$TARGET_DIR" ]; then
  mkdir -p "$(dirname "$TARGET_DIR")"
  if [ -d "$TARGET_DIR" ]; then
    warn "$TARGET_DIR already exists — pulling latest"
    (cd "$TARGET_DIR" && git pull --rebase --autostash)
  else
    cp -R "$REPO_ROOT" "$TARGET_DIR"
    ok "copied repo to $TARGET_DIR"
  fi
fi
cd "$TARGET_DIR"

bold "3. Compose .env"
if [ ! -f .env ]; then
  cp .env.example .env
fi
# Stitch in values from the homelab .env (idempotent — sed -i creates a backup)
update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i.bak "s|^${key}=.*$|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}
update_env LASTFM_API_KEY        "$LASTFM_API_KEY"
update_env LASTFM_API_SECRET     "${LASTFM_API_SECRET:-}"
update_env LISTENBRAINZ_USER     "${LISTENBRAINZ_USER:-tyler702702}"
update_env LISTENBRAINZ_TOKEN    "$LISTENBRAINZ_TOKEN"
update_env SPOTIPY_CLIENT_ID     "$SPOTIPY_CLIENT_ID"
update_env SPOTIPY_CLIENT_SECRET "$SPOTIPY_CLIENT_SECRET"
update_env LIDARR_API_KEY        "$LIDARR_KEY"
update_env PLEX_TOKEN            "${PLEX_TOKEN:-7syZdWX1yN4z2SrpFksD}"
update_env POSTGRES_PASSWORD     "${POSTGRES_PASSWORD:-genome-$(openssl rand -hex 8)}"
rm -f .env.bak
chmod 600 .env
ok "wrote .env (chmod 600)"

bold "4. Build / pull images"
# Try GHCR first; fall back to local build if the images aren't pushed yet.
NEED_BUILD=0
docker compose -f deploy/docker-compose.yml --env-file .env pull 2>&1 | tee /tmp/genome_pull.log || NEED_BUILD=1
if grep -qE "manifest unknown|not found|denied|pull access denied" /tmp/genome_pull.log; then
  NEED_BUILD=1
fi
if [ "$NEED_BUILD" = "1" ]; then
  warn "GHCR images unavailable — building locally"
  docker build -t ghcr.io/lasercraftco/genome-engine:latest ./genome-engine
  docker build -t ghcr.io/lasercraftco/genome-web:latest    ./genome-web
  ok "built local images"
else
  ok "pulled images from GHCR"
fi

bold "5. Boot the stack"
docker compose -f deploy/docker-compose.yml --env-file .env up -d --remove-orphans
sleep 4
docker compose -f deploy/docker-compose.yml --env-file .env ps

bold "6. Run migrations (web container does this on first boot)"
# Web's entrypoint runs `pnpm drizzle:migrate` before starting next.
# Wait for the migration step to finish.
for _ in {1..20}; do
  if docker logs genome-web 2>&1 | grep -q "migrations applied"; then
    ok "migrations applied"; break
  fi
  sleep 2
done

bold "7. Verify endpoints"
curl -fsS http://localhost:3032/api/healthz >/dev/null && ok "web healthz" || warn "web healthz not yet responding"
curl -fsS http://localhost:8001/healthz     >/dev/null && ok "engine healthz" || warn "engine healthz not yet responding"

bold "8. Cloudflare tunnel ingress for genome.tyflix.net"
INGRESS_RULE='  - hostname: genome.tyflix.net\n    service: http://192.168.1.92:3032\n    originRequest:\n      noTLSVerify: true'
if ssh "$TUNNEL_HOST_INFRA" "grep -q 'genome.tyflix.net' /etc/cloudflared/config.yml"; then
  ok "ingress rule already present on $TUNNEL_HOST_INFRA"
else
  warn "adding ingress rule on $TUNNEL_HOST_INFRA"
  ssh "$TUNNEL_HOST_INFRA" "sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak.\$(date +%Y%m%d%H%M%S) && \
    sudo sed -i '/^  - service: http_status:404/i\\
${INGRESS_RULE}' /etc/cloudflared/config.yml && \
    sudo systemctl restart cloudflared"
  ok "tunnel restarted"
fi

bold "9. DNS record (genome → tunnel CNAME)"
if [ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ZONE_ID:-}" ] && [ -n "${CF_TUNNEL_ID:-}" ]; then
  CNAME_TARGET="${CF_TUNNEL_ID}.cfargotunnel.com"
  EXISTING=$(curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?name=genome.tyflix.net" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['result'][0]['id'] if d.get('result') else '')")
  if [ -z "$EXISTING" ]; then
    curl -s -X POST -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
      -d "{\"type\":\"CNAME\",\"name\":\"genome\",\"content\":\"$CNAME_TARGET\",\"proxied\":true}" >/dev/null
    ok "created CNAME genome → $CNAME_TARGET"
  else
    ok "DNS record genome.tyflix.net already exists"
  fi
else
  warn "CF_API_TOKEN / CF_ZONE_ID / CF_TUNNEL_ID not set — skipping DNS"
fi

bold "10. Done"
echo ""
echo "  → https://genome.tyflix.net"
echo "  Local: http://192.168.1.92:3032"
echo ""
echo "  Logs:  docker compose -f $TARGET_DIR/deploy/docker-compose.yml logs -f"
echo "  Down:  docker compose -f $TARGET_DIR/deploy/docker-compose.yml down"
