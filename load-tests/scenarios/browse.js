/**
 * Read-heavy flow — ramp to 2000 VUs browsing election 10.
 * Run: ./load-tests/run.sh scenarios/browse.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { generateJWT, authHeaders } from '../helpers.js';
import { env, voterEmail } from '../env.js';

export const options = {
  stages: [
    { duration: '2m', target: 200 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 1000 },
    { duration: '5m', target: env.maxVus },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{name:all-elections}': ['p(95)<3000'],
    'http_req_duration{name:election-detail}': ['p(95)<4000'],
  },
};

export default function () {
  const jwt = generateJWT(env.jwtSecretB64, voterEmail(__VU));
  const headers = authHeaders(jwt);

  check(http.get(`${env.baseUrl}/api/auth/session`, { headers, tags: { name: 'session' } }), {
    'session 200': (r) => r.status === 200,
  });

  check(http.get(`${env.baseUrl}/api/all-elections`, { headers, tags: { name: 'all-elections' } }), {
    'all-elections 200': (r) => r.status === 200,
  });

  check(http.get(`${env.baseUrl}/api/election/${env.electionId}`, { headers, tags: { name: 'election-detail' } }), {
    'election detail 200': (r) => r.status === 200,
  });

  check(
    http.post(
      `${env.baseUrl}/api/eligibility`,
      JSON.stringify({ electionId: env.electionId }),
      { headers, tags: { name: 'eligibility' } },
    ),
    { 'eligibility 200': (r) => r.status === 200 },
  );

  sleep(1 + Math.random() * 3);
}
