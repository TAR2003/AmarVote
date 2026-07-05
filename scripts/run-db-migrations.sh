#!/usr/bin/env bash
# Apply idempotent SQL migrations from Database/migrations/ before backend starts (ddl-auto=validate).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-Database/migrations}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-amarvote_postgres}"

COMPOSE=(docker compose --env-file .env -f "$COMPOSE_FILE")

wait_container_healthy() {
  local name="$1"
  local status="missing"
  for _ in $(seq 1 30); do
    status="$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)"
    if [ "$status" = "healthy" ]; then
      return 0
    fi
    sleep 1
  done
  echo "Error: $name is not healthy (status=$status)" >&2
  return 1
}

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "No migrations directory at $MIGRATIONS_DIR — skipping"
  exit 0
fi

shopt -s nullglob
files=( "$MIGRATIONS_DIR"/*.sql )
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "No migration SQL files found — skipping"
  exit 0
fi

echo "Starting postgres for migrations..."
"${COMPOSE[@]}" up -d postgres
wait_container_healthy "$POSTGRES_CONTAINER"

echo "Applying ${#files[@]} database migration(s)..."
for f in "${files[@]}"; do
  echo "  -> $(basename "$f")"
  "${COMPOSE[@]}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U amarvote_user -d amarvote_db < "$f"
done

echo "Database migrations applied."
