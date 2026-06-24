#!/usr/bin/env bash
# Pack only the files the production VM needs (no source trees, no election I/O data).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-deploy-bundle.tgz}"

cd "$ROOT"

tar czf "$OUT" \
  docker-compose.prod.yml \
  nginx-proxy.conf \
  nginx-cloudflare-realip.conf \
  rabbitmq.conf \
  scripts/vm-deploy.sh \
  Database/creation \
  backend/src/main/resources/templates \
  prometheus/prometheus.yml

echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
