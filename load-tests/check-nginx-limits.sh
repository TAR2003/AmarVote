#!/usr/bin/env bash
# Detect production nginx rate limits (429) before a long k6 run.
# k6 from one IP is throttled by nginx-proxy.conf unless load-test nginx is active.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOADTEST_DIR="${ROOT_DIR}/load-tests"

set -a
if [[ -f "${ROOT_DIR}/.env" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
fi
if [[ -f "${LOADTEST_DIR}/.env.loadtest" ]]; then
  # shellcheck disable=SC1091
  source "${LOADTEST_DIR}/.env.loadtest"
fi
set +a

BASE_URL="${BASE_URL:-https://amarvote2026.me}"
BURST="${NGINX_CHECK_BURST:-40}"
TMPDIR_RESULTS="$(mktemp -d)"
trap 'rm -rf "${TMPDIR_RESULTS}"' EXIT

if ! command -v curl >/dev/null 2>&1; then
  echo "WARN: curl not found — skipping nginx limit check" >&2
  exit 0
fi

echo "▶ Nginx limit preflight (${BURST} parallel /api/health from one IP)"

for i in $(seq 1 "${BURST}"); do
  (
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${BASE_URL}/api/health" 2>/dev/null || echo "000")"
    echo "${code}" > "${TMPDIR_RESULTS}/${i}"
  ) &
done
wait

# Brief pause — avoids ENOBUFS on the next preflight after many parallel curls (local laptop buffers).
sleep 1

rate_limited=0
other_fail=0
ok=0

for f in "${TMPDIR_RESULTS}"/*; do
  code="$(cat "${f}")"
  case "${code}" in
    200) ok=$((ok + 1)) ;;
    429) rate_limited=$((rate_limited + 1)) ;;
    *) other_fail=$((other_fail + 1)) ;;
  esac
done

echo "  results: ok=${ok}  rate_limited=${rate_limited}  other=${other_fail}"

if (( rate_limited > 0 )); then
  echo "" >&2
  echo "✗ Production nginx rate limits are ACTIVE (HTTP 429 detected)." >&2
  echo "  k6 from one IP will fail heavily under nginx-proxy.conf." >&2
  echo "" >&2
  echo "On the server, enable load-test nginx:" >&2
  echo "  bash load-tests/scripts/server-enable-loadtest-nginx.sh" >&2
  echo "" >&2
  echo "After testing, restore production:" >&2
  echo "  bash load-tests/scripts/server-disable-loadtest-nginx.sh" >&2
  echo "" >&2
  echo "Or skip: SKIP_NGINX_CHECK=1 ./load-tests/run.sh ..." >&2
  exit 1
fi

if (( ok < BURST / 3 )); then
  echo "WARN: burst mostly failed (ok=${ok}/${BURST}) — server overloaded or unreachable" >&2
  exit 1
fi

echo "  ✓ No nginx 429s in parallel burst"
