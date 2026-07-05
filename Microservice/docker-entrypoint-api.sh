#!/bin/sh
# Gunicorn entrypoint for ElectionGuard API (CPU-bound ballot encryption).
# Use sync workers when THREADS=1 — gthread caused deadlocks with --preload + crypto.
set -e

WORKERS="${GUNICORN_WORKERS:-4}"
THREADS="${GUNICORN_THREADS:-1}"
MAX_REQUESTS="${GUNICORN_MAX_REQUESTS:-300}"
MAX_REQUESTS_JITTER="${GUNICORN_MAX_REQUESTS_JITTER:-50}"

if [ "$THREADS" -eq 1 ]; then
  WORKER_CLASS="sync"
else
  WORKER_CLASS="gthread"
fi

exec gunicorn \
  --bind "0.0.0.0:5000" \
  --workers "$WORKERS" \
  --worker-class "$WORKER_CLASS" \
  --threads "$THREADS" \
  --worker-connections 512 \
  --backlog 2048 \
  --preload \
  --max-requests "$MAX_REQUESTS" \
  --max-requests-jitter "$MAX_REQUESTS_JITTER" \
  --timeout 300 \
  --graceful-timeout 60 \
  --keep-alive 5 \
  --worker-tmp-dir /dev/shm \
  --access-logfile - \
  --error-logfile - \
  --log-level warning \
  api:app
