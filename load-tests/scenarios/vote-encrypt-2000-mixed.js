/**
 * Mixed browse + vote — stepped ramp to MAX_VUS (same profile as vote-encrypt-2000).
 *
 * Each iteration: browser APIs (session → elections → detail → eligibility)
 * then encrypt → cast vote cycle for the same voter email.
 *
 * Run: ./load-tests/run.sh scenarios/vote-encrypt-2000-mixed.js
 */
import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { generateJWT } from '../helpers.js';
import { env } from '../env.js';
import { emailForVoteCycle } from '../email-allocator.js';
import { runBrowseFlow } from '../browse-flow.js';
import { electionSetup } from '../election-setup.js';
import { buildLoadTestOptions } from '../options.js';
import { createSingleStepSummary, createStepSummary } from '../summary.js';
import { encryptWarmupIters } from '../vote-lifecycle.js';
import { runVoteCycleIteration } from '../vote-cycle.js';

const TEST_NAME = 'vote-encrypt-2000-mixed';

const encryptDuration = new Trend('vote_encrypt_duration', true);
const castDuration = new Trend('vote_cast_duration', true);
const encryptErrors = new Rate('vote_encrypt_errors');
const castErrors = new Rate('vote_cast_errors');
const ineligible = new Counter('vote_ineligible_skips');
const alreadyVoted = new Counter('vote_already_voted');

const metrics = {
  encryptDuration,
  castDuration,
  encryptErrors,
  castErrors,
  ineligible,
  alreadyVoted,
};

export const options = buildLoadTestOptions(env.maxVus, {
  gracefulRampDown: '30s',
  http: { timeout: '180s' },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    vote_encrypt_errors: ['rate<0.10'],
    vote_cast_errors: ['rate<0.10'],
    vote_encrypt_duration: ['p(95)<120000', 'p(99)<180000'],
    vote_cast_duration: ['p(95)<15000'],
    checks: ['rate>0.90'],
  },
});

export function setup() {
  return electionSetup();
}

export default function (data) {
  const warmup = encryptWarmupIters();
  const email = emailForVoteCycle(warmup);
  const jwt = generateJWT(env.jwtSecretB64, email);
  runBrowseFlow(jwt);

  const outcome = runVoteCycleIteration(data, metrics);

  if (outcome === 'warmup') {
    sleep(3 + Math.random() * 5);
    return;
  }

  sleep(2 + Math.random() * 4);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary(TEST_NAME)(data);
  return createStepSummary(TEST_NAME)(data);
}
