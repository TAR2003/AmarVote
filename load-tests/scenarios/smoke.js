/**
 * Smoke test — verify election 10 endpoints before scaling to 2000 VUs.
 * Run: ./load-tests/run.sh scenarios/smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { generateJWT, authHeaders, recordApiResult } from '../helpers.js';
import { env, voterEmail } from '../env.js';
import { createSimpleSummary } from '../summary.js';

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<5000'],
  },
};

export function setup() {
  const jwt = generateJWT(env.jwtSecretB64, voterEmail(1));
  const detail = http.get(`${env.baseUrl}/api/election/${env.electionId}`, {
    headers: authHeaders(jwt),
  });
  if (detail.status !== 200) {
    console.warn(
      `Election ${env.electionId} detail returned ${detail.status} — ` +
        'check JWT secret, REGISTRATION_OPEN_TO_ALL=true, and election eligibility=unlisted',
    );
  }
  return { jwt };
}

export default function (data) {
  const jwt = data.jwt || generateJWT(env.jwtSecretB64, voterEmail(__VU));

  const healthRes = http.get(`${env.baseUrl}/api/health`, { tags: { name: 'health' } });
  recordApiResult(healthRes, 'health');
  check(healthRes, { 'health ok': (r) => r.status === 200 });

  const sessionRes = http.get(`${env.baseUrl}/api/auth/session`, { headers: authHeaders(jwt), tags: { name: 'session' } });
  recordApiResult(sessionRes, 'session');
  check(sessionRes, { 'session ok': (r) => r.status === 200 });

  const electionsRes = http.get(`${env.baseUrl}/api/all-elections`, { headers: authHeaders(jwt), tags: { name: 'all-elections' } });
  recordApiResult(electionsRes, 'all-elections');
  check(electionsRes, { 'elections ok': (r) => r.status === 200 });

  const detailRes = http.get(`${env.baseUrl}/api/election/${env.electionId}`, { headers: authHeaders(jwt), tags: { name: 'election-detail' } });
  recordApiResult(detailRes, 'election-detail');
  check(detailRes, { 'election 10 ok': (r) => r.status === 200 });

  sleep(1);
}

export const handleSummary = createSimpleSummary('smoke');
