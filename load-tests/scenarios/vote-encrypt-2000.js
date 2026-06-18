/**
 * Full encrypted vote path — encrypt + cast (stepped ramp to MAX_VUS).
 *
 * Voter model (matches production):
 *   - One email per VU (e.g. a1@…) for the whole step
 *   - a1 may call create-encrypted-ballot many times before casting
 *   - a1 casts at most once; after that no more encrypt or cast
 *
 * Candidates: fetched once from GET /api/election/:id in setup().
 *
 * Run: ./load-tests/run.sh scenarios/vote-encrypt-2000.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  generateJWT,
  padBallotPayload,
  authHeaders,
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

const encryptDuration = new Trend('vote_encrypt_duration', true);
const castDuration = new Trend('vote_cast_duration', true);
const encryptErrors = new Rate('vote_encrypt_errors');
const castErrors = new Rate('vote_cast_errors');
const ineligible = new Counter('vote_ineligible_skips');
const alreadyVoted = new Counter('vote_already_voted');
const postVoteIdle = new Counter('vote_post_cast_idle');

/** Per-VU: set true after successful cast (init context — one copy per VU). */
let hasCast = false;

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
  if (hasCast) {
    postVoteIdle.add(1);
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
    if (voterHasAlreadyCast(eligBody)) {
      hasCast = true;
      alreadyVoted.add(1);
    } else {
      ineligible.add(1);
    }
    sleep(1 + Math.random() * 2);
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
  encryptDuration.add(encryptRes.timings.duration);
  encryptErrors.add(encryptRes.status !== 200);

  if (isAlreadyVotedApi(encryptRes)) {
    hasCast = true;
    alreadyVoted.add(1);
    sleep(2);
    return;
  }

  if (!check(encryptRes, {
    'encrypt status 200': (r) => r.status === 200,
    'encrypt has ballot': (r) => r.status === 200 && r.json('encrypted_ballot') !== undefined,
  })) {
    sleep(2);
    return;
  }

  // Encrypt-only warmup iterations (browser: preview ballot before submitting).
  if (__ITER < warmup) {
    sleep(3 + Math.random() * 5);
    return;
  }

  const ballot = encryptRes.json();
  const castRes = http.post(
    `${env.baseUrl}/api/cast-encrypted-ballot`,
    JSON.stringify({
      electionId: env.electionId,
      encrypted_ballot: ballot.encrypted_ballot,
      ballot_hash: ballot.ballot_hash,
      ballot_tracking_code: ballot.ballot_tracking_code,
    }),
    { headers, tags: { name: 'cast-encrypted-ballot' } },
  );

  recordApiResult(castRes, 'cast-encrypted-ballot');
  castDuration.add(castRes.timings.duration);

  if (isAlreadyVotedApi(castRes)) {
    hasCast = true;
    alreadyVoted.add(1);
  }

  const castOk = castRes.status === 200 && castRes.json('success') === true;
  castErrors.add(!castOk);
  if (castOk) {
    hasCast = true;
  }

  check(castRes, {
    'cast status 200': (r) => r.status === 200,
    'cast success': (r) => r.status === 200 && r.json('success') === true,
  });

  sleep(3 + Math.random() * 5);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary('vote-encrypt-2000')(data);
  return createStepSummary('vote-encrypt-2000')(data);
}
