#!/bin/sh
# Gunicorn entrypoint for ElectionGuard Worker (heavy tally/decryption).
# Match rabbitmq.worker.concurrency.max in backend application.properties.
set -e

WORKERS="${GUNICORN_WORKERS:-1}"
THREADS="${GUNICORN_THREADS:-1}"
MAX_REQUESTS="${GUNICORN_MAX_REQUESTS:-5000}"
MAX_REQUESTS_JITTER="${GUNICORN_MAX_REQUESTS_JITTER:-40}"

exec gunicorn \
  --bind "0.0.0.0:5001" \
  --workers "$WORKERS" \
  --worker-class sync \
  --threads "$THREADS" \
  --worker-connections 512 \
  --backlog 2048 \
  --max-requests "$MAX_REQUESTS" \
  --max-requests-jitter "$MAX_REQUESTS_JITTER" \
  --timeout 600 \
  --graceful-timeout 120 \
  --keep-alive 5 \
  --preload \
  --worker-tmp-dir /dev/shm \
  --access-logfile - \
  --error-logfile - \
  --log-level warning \
  api:app
