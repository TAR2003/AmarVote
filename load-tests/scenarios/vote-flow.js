/**
 * Full vote path ramp to 2000 VUs — election 10.
 * Run: ./load-tests/run.sh scenarios/vote-flow.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { generateJWT, authHeaders, padBallotPayload } from '../helpers.js';
import { env, voterEmail, pickCandidate } from '../env.js';

export const options = {
  scenarios: {
    vote_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '10m', target: env.maxVus },
        { duration: '5m', target: 0 },
      ],
      gracefulRampDown: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    'http_req_duration{name:create-encrypted-ballot}': ['p(95)<120000'],
    checks: ['rate>0.80'],
  },
  http: { timeout: '180s' },
};

export default function () {
  const jwt = generateJWT(env.jwtSecretB64, voterEmail(__VU));
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(__VU, __ITER);

  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  if (!check(eligRes, { eligible: (r) => r.status === 200 && r.json('eligible') === true })) {
    sleep(2);
    return;
  }

  const ballotBody = padBallotPayload({
    electionId: env.electionId,
    selectedCandidates: [candidate],
    botDetection: {
      isBot: false,
      requestId: `k6-${__VU}-${__ITER}`,
      timestamp: new Date().toISOString(),
    },
  });

  const encryptRes = http.post(`${env.baseUrl}/api/create-encrypted-ballot`, ballotBody, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/octet-stream',
      Accept: 'application/json',
    },
    tags: { name: 'create-encrypted-ballot' },
  });
  if (!check(encryptRes, { 'encrypt 200': (r) => r.status === 200 })) {
    sleep(3);
    return;
  }

  const body = encryptRes.json();
  check(
    http.post(
      `${env.baseUrl}/api/cast-encrypted-ballot`,
      JSON.stringify({
        electionId: env.electionId,
        encrypted_ballot: body.encrypted_ballot,
        ballot_hash: body.ballot_hash,
        ballot_tracking_code: body.ballot_tracking_code,
      }),
      { headers, tags: { name: 'cast-encrypted-ballot' } },
    ),
    { 'cast success': (r) => r.status === 200 && r.json('success') === true },
  );

  sleep(3 + Math.random() * 5);
}
