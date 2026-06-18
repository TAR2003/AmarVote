#!/usr/bin/env bash
# Preflight: confirm synthetic JWTs are accepted by the target server.
# Fails fast with actionable errors before a long k6 run.
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
export TEST_EMAIL_PREFIX="${TEST_EMAIL_PREFIX:-loadtest-voter}"
export TEST_EMAIL_DOMAIN="${TEST_EMAIL_DOMAIN:-example.com}"

if [[ -z "${JWT_SECRET_B64}" ]]; then
  echo "ERROR: JWT_SECRET / JWT_SECRET_B64 is not set." >&2
  echo "Copy the value from the production server:" >&2
  echo "  ssh <user>@amarvote2026.me \"grep ^JWT_SECRET= ~/.env\"" >&2
  echo "Then put it in load-tests/.env.loadtest (see .env.loadtest.example)." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "WARN: node not found — skipping JWT preflight" >&2
  exit 0
fi

RESULT="$(node "${LOADTEST_DIR}/verify-auth.mjs")"
STATUS="$(printf '%s' "$RESULT" | head -1)"
BODY="$(printf '%s' "$RESULT" | tail -n +2)"

echo "▶ JWT preflight → ${BASE_URL}/api/auth/session"
echo "  test email: ${TEST_EMAIL_PREFIX}-0001@${TEST_EMAIL_DOMAIN}"
echo "  JWT_EXPIRATION_MS=${JWT_EXPIRATION_MS:-3600000}"

if [[ "$STATUS" == "200" ]]; then
  echo "  ✓ JWT accepted (session active)"
  exit 0
fi

echo "  ✗ JWT rejected — HTTP ${STATUS}" >&2
[[ -n "$BODY" ]] && echo "  response: ${BODY}" >&2
echo "" >&2
echo "The token format matches JWTService (HS256, base64-decoded secret, sub/iat/exp)." >&2
echo "A 401 here means either:" >&2
echo "  • JWT_SECRET in load-tests/.env.loadtest ≠ server ~/.env (most common)" >&2
echo "  • Backend not redeployed after the JWT filter fix (push main, wait for deploy)" >&2
echo "" >&2
echo "Verify on server:" >&2
echo "  grep ^JWT_SECRET= ~/.env" >&2
echo "  docker exec amarvote_backend printenv JWT_SECRET" >&2
exit 1
