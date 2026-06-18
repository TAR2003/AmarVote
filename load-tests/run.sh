#!/usr/bin/env bash
# Run k6 load tests with secrets from .env files (never committed).
#
# Usage:
#   ./load-tests/run.sh scenarios/smoke.js
#   ./load-tests/run.sh scenarios/vote-encrypt-2000.js
#   ./load-tests/run.sh scenarios/mixed-2000.js --summary-export=load-tests/results/summary.json
#
# Loads (in order, later overrides earlier):
#   1. project root .env
#   2. load-tests/.env.loadtest

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOADTEST_DIR="${ROOT_DIR}/load-tests"

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed. See docs/K6_LOAD_TEST_2000_USERS.md" >&2
  exit 1
fi

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

# Map server .env JWT_SECRET to k6 variable name
export JWT_SECRET_B64="${JWT_SECRET_B64:-${JWT_SECRET:-}}"
export BASE_URL="${BASE_URL:-https://amarvote2026.me}"
export ELECTION_ID="${ELECTION_ID:-10}"
export TEST_EMAIL_PREFIX="${TEST_EMAIL_PREFIX:-loadtest-voter}"
export TEST_EMAIL_DOMAIN="${TEST_EMAIL_DOMAIN:-example.com}"
export CANDIDATES="${CANDIDATES:-A big name|nobo tobo|masnoon muztahid}"
export MAX_VUS="${MAX_VUS:-2000}"
export VU_STEPS="${VU_STEPS:-50,100,200,500,1000}"
export STAGE_RAMP_DURATION="${STAGE_RAMP_DURATION:-2m}"
export STAGE_HOLD_DURATION="${STAGE_HOLD_DURATION:-3m}"
export RAMP_DOWN_DURATION="${RAMP_DOWN_DURATION:-5m}"

if [[ -z "${JWT_SECRET_B64}" ]]; then
  echo "ERROR: JWT_SECRET or JWT_SECRET_B64 must be set in .env or load-tests/.env.loadtest" >&2
  exit 1
fi

SCENARIO="${1:-scenarios/smoke.js}"
shift || true

if [[ "${SCENARIO}" != /* ]]; then
  SCENARIO="${LOADTEST_DIR}/${SCENARIO}"
fi

mkdir -p "${LOADTEST_DIR}/results"

echo "▶ k6 ${SCENARIO}"
echo "  BASE_URL=${BASE_URL}"
echo "  ELECTION_ID=${ELECTION_ID}"
echo "  MAX_VUS=${MAX_VUS}"
echo "  VU_STEPS=${VU_STEPS} (+ ${MAX_VUS} peak)"
echo "  STAGE_RAMP=${STAGE_RAMP_DURATION}  STAGE_HOLD=${STAGE_HOLD_DURATION}  RAMP_DOWN=${RAMP_DOWN_DURATION}"
echo "  CANDIDATES=${CANDIDATES}"
echo "  JWT_SECRET_B64=*** (${#JWT_SECRET_B64} chars)"

exec k6 run "${SCENARIO}" \
  -e "BASE_URL=${BASE_URL}" \
  -e "JWT_SECRET_B64=${JWT_SECRET_B64}" \
  -e "ELECTION_ID=${ELECTION_ID}" \
  -e "TEST_EMAIL_PREFIX=${TEST_EMAIL_PREFIX}" \
  -e "TEST_EMAIL_DOMAIN=${TEST_EMAIL_DOMAIN}" \
  -e "CANDIDATES=${CANDIDATES}" \
  -e "MAX_VUS=${MAX_VUS}" \
  -e "VU_STEPS=${VU_STEPS}" \
  -e "STAGE_RAMP_DURATION=${STAGE_RAMP_DURATION}" \
  -e "STAGE_HOLD_DURATION=${STAGE_HOLD_DURATION}" \
  -e "RAMP_DOWN_DURATION=${RAMP_DOWN_DURATION}" \
  "$@"
