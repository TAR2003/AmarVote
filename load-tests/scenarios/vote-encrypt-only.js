/**
 * Encrypt-only load test — stress POST /api/create-encrypted-ballot.
 *
 * Uses live candidate names from GET /api/election/:id (same as the browser).
 * Retries transient 502/503/429; does not retry HTTP 400 validation errors.
 *
 * Run: ./load-tests/run.sh scenarios/vote-encrypt-only.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  generateJWT,
  padBallotPayload,
  authHeaders,
  postEncryptBallot,
  parseApiError,
} from '../helpers.js';
import { env, voterEmail } from '../env.js';
import { electionSetup, pickCandidate } from '../election-setup.js';
import { recordApiResult, recordEncryptOutcome } from '../metrics.js';
import { buildLoadTestOptions } from '../options.js';
import { createSingleStepSummary, createStepSummary } from '../summary.js';

const encryptDuration = new Trend('vote_encrypt_duration', true);
const encryptErrors = new Rate('vote_encrypt_errors');
const ineligible = new Counter('vote_ineligible_skips');
const encryptInvalidCandidate = new Counter('encrypt_invalid_candidate');

export const options = buildLoadTestOptions(env.maxVus, {
  gracefulRampDown: '30s',
  http: { timeout: '180s' },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    vote_encrypt_errors: ['rate<0.10'],
    encrypt_business_reject: ['count<50'],
    vote_encrypt_duration: ['p(95)<120000', 'p(99)<180000'],
    checks: ['rate>0.90'],
  },
});

export function setup() {
  return electionSetup();
}

export default function (data) {
  const candidates = data.candidates;
  const email = voterEmail(__VU);
  const jwt = generateJWT(env.jwtSecretB64, email);
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(candidates, __VU, __ITER);

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

  const encryptRes = postEncryptBallot(env.baseUrl, jwt, ballotBody);

  recordEncryptOutcome(encryptRes);
  encryptDuration.add(encryptRes.timings.duration);
  encryptErrors.add(encryptRes.status !== 200);

  if (encryptRes.status === 400) {
    const reason = parseApiError(encryptRes);
    if (reason.toLowerCase().includes('invalid candidate')) {
      encryptInvalidCandidate.add(1);
      console.warn(`VU${__VU} iter${__ITER}: invalid candidate "${candidate}" — ${reason}`);
    }
  }

  check(encryptRes, {
    'encrypt status 200': (r) => r.status === 200,
    'encrypt has ballot': (r) => r.status === 200 && r.json('encrypted_ballot') !== undefined,
  });

  // Browser-like pacing between encrypt attempts (not a tight hammer loop).
  sleep(5 + Math.random() * 10);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary('vote-encrypt-only')(data);
  return createStepSummary('vote-encrypt-only')(data);
}
