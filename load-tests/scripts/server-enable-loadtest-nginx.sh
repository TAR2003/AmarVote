#!/usr/bin/env bash
# Run ON THE SERVER (amarvote2026.me) before k6 load tests.
# Switches nginx to nginx-proxy.loadtest.conf (no per-IP API throttling).
set -euo pipefail

cd "${HOME}/app"

docker compose --env-file .env \
  -f docker-compose.prod.yml \
  -f docker-compose.loadtest.yml \
  up -d nginx

echo "✓ Load-test nginx active"
docker inspect amarvote_nginx --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep nginx-proxy || true

echo ""
echo "Optional — confirm only prod services are running:"
echo "  docker compose -f docker-compose.prod.yml ps"
