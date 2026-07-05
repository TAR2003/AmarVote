#!/usr/bin/env bash
# Pack only the files the production VM needs (no source trees, no election I/O data).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-deploy-bundle.tgz}"

cd "$ROOT"

tar czf "$OUT" \
  docker-compose.prod.yml \
  redis.prod.conf \
  nginx-proxy.conf \
  nginx-cloudflare-realip.conf \
  rabbitmq.conf \
  scripts/vm-deploy.sh \
  scripts/run-db-migrations.sh \
  Database/creation \
  Database/migrations \
  backend/src/main/resources/templates

echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
