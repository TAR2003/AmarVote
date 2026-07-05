#!/usr/bin/env bash
# Run ON THE SERVER after k6 load tests — restores production DDoS nginx limits.
set -euo pipefail

cd "${HOME}/app"

docker compose --env-file .env -f docker-compose.prod.yml up -d nginx

echo "✓ Production nginx restored (nginx-proxy.conf)"
docker inspect amarvote_nginx --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep nginx-proxy || true
