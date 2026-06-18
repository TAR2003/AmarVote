/**
 * Full vote path — stepped ramp (50 → 100 → … → MAX_VUS).
 * Sequential global emails via vote-cycle.js (see email-allocator.js).
 *
 * Run: ./load-tests/run.sh scenarios/vote-flow.js
 */
import { sleep } from 'k6';
import { env } from '../env.js';
import { electionSetup } from '../election-setup.js';
import { buildLoadTestOptions } from '../options.js';
import { createSingleStepSummary, createStepSummary } from '../summary.js';
import { runVoteCycleIteration } from '../vote-cycle.js';

export const options = buildLoadTestOptions(env.maxVus, {
  gracefulRampDown: '30s',
  http: { timeout: '180s' },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    'http_req_duration{name:create-encrypted-ballot}': ['p(95)<120000'],
    checks: ['rate>0.90'],
  },
});

export function setup() {
  return electionSetup();
}

export default function (data) {
  const outcome = runVoteCycleIteration(data);

  if (outcome === 'warmup') {
    sleep(3 + Math.random() * 5);
    return;
  }

  sleep(2 + Math.random() * 4);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary('vote-flow')(data);
  return createStepSummary('vote-flow')(data);
}
