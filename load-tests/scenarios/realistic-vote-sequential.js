/**
 * Realistic user journey — fixed session count (sequential-style benchmark).
 *
 * Same behaviour as realistic-vote.js but runs exactly SEQ_TOTAL_VOTES user sessions
 * with SEQ_CONCURRENT_VUS parallel workers.
 *
 * Run: ./load-tests/run.sh scenarios/realistic-vote-sequential.js
 */
import exec from 'k6/execution';
import { sleep } from 'k6';
import { env } from '../env.js';
import { electionSetup } from '../election-setup.js';
import { createRealisticSequentialSummary } from '../realistic-report.js';
import { runRealisticUserSession } from '../realistic-journey.js';
import { realisticConfig } from '../realistic-config.js';

const TEST_NAME = 'realistic-vote-sequential';

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const concurrentVus = parsePositiveInt(__ENV.SEQ_CONCURRENT_VUS, 1);
const totalSessions = parsePositiveInt(__ENV.SEQ_TOTAL_VOTES ?? __ENV.SEQ_TOTAL_SESSIONS, 100);
const pauseMs = Math.max(0, Number(__ENV.SEQ_PAUSE_MS || '0'));

export const options = {
  scenarios: {
    realistic_sessions: {
      executor: 'shared-iterations',
      vus: concurrentVus,
      iterations: totalSessions,
      maxDuration: __ENV.SEQ_MAX_DURATION || '24h',
    },
  },
  http: { timeout: '180s' },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    checks: ['rate>0.85'],
  },
};

export function setup() {
  const data = electionSetup();
  const cfg = realisticConfig();
  console.log(
    `setup: ${totalSessions} realistic sessions, ${concurrentVus} VUs — ` +
      `browse ${cfg.browseOnlyPct}%, eligibility-only ${cfg.eligibilityOnlyPct}%, vote ${cfg.votePct}%`,
  );
  return data;
}

function currentSessionNumber() {
  return exec.scenario.iterationInTest + 1;
}

export default function (data) {
  runRealisticUserSession(data, { iteration: currentSessionNumber() });
  if (pauseMs > 0) sleep(pauseMs / 1000);
  else sleep(0.5 + Math.random() * 2);
}

export function handleSummary(data) {
  return createRealisticSequentialSummary(TEST_NAME, concurrentVus, totalSessions)(data);
}
