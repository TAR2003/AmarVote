#!/usr/bin/env bash
# Production deploy: pull pre-built images (built in GitHub Actions), then swap containers.
# Old containers keep serving until "up" recreates them — minimal downtime.
set -euo pipefail

cd ~/app

IMAGE_TAG="${IMAGE_TAG:-main}"
export IMAGE_TAG
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-4}"

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

# Redis warns (and can fail BGSAVE) when overcommit is off — set on the VM host.
if [ "$(sysctl -n vm.overcommit_memory 2>/dev/null || echo 0)" != "1" ]; then
  sysctl -w vm.overcommit_memory=1 >/dev/null 2>&1 || \
    echo "Warning: could not set vm.overcommit_memory=1 (run as root or add to /etc/sysctl.conf)"
fi

# Grafana volume must be writable by uid 472 when user: is set in compose.
GRAFANA_VOL="$(docker volume ls -q --filter name=grafana_data | head -1 || true)"
if [ -n "${GRAFANA_VOL}" ]; then
  docker run --rm -v "${GRAFANA_VOL}:/var/lib/grafana" alpine:3.20 \
    sh -c 'mkdir -p /var/lib/grafana/plugins && chown -R 472:472 /var/lib/grafana' \
    >/dev/null 2>&1 || true
fi

APP_SERVICES=(backend frontend electionguard-api electionguard-worker)

echo "Deploying image tag: ${IMAGE_TAG}"

# Pull while current containers are still running (parallel layer downloads).
"${COMPOSE[@]}" pull --quiet "${APP_SERVICES[@]}"

# Recreate only services whose image or config changed (no on-VM build).
"${COMPOSE[@]}" up -d --remove-orphans --no-build

# Redis must be healthy before backend (depends_on). Fail fast if still broken.
redis_health="$(docker inspect --format='{{.State.Health.Status}}' amarvote_redis 2>/dev/null || echo missing)"
if [ "${redis_health}" != "healthy" ]; then
  for _ in $(seq 1 30); do
    redis_health="$(docker inspect --format='{{.State.Health.Status}}' amarvote_redis 2>/dev/null || echo missing)"
    [ "${redis_health}" = "healthy" ] && break
    sleep 1
  done
fi
if [ "${redis_health}" != "healthy" ]; then
  echo "Error: redis is not healthy (status=${redis_health})"
  "${COMPOSE[@]}" logs --tail 30 redis || true
  exit 1
fi

# Drop dangling layers only; keep tagged images for instant rollback.
docker image prune -f

docker system prune -f