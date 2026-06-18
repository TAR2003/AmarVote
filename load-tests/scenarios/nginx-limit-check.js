/**
 * Nginx rate-limit diagnostic — run BEFORE full load tests.
 *
 * Sends a parallel burst from one IP (like k6) and reports HTTP 429 counts.
 * If many 429s → production nginx-proxy.conf is active; switch to load-test nginx.
 *
 * Run:
 *   ./load-tests/run.sh scenarios/nginx-limit-check.js
 *   # or: SKIP_NGINX_CHECK=1 ./load-tests/run.sh scenarios/nginx-limit-check.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { generateJWT, authHeaders, recordApiResult } from '../helpers.js';
import { env } from '../env.js';
import { createSimpleSummary } from '../summary.js';

const status200 = new Counter('status_200');
const status429 = new Counter('status_429');
const status401 = new Counter('status_401');
const status503 = new Counter('status_503');
const statusOther = new Counter('status_other');

const BURST_VUS = Number(__ENV.NGINX_BURST_VUS || '60');
const BURST_ROUNDS = Number(__ENV.NGINX_BURST_ROUNDS || '3');

export const options = {
  scenarios: {
    nginx_parallel_burst: {
      executor: 'per-vu-iterations',
      vus: BURST_VUS,
      iterations: BURST_ROUNDS,
      maxDuration: '2m',
    },
  },
  thresholds: {
    status_429: ['count<1'],
  },
};

function recordStatus(res, api) {
  recordApiResult(res, api);
  switch (res.status) {
    case 200:
      status200.add(1);
      break;
    case 429:
      status429.add(1);
      break;
    case 401:
      status401.add(1);
      break;
    case 503:
      status503.add(1);
      break;
    default:
      statusOther.add(1);
  }
}

export function setup() {
  return {
    jwt: generateJWT(env.jwtSecretB64, 'nginx-limit-check@loadtest.local'),
  };
}

export default function (data) {
  const jwt = data.jwt;
  const headers = authHeaders(jwt);

  // Round 1 — health (hits global_limit / conn_limit)
  const health = http.get(`${env.baseUrl}/api/health`, { tags: { name: 'health' } });
  recordStatus(health, 'health');
  check(health, { 'health not rate-limited': (r) => r.status !== 429 });

  // Round 2 — auth session (hits auth_limit 10/min in production nginx)
  const session = http.get(`${env.baseUrl}/api/auth/session`, {
    headers,
    tags: { name: 'session' },
  });
  recordStatus(session, 'session');
  check(session, { 'session not rate-limited': (r) => r.status !== 429 });

  // Round 3 — API path (hits api_limit 10/s in production nginx)
  const elections = http.get(`${env.baseUrl}/api/all-elections`, {
    headers,
    tags: { name: 'all-elections' },
  });
  recordStatus(elections, 'all-elections');
  check(elections, { 'api not rate-limited': (r) => r.status !== 429 });

  sleep(0.05);
}

export const handleSummary = createSimpleSummary('nginx-limit-check');
