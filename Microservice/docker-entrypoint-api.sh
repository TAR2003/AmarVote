#!/bin/sh
# Gunicorn entrypoint — defaults sized for 4 GB RAM hosts (4 workers × 2 threads).
set -e

WORKERS="${GUNICORN_WORKERS:-4}"
THREADS="${GUNICORN_THREADS:-2}"

exec gunicorn \
  --bind "0.0.0.0:5000" \
  --workers "$WORKERS" \
  --worker-class gthread \
  --threads "$THREADS" \
  --worker-connections 512 \
  --backlog 1024 \
  --preload \
  --max-requests 5000 \
  --max-requests-jitter 100 \
  --timeout 120 \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --worker-tmp-dir /dev/shm \
  --access-logfile - \
  --error-logfile - \
  --log-level warning \
  api:app
