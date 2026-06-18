#!/usr/bin/env bash
# Preflight: fetch live candidate names for ELECTION_ID before vote load tests.
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

export JWT_SECRET_B64="${JWT_SECRET_B64:-${JWT_SECRET:-}}"
export JWT_EXPIRATION_MS="${JWT_EXPIRATION_MS:-3600000}"
export BASE_URL="${BASE_URL:-https://amarvote2026.me}"
export ELECTION_ID="${ELECTION_ID:-10}"
export TEST_EMAIL_PREFIX="${TEST_EMAIL_PREFIX:-loadtest-voter}"
export TEST_EMAIL_DOMAIN="${TEST_EMAIL_DOMAIN:-example.com}"

if ! command -v node >/dev/null 2>&1; then
  echo "WARN: node not found — skipping election candidate preflight" >&2
  exit 0
fi

echo "▶ Election preflight → ${BASE_URL}/api/election/${ELECTION_ID}"

mapfile -t LINES < <(node "${LOADTEST_DIR}/fetch-election-candidates.mjs")
COUNT="${LINES[0]}"
CANDIDATES=("${LINES[@]:1}")

echo "  ✓ ${COUNT} candidate(s) loaded from API:"
for name in "${CANDIDATES[@]}"; do
  echo "      • ${name}"
done
