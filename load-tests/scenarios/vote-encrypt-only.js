/**
 * Encrypt-only load test — stress POST /api/create-encrypted-ballot.
 *
 * Models real behaviour: a voter may create encrypted ballots repeatedly before casting.
 * Each VU keeps one email and loops encrypt only (no cast).
 *
 * Run: ./load-tests/run.sh scenarios/vote-encrypt-only.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { generateJWT, padBallotPayload, authHeaders, recordApiResult } from '../helpers.js';
import { env, voterEmail, pickCandidate } from '../env.js';
import { buildLoadTestOptions } from '../options.js';
import { createSingleStepSummary, createStepSummary } from '../summary.js';

const encryptDuration = new Trend('vote_encrypt_duration', true);
const encryptErrors = new Rate('vote_encrypt_errors');
const ineligible = new Counter('vote_ineligible_skips');

export const options = buildLoadTestOptions(env.maxVus, {
  gracefulRampDown: '30s',
  http: { timeout: '180s' },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    vote_encrypt_errors: ['rate<0.15'],
    vote_encrypt_duration: ['p(95)<120000', 'p(99)<180000'],
    checks: ['rate>0.80'],
  },
});

export default function () {
  const email = voterEmail(__VU);
  const jwt = generateJWT(env.jwtSecretB64, email);
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(__VU, __ITER);

  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(eligRes, 'eligibility');

  if (eligRes.status !== 200 || eligRes.json('eligible') !== true) {
    ineligible.add(1);
    sleep(1 + Math.random() * 2);
    return;
  }

  const ballotBody = padBallotPayload({
    electionId: env.electionId,
    selectedCandidates: [candidate],
    botDetection: {
      isBot: false,
      requestId: `k6-encrypt-vu${__VU}-iter${__ITER}`,
      timestamp: new Date().toISOString(),
    },
  });

  const encryptRes = http.post(
    `${env.baseUrl}/api/create-encrypted-ballot`,
    ballotBody,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/octet-stream',
        Accept: 'application/json',
      },
      tags: { name: 'create-encrypted-ballot' },
    },
  );

  recordApiResult(encryptRes, 'create-encrypted-ballot');
  encryptDuration.add(encryptRes.timings.duration);
  encryptErrors.add(encryptRes.status !== 200);

  check(encryptRes, {
    'encrypt status 200': (r) => r.status === 200,
    'encrypt has ballot': (r) => r.status === 200 && r.json('encrypted_ballot') !== undefined,
  });

  sleep(2 + Math.random() * 4);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary('vote-encrypt-only')(data);
  return createStepSummary('vote-encrypt-only')(data);
}
