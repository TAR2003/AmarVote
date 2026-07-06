#!/usr/bin/env bash
# Rolling production deploy: keep postgres/redis/rabbitmq/nginx serving while new
# images are loaded on the VM, then recreate only application containers.
#
# Images are streamed during CI (SKIP_PULL=1). Old containers keep running until
# each service is recreated in place. Cleanup runs only after the new stack is up.
#
# Named data volumes are never removed.
set -euo pipefail

cd ~/app

IMAGE_TAG="${IMAGE_TAG:-main}"
export IMAGE_TAG
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

INFRA_SERVICES=(postgres redis rabbitmq)
APP_SERVICES=(electionguard-api electionguard-worker backend frontend)
SKIP_PULL="${SKIP_PULL:-1}"

wait_container_healthy() {
  local name="$1"
  local max_attempts="${2:-60}"
  local status="missing"
  for _ in $(seq 1 "${max_attempts}"); do
    status="$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)"
    if [ "$status" = "healthy" ]; then
      return 0
    fi
    sleep 1
  done
  echo "Error: ${name} is not healthy (status=${status})" >&2
  return 1
}

wait_backend_ready() {
  local max_attempts="${1:-90}"
  for _ in $(seq 1 "${max_attempts}"); do
    if docker exec amarvote_backend wget -q -O /dev/null http://127.0.0.1:8080/actuator/health 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "Error: backend did not become ready in time" >&2
  return 1
}

# Redis warns (and can fail BGSAVE) when overcommit is off — set on the VM host.
if [ "$(sysctl -n vm.overcommit_memory 2>/dev/null || echo 0)" != "1" ]; then
  sysctl -w vm.overcommit_memory=1 >/dev/null 2>&1 || \
    echo "Warning: could not set vm.overcommit_memory=1 (run as root or add to /etc/sysctl.conf)"
fi

# Remove legacy monitoring containers no longer defined in docker-compose.prod.yml.
for legacy in amarvote_grafana amarvote_prometheus prometheus grafana; do
  docker rm -f "${legacy}" 2>/dev/null || true
done

echo "Rolling deploy for image tag: ${IMAGE_TAG}"

if [ "${SKIP_PULL}" = "1" ]; then
  echo "Using images pre-loaded on VM (SKIP_PULL=1)"
else
  echo "Pulling application images from registry..."
  "${COMPOSE[@]}" pull --quiet "${APP_SERVICES[@]}"
fi

# Keep infrastructure running — do NOT docker stop / compose down the whole stack.
echo "Ensuring infrastructure services are up..."
"${COMPOSE[@]}" up -d --no-build "${INFRA_SERVICES[@]}"

wait_container_healthy amarvote_postgres 30
wait_container_healthy amarvote_redis 30
wait_container_healthy amarvote_rabbitmq 150

# Apply schema migrations against the running postgres instance.
chmod +x scripts/run-db-migrations.sh
COMPOSE_FILE=docker-compose.prod.yml scripts/run-db-migrations.sh

# Recreate application containers one tier at a time (old version serves until each swap).
echo "Recreating ElectionGuard services..."
export COMPOSE_PARALLEL_LIMIT=2
"${COMPOSE[@]}" up -d --no-build --force-recreate --no-deps electionguard-api electionguard-worker
export COMPOSE_PARALLEL_LIMIT=1

echo "Recreating backend..."
"${COMPOSE[@]}" up -d --no-build --force-recreate --no-deps backend
wait_backend_ready 90

echo "Recreating frontend..."
"${COMPOSE[@]}" up -d --no-build --force-recreate --no-deps frontend

# Ensure nginx is up; recreate only if compose detects config/image changes.
echo "Ensuring nginx is up..."
"${COMPOSE[@]}" up -d --no-build nginx

"${COMPOSE[@]}" up -d --no-build --remove-orphans

echo "Deploy complete. Active services:"
"${COMPOSE[@]}" ps

# Cleanup only after the new stack is running.
echo "Pruning unused images and build cache..."
docker image prune -a -f
docker builder prune -f
docker volume prune -f

echo "Rolling deploy finished."
