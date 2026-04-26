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
docker info >/dev/null 2>&1 || die "docker daemon not reachable"
ok "docker ok ($(docker --version))"

# Pull required values out of ~/homelab/.env
# shellcheck disable=SC1090
set -a; source "$HOMELAB_ENV"; set +a
: "${LIDARR_KEY:?LIDARR_KEY missing in ~/homelab/.env}"
: "${LASTFM_API_KEY:?LASTFM_API_KEY missing in ~/homelab/.env}"
: "${SPOTIPY_CLIENT_ID:?SPOTIPY_CLIENT_ID missing in ~/homelab/.env}"
: "${LISTENBRAINZ_TOKEN:?LISTENBRAINZ_TOKEN missing in ~/homelab/.env}"
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

bold "4. Pull / build images"
docker compose -f deploy/docker-compose.yml --env-file .env pull || true
ok "images pulled (or will build on up)"

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
