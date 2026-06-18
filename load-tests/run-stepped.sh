#!/usr/bin/env bash
# Run a stepped load test one VU level at a time.
# After each step (50, 100, 200, …) prints a full report, then starts the next.
#
# Usage:
#   ./load-tests/run-stepped.sh scenarios/browse.js
#   STOP_ON_STEP_FAIL=1 ./load-tests/run-stepped.sh scenarios/vote-flow.js

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOADTEST_DIR="${ROOT_DIR}/load-tests"

set -a
[[ -f "${ROOT_DIR}/.env" ]] && source "${ROOT_DIR}/.env"
[[ -f "${LOADTEST_DIR}/.env.loadtest" ]] && source "${LOADTEST_DIR}/.env.loadtest"
set +a

export JWT_SECRET_B64="${JWT_SECRET_B64:-${JWT_SECRET:-}}"
export JWT_EXPIRATION_MS="${JWT_EXPIRATION_MS:-3600000}"
export BASE_URL="${BASE_URL:-https://amarvote2026.me}"
export ELECTION_ID="${ELECTION_ID:-10}"
export TEST_EMAIL_PREFIX="${TEST_EMAIL_PREFIX:-loadtest-voter}"
export TEST_EMAIL_DOMAIN="${TEST_EMAIL_DOMAIN:-example.com}"
export CANDIDATES="${CANDIDATES:-A big name|nobo tobo|masnoon muztahid}"
export MAX_VUS="${MAX_VUS:-2000}"
export VU_STEPS="${VU_STEPS:-50,100,200,500,1000}"
export STAGE_RAMP_DURATION="${STAGE_RAMP_DURATION:-2m}"
export STAGE_HOLD_DURATION="${STAGE_HOLD_DURATION:-3m}"

SCENARIO_REL="${1:-scenarios/browse.js}"
shift || true

if [[ "${SCENARIO_REL}" == /* ]]; then
  SCENARIO="${SCENARIO_REL}"
  SCENARIO_REL="${SCENARIO#"${LOADTEST_DIR}/"}"
else
  SCENARIO="${LOADTEST_DIR}/${SCENARIO_REL}"
fi

TEST_NAME="$(basename "${SCENARIO_REL}" .js)"
mkdir -p "${LOADTEST_DIR}/results"

if [[ -z "${JWT_SECRET_B64}" ]]; then
  echo "ERROR: JWT_SECRET must be set" >&2
  exit 1
fi

if [[ "${SKIP_JWT_VERIFY:-}" != "1" ]]; then
  "${LOADTEST_DIR}/verify-auth.sh"
fi

if [[ "${SKIP_NGINX_CHECK:-}" != "1" ]]; then
  "${LOADTEST_DIR}/check-nginx-limits.sh"
fi

# Resolve step list (same logic as stages.js)
mapfile -t STEPS < <(node -e "
  const max = Number(process.env.MAX_VUS || 2000);
  const raw = process.env.VU_STEPS || '50,100,200,500,1000';
  let steps = raw.split(',').map(s => Number(s.trim())).filter(n => n > 0);
  steps = [...new Set(steps.filter(n => n <= max))].sort((a,b) => a-b);
  if (!steps.length || steps[steps.length-1] < max) steps.push(max);
  steps.forEach(s => console.log(s));
")

COMBINED_JSON="${LOADTEST_DIR}/results/${TEST_NAME}-combined-report.json"
COMBINED_TXT="${LOADTEST_DIR}/results/${TEST_NAME}-combined-report.txt"
STEP_SUMMARIES="[]"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  STEPPED LOAD TEST — ${TEST_NAME}"
echo "  Steps: ${STEPS[*]}  (ramp ${STAGE_RAMP_DURATION} + hold ${STAGE_HOLD_DURATION} each)"
echo "  Live stats: overall + per-API ok/fail every ~3s (LIVE_REPORT=0 to disable)"
echo "  Step report prints immediately when each step finishes."
echo "══════════════════════════════════════════════════════════════"
echo ""

K6_COMMON=(
  -e "BASE_URL=${BASE_URL}"
  -e "JWT_SECRET_B64=${JWT_SECRET_B64}"
  -e "JWT_EXPIRATION_MS=${JWT_EXPIRATION_MS}"
  -e "ELECTION_ID=${ELECTION_ID}"
  -e "TEST_EMAIL_PREFIX=${TEST_EMAIL_PREFIX}"
  -e "TEST_EMAIL_DOMAIN=${TEST_EMAIL_DOMAIN}"
  -e "CANDIDATES=${CANDIDATES}"
  -e "MAX_VUS=${MAX_VUS}"
  -e "VU_STEPS=${VU_STEPS}"
  -e "STAGE_RAMP_DURATION=${STAGE_RAMP_DURATION}"
  -e "STAGE_HOLD_DURATION=${STAGE_HOLD_DURATION}"
)

for VUS in "${STEPS[@]}"; do
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  printf "║  ▶ STARTING STEP: %s VIRTUAL USERS%-27s║\n" "${VUS}" ""
  echo "║    (watch live metrics below — report follows when done)   ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  LIVE_CSV="${LOADTEST_DIR}/results/.live-${TEST_NAME}-${VUS}.csv"
  rm -f "${LIVE_CSV}"

  REPORTER_PID=""
  if [[ "${LIVE_REPORT:-1}" == "1" ]]; then
    node "${LOADTEST_DIR}/live-reporter.mjs" --vus "${VUS}" --csv "${LIVE_CSV}" &
    REPORTER_PID=$!
  fi

  export STEP_VUS="${VUS}"
  K6_EXIT=0
  K6_OUT=( )
  if [[ "${LIVE_REPORT:-1}" == "1" ]]; then
    K6_OUT=(--out "csv=${LIVE_CSV}")
  fi

  k6 run "${SCENARIO}" \
    "${K6_COMMON[@]}" \
    -e "STEP_VUS=${VUS}" \
    "${K6_OUT[@]}" \
    "$@" || K6_EXIT=$?

  if [[ -n "${REPORTER_PID}" ]]; then
    kill "${REPORTER_PID}" 2>/dev/null || true
    wait "${REPORTER_PID}" 2>/dev/null || true
  fi

  REPORT_JSON="${LOADTEST_DIR}/results/${TEST_NAME}-step-${VUS}-report.json"
  REPORT_TXT="${LOADTEST_DIR}/results/${TEST_NAME}-step-${VUS}-report.txt"

  if [[ -f "${REPORT_TXT}" ]]; then
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo "  STEP ${VUS} FINAL REPORT"
    echo "══════════════════════════════════════════════════════════════"
    cat "${REPORT_TXT}"
    echo "── Saved: ${REPORT_TXT}"
  fi

  if [[ -f "${REPORT_JSON}" ]]; then
    STEP_SUMMARIES="$(node -e "
      const fs = require('fs');
      const arr = JSON.parse(process.argv[1]);
      arr.push(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
      console.log(JSON.stringify(arr));
    " "${STEP_SUMMARIES}" "${REPORT_JSON}")"

    FAIL_RATE="$(node -e "const r=JSON.parse(require('fs').readFileSync('${REPORT_JSON}','utf8')); console.log(r.http_fail_rate_pct)")"
    if [[ "${STOP_ON_STEP_FAIL:-}" == "1" ]]; then
      STOP_NOW="$(node -e "process.stdout.write(Number('${FAIL_RATE}') >= 5 ? 'yes' : 'no')")"
      if [[ "${STOP_NOW}" == "yes" ]]; then
        echo ""
        echo "⛔ STOP_ON_STEP_FAIL=1 — halting before next step (${VUS} VUs had ≥5% failures)."
        break
      fi
    fi
  fi

  if [[ "${K6_EXIT}" -ne 0 ]]; then
    echo "WARN: k6 exited ${K6_EXIT} for step ${VUS}" >&2
  fi

  echo ""
  echo "── Step ${VUS} complete. Next step starting in 5s… (Ctrl+C to stop)"
  sleep 5
done

# Write combined report
node -e "
const fs = require('fs');
const steps = JSON.parse(process.argv[1]);
const test = process.argv[2];
const out = { generated_at: new Date().toISOString(), test, steps };
const lines = ['', '═'.repeat(62), '  COMBINED REPORT — ' + test, '═'.repeat(62)];
for (const s of steps) {
  const st = s.http_fail_rate_pct < 5 ? 'PASS' : 'FAIL';
  lines.push('  ' + s.vus + ' VUs [' + st + ']: ' + s.http_requests_ok + ' ok / ' + s.http_requests_failed + ' failed (' + s.http_fail_rate_pct + '%)');
  if (s.apis && s.apis.length) {
    for (const a of s.apis) {
      lines.push('      ' + a.api + ': ' + a.http_requests_ok + ' ok / ' + a.http_requests_failed + ' failed');
    }
  }
}
lines.push('═'.repeat(62), '');
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 2));
fs.writeFileSync(process.argv[4], lines.join('\n'));
console.log(lines.join('\n'));
" "${STEP_SUMMARIES}" "${TEST_NAME}" "${COMBINED_JSON}" "${COMBINED_TXT}"

echo ""
echo "Combined reports:"
echo "  ${COMBINED_TXT}"
echo "  ${COMBINED_JSON}"
