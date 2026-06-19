#!/usr/bin/env bash
# Run k6 load tests with secrets from .env files (never committed).
#
# Usage:
#   ./load-tests/run.sh scenarios/smoke.js
#   ./load-tests/run.sh scenarios/nginx-limit-check.js
#   ./load-tests/run.sh scenarios/browse.js          # stepped: 50→100→… with report after each
#   ./load-tests/run.sh scenarios/vote-encrypt-only.js   # encrypt only (repeat per voter)
#   ./load-tests/run.sh scenarios/vote-encrypt-2000.js   # encrypt + cast (one vote per email)
#   ./load-tests/run.sh scenarios/vote-encrypt-sequential.js  # fixed votes (SEQ_* in .env.loadtest)
#   SINGLE_RUN=1 ./load-tests/run.sh scenarios/browse.js   # one long k6 run (all steps)
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
export JWT_EXPIRATION_MS="${JWT_EXPIRATION_MS:-3600000}"
export BASE_URL="${BASE_URL:-https://amarvote2026.me}"
export ELECTION_ID="${ELECTION_ID:-10}"
export TEST_EMAIL_PREFIX="${TEST_EMAIL_PREFIX:-loadtest-voter}"
export TEST_EMAIL_DOMAIN="${TEST_EMAIL_DOMAIN:-example.com}"
export MAX_VUS="${MAX_VUS:-2000}"
export VU_STEPS="${VU_STEPS:-50,100,200,500,1000}"
export STAGE_RAMP_DURATION="${STAGE_RAMP_DURATION:-2m}"
export STAGE_HOLD_DURATION="${STAGE_HOLD_DURATION:-3m}"
export RAMP_DOWN_DURATION="${RAMP_DOWN_DURATION:-5m}"
export SEQ_CONCURRENT_VUS="${SEQ_CONCURRENT_VUS:-1}"
export SEQ_TOTAL_VOTES="${SEQ_TOTAL_VOTES:-${SEQ_VOTE_COUNT:-50}}"
export SEQ_PAUSE_MS="${SEQ_PAUSE_MS:-0}"

if [[ -z "${JWT_SECRET_B64}" ]]; then
  echo "ERROR: JWT_SECRET or JWT_SECRET_B64 must be set in .env or load-tests/.env.loadtest" >&2
  echo "Get the production value: ssh <user>@amarvote2026.me \"grep ^JWT_SECRET= ~/.env\"" >&2
  exit 1
fi

if [[ "${SKIP_JWT_VERIFY:-}" != "1" ]]; then
  "${LOADTEST_DIR}/verify-auth.sh"
fi

SCENARIO="${1:-scenarios/smoke.js}"
shift || true

if [[ "${SCENARIO}" != /* ]]; then
  SCENARIO_REL="${SCENARIO}"
  SCENARIO="${LOADTEST_DIR}/${SCENARIO}"
else
  SCENARIO_REL="${SCENARIO#"${LOADTEST_DIR}/"}"
fi

if [[ "${SKIP_NGINX_CHECK:-}" != "1" && "${SCENARIO_REL}" != "scenarios/nginx-limit-check.js" ]]; then
  "${LOADTEST_DIR}/check-nginx-limits.sh"
fi

VOTE_SCENARIOS="scenarios/vote-flow.js scenarios/vote-encrypt-only.js scenarios/vote-encrypt-2000.js scenarios/vote-encrypt-sequential.js scenarios/mixed-2000.js"
NEEDS_ELECTION=0
for s in ${VOTE_SCENARIOS}; do
  if [[ "${SCENARIO_REL}" == "${s}" ]]; then NEEDS_ELECTION=1; break; fi
done
if [[ "${NEEDS_ELECTION}" -eq 1 && "${SKIP_ELECTION_VERIFY:-}" != "1" ]]; then
  "${LOADTEST_DIR}/verify-election.sh"
fi

mkdir -p "${LOADTEST_DIR}/results"

STEPPED_SCENARIOS="scenarios/browse.js scenarios/vote-flow.js scenarios/vote-encrypt-only.js scenarios/vote-encrypt-2000.js scenarios/mixed-2000.js"
IS_STEPPED=0
for s in ${STEPPED_SCENARIOS}; do
  if [[ "${SCENARIO_REL}" == "${s}" ]]; then IS_STEPPED=1; break; fi
done

if [[ "${IS_STEPPED}" -eq 1 && "${SINGLE_RUN:-}" != "1" ]]; then
  exec "${LOADTEST_DIR}/run-stepped.sh" "${SCENARIO_REL}" "$@"
fi

echo "▶ k6 ${SCENARIO}"
echo "  BASE_URL=${BASE_URL}"
echo "  ELECTION_ID=${ELECTION_ID}"
echo "  MAX_VUS=${MAX_VUS}"
echo "  VU_STEPS=${VU_STEPS} (+ ${MAX_VUS} peak)"
echo "  STAGE_RAMP=${STAGE_RAMP_DURATION}  STAGE_HOLD=${STAGE_HOLD_DURATION}  RAMP_DOWN=${RAMP_DOWN_DURATION}"
echo "  JWT_SECRET_B64=*** (${#JWT_SECRET_B64} chars)"
echo "  Candidates → fetched from GET /api/election/${ELECTION_ID} at runtime"
echo "  Reports → load-tests/results/*-step-*-report.txt (stepped) or *-report.txt"
if [[ "${SCENARIO_REL}" == "scenarios/vote-encrypt-sequential.js" ]]; then
  echo "  SEQ_CONCURRENT_VUS=${SEQ_CONCURRENT_VUS}  SEQ_TOTAL_VOTES=${SEQ_TOTAL_VOTES}"
fi

exec k6 run "${SCENARIO}" \
  -e "BASE_URL=${BASE_URL}" \
  -e "JWT_SECRET_B64=${JWT_SECRET_B64}" \
  -e "JWT_EXPIRATION_MS=${JWT_EXPIRATION_MS}" \
  -e "ELECTION_ID=${ELECTION_ID}" \
  -e "TEST_EMAIL_PREFIX=${TEST_EMAIL_PREFIX}" \
  -e "TEST_EMAIL_DOMAIN=${TEST_EMAIL_DOMAIN}" \
  -e "MAX_VUS=${MAX_VUS}" \
  -e "VU_STEPS=${VU_STEPS}" \
  -e "STAGE_RAMP_DURATION=${STAGE_RAMP_DURATION}" \
  -e "STAGE_HOLD_DURATION=${STAGE_HOLD_DURATION}" \
  -e "RAMP_DOWN_DURATION=${RAMP_DOWN_DURATION}" \
  -e "SEQ_CONCURRENT_VUS=${SEQ_CONCURRENT_VUS}" \
  -e "SEQ_TOTAL_VOTES=${SEQ_TOTAL_VOTES}" \
  -e "SEQ_PAUSE_MS=${SEQ_PAUSE_MS}" \
  -e "LOG_FAILURES=${LOG_FAILURES:-1}" \
  "$@"
