#!/usr/bin/env bash
# Production deploy: use pre-built images (built in GitHub Actions), then swap containers.
# Images are streamed to the VM over SSH during CI (SKIP_PULL=1). Set SKIP_PULL=0 to pull
# from the registry on the VM instead (e.g. manual deploy with stable registry access).
#
# Named data volumes (postgres_data, redis_data, rabbitmq_data, credentials_data) are never
# removed — compose down/up and volume prune only drop unused anonymous volumes.
set -euo pipefail

cd ~/app

IMAGE_TAG="${IMAGE_TAG:-main}"
export IMAGE_TAG
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

# Redis warns (and can fail BGSAVE) when overcommit is off — set on the VM host.
if [ "$(sysctl -n vm.overcommit_memory 2>/dev/null || echo 0)" != "1" ]; then
  sysctl -w vm.overcommit_memory=1 >/dev/null 2>&1 || \
    echo "Warning: could not set vm.overcommit_memory=1 (run as root or add to /etc/sysctl.conf)"
fi

APP_SERVICES=(backend frontend electionguard-api electionguard-worker)

SKIP_PULL="${SKIP_PULL:-1}"

echo "Deploying image tag: ${IMAGE_TAG}"

# Stop every running container (brief downtime; data volumes stay on disk).
running="$(docker ps -q)"
if [ -n "${running}" ]; then
  echo "Stopping all running containers..."
  docker stop ${running}
fi

# Remove legacy monitoring containers no longer defined in docker-compose.prod.yml.
for legacy in amarvote_grafana amarvote_prometheus prometheus grafana; do
  docker rm -f "${legacy}" 2>/dev/null || true
done

# Tear down the compose project without -v (keeps postgres_data and all named volumes).
"${COMPOSE[@]}" down --remove-orphans

if [ "${SKIP_PULL}" = "1" ]; then
  echo "Skipping registry pull (images pre-loaded on VM)"
else
  "${COMPOSE[@]}" pull --quiet "${APP_SERVICES[@]}"
fi

# Apply schema migrations while postgres is up (prod uses ddl-auto=validate).
chmod +x scripts/run-db-migrations.sh
COMPOSE_FILE=docker-compose.prod.yml scripts/run-db-migrations.sh

# Recreate only services defined in docker-compose.prod.yml (no on-VM build).
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

# 1. Safely delete all tagged images that are NOT tied to a running container
docker image prune -a -f

# 2. Wipe the temporary layer build caches
docker builder prune -f

# 3. Clean up empty, anonymous volume footprints (named data volumes are in use — kept)
docker volume prune -f

echo "Deploy complete. Active services:"
"${COMPOSE[@]}" ps
