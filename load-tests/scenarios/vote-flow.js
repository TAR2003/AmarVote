/**
 * Full vote path — stepped ramp (50 → 100 → … → MAX_VUS).
 * Same voter lifecycle as vote-encrypt-2000.js (encrypt many times, cast once).
 *
 * Run: ./load-tests/run.sh scenarios/vote-flow.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  generateJWT,
  authHeaders,
  padBallotPayload,
  postEncryptBallot,
} from '../helpers.js';
import { env, voterEmailForStep } from '../env.js';
import { electionSetup, pickCandidate } from '../election-setup.js';
import { recordApiResult, recordEncryptOutcome } from '../metrics.js';
import {
  encryptWarmupIters,
  isAlreadyVotedApi,
  parseEligibility,
  voterHasAlreadyCast,
} from '../vote-lifecycle.js';
import { buildLoadTestOptions } from '../options.js';
import { createSingleStepSummary, createStepSummary } from '../summary.js';

let hasCast = false;

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
  if (hasCast) {
    sleep(2 + Math.random() * 3);
    return;
  }

  const candidates = data.candidates;
  const email = voterEmailForStep(__VU);
  const jwt = generateJWT(env.jwtSecretB64, email);
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(candidates, __VU, __ITER);
  const warmup = encryptWarmupIters();

  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(eligRes, 'eligibility');

  const eligBody = parseEligibility(eligRes);
  if (eligRes.status !== 200 || eligBody.eligible !== true) {
    if (voterHasAlreadyCast(eligBody)) hasCast = true;
    sleep(2);
    return;
  }

  const ballotBody = padBallotPayload({
    electionId: env.electionId,
    selectedCandidates: [candidate],
    botDetection: {
      isBot: false,
      requestId: `k6-cast-vu${__VU}-iter${__ITER}`,
      timestamp: new Date().toISOString(),
    },
  });

  const encryptRes = postEncryptBallot(env.baseUrl, jwt, ballotBody);
  recordEncryptOutcome(encryptRes);
  if (isAlreadyVotedApi(encryptRes)) {
    hasCast = true;
    sleep(2);
    return;
  }
  if (!check(encryptRes, { 'encrypt 200': (r) => r.status === 200 })) {
    sleep(3);
    return;
  }

  if (__ITER < warmup) {
    sleep(3 + Math.random() * 5);
    return;
  }

  const body = encryptRes.json();
  const castRes = http.post(
    `${env.baseUrl}/api/cast-encrypted-ballot`,
    JSON.stringify({
      electionId: env.electionId,
      encrypted_ballot: body.encrypted_ballot,
      ballot_hash: body.ballot_hash,
      ballot_tracking_code: body.ballot_tracking_code,
    }),
    { headers, tags: { name: 'cast-encrypted-ballot' } },
  );
  recordApiResult(castRes, 'cast-encrypted-ballot');

  const castOk = castRes.status === 200 && castRes.json('success') === true;
  if (castOk || isAlreadyVotedApi(castRes)) hasCast = true;

  check(castRes, { 'cast success': (r) => r.status === 200 && r.json('success') === true });

  sleep(3 + Math.random() * 5);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary('vote-flow')(data);
  return createStepSummary('vote-flow')(data);
}
