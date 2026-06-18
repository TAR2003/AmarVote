/**
 * Full vote path — stepped ramp (50 → 100 → … → MAX_VUS) — election 10.
 * Each iteration uses a unique email (one cast per email per election).
 * Candidates loaded from GET /api/election/:id (same as browser).
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
import { env, voterEmailForCast } from '../env.js';
import { electionSetup, pickCandidate } from '../election-setup.js';
import { recordApiResult, recordEncryptOutcome } from '../metrics.js';
import { buildLoadTestOptions } from '../options.js';
import { createSingleStepSummary, createStepSummary } from '../summary.js';

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
  const candidates = data.candidates;
  const email = voterEmailForCast(__VU, __ITER);
  const jwt = generateJWT(env.jwtSecretB64, email);
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(candidates, __VU, __ITER);

  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(eligRes, 'eligibility');
  if (!check(eligRes, { eligible: (r) => r.status === 200 && r.json('eligible') === true })) {
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
  if (!check(encryptRes, { 'encrypt 200': (r) => r.status === 200 })) {
    sleep(3);
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
  check(castRes, { 'cast success': (r) => r.status === 200 && r.json('success') === true });

  sleep(3 + Math.random() * 5);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary('vote-flow')(data);
  return createStepSummary('vote-flow')(data);
}
