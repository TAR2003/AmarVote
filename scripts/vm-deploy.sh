#!/usr/bin/env bash
# Fast production deploy on the VM: build while traffic is still served, then swap containers.
set -euo pipefail

cd ~/app

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

# Rebuild only services whose build context changed; recreate containers as needed.
"${COMPOSE[@]}" up -d --build --remove-orphans

# Drop dangling image layers from this deploy (old untagged intermediates). Keep build cache.
docker image prune -f
