#!/usr/bin/env bash
# Production deploy: pull pre-built images (built in GitHub Actions), then swap containers.
# Old containers keep serving until "up" recreates them — minimal downtime.
set -euo pipefail

cd ~/app

IMAGE_TAG="${IMAGE_TAG:-main}"
export IMAGE_TAG

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

APP_SERVICES=(backend frontend electionguard-api electionguard-worker)

echo "Deploying image tag: ${IMAGE_TAG}"

# Pull while current containers are still running.
"${COMPOSE[@]}" pull "${APP_SERVICES[@]}"

# Recreate only services whose image or config changed (no on-VM build).
"${COMPOSE[@]}" up -d --remove-orphans --no-build

# Drop dangling image layers from this deploy. Keep pulled images for rollback.
docker image prune -f
