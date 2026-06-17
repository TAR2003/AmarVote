/**
 * Vote encryption stress test — 2000 concurrent users on election 10.
 * Exercises: eligibility → create-encrypted-ballot → cast-encrypted-ballot
 *
 * Run:
 *   ./load-tests/run.sh scenarios/vote-encrypt-2000.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { generateJWT, padBallotPayload, authHeaders } from '../helpers.js';
import { env, voterEmail, pickCandidate } from '../env.js';

const encryptDuration = new Trend('vote_encrypt_duration', true);
const castDuration = new Trend('vote_cast_duration', true);
const encryptErrors = new Rate('vote_encrypt_errors');
const castErrors = new Rate('vote_cast_errors');
const ineligible = new Counter('vote_ineligible_skips');

export const options = {
  scenarios: {
    vote_encrypt_peak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: Math.min(200, env.maxVus) },
        { duration: '5m', target: Math.min(500, env.maxVus) },
        { duration: '5m', target: Math.min(1000, env.maxVus) },
        { duration: '10m', target: env.maxVus },
        { duration: '10m', target: env.maxVus },
        { duration: '5m', target: 0 },
      ],
      gracefulRampDown: '3m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    vote_encrypt_errors: ['rate<0.15'],
    vote_cast_errors: ['rate<0.10'],
    vote_encrypt_duration: ['p(95)<120000', 'p(99)<180000'],
    vote_cast_duration: ['p(95)<15000'],
    checks: ['rate>0.80'],
  },
  http: { timeout: '180s' },
};

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
      requestId: `k6-vu${__VU}-iter${__ITER}`,
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

  encryptDuration.add(encryptRes.timings.duration);
  const encryptOk = encryptRes.status === 200;
  encryptErrors.add(!encryptOk);

  if (!check(encryptRes, {
    'encrypt status 200': (r) => r.status === 200,
    'encrypt has ballot': (r) => r.status === 200 && r.json('encrypted_ballot') !== undefined,
  })) {
    sleep(2);
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

  castDuration.add(castRes.timings.duration);
  const castOk = castRes.status === 200 && castRes.json('success') === true;
  castErrors.add(!castOk);

  check(castRes, {
    'cast status 200': (r) => r.status === 200,
    'cast success': (r) => r.status === 200 && r.json('success') === true,
  });

  sleep(2 + Math.random() * 4);
}
