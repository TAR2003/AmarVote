/**
 * Read-heavy flow — stepped ramp (50 → 100 → … → MAX_VUS) browsing election 10.
 *
 * Run (recommended — report after each step):
 *   ./load-tests/run.sh scenarios/browse.js
 *
 * Reports: load-tests/results/browse-step-50-report.txt, …, browse-combined-report.txt
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { generateJWT, authHeaders, recordApiResult } from '../helpers.js';
import { env, voterEmail } from '../env.js';
import { buildLoadTestOptions } from '../options.js';
import { createSingleStepSummary, createStepSummary } from '../summary.js';

export const options = buildLoadTestOptions(env.maxVus, {
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{name:all-elections}': ['p(95)<3000'],
    'http_req_duration{name:election-detail}': ['p(95)<4000'],
  },
});

export default function () {
  const jwt = generateJWT(env.jwtSecretB64, voterEmail(__VU));
  const headers = authHeaders(jwt);

  const sessionRes = http.get(`${env.baseUrl}/api/auth/session`, { headers, tags: { name: 'session' } });
  recordApiResult(sessionRes, 'session');
  check(sessionRes, { 'session 200': (r) => r.status === 200 });

  const electionsRes = http.get(`${env.baseUrl}/api/all-elections`, { headers, tags: { name: 'all-elections' } });
  recordApiResult(electionsRes, 'all-elections');
  check(electionsRes, { 'all-elections 200': (r) => r.status === 200 });

  const detailRes = http.get(`${env.baseUrl}/api/election/${env.electionId}`, { headers, tags: { name: 'election-detail' } });
  recordApiResult(detailRes, 'election-detail');
  check(detailRes, { 'election detail 200': (r) => r.status === 200 });

  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(eligRes, 'eligibility');
  check(eligRes, { 'eligibility 200': (r) => r.status === 200 });

  sleep(1 + Math.random() * 3);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary('browse')(data);
  return createStepSummary('browse')(data);
}
