/**
 * Mixed realistic load — stepped ramp to MAX_VUS on election 10.
 * ~65% browse, ~30% vote, ~5% static frontend.
 * Run: ./load-tests/run.sh scenarios/mixed-2000.js
 */
import http from 'k6/http';
import { sleep } from 'k6';
import { generateJWT, authHeaders } from '../helpers.js';
import { env, voterEmail } from '../env.js';
import { electionSetup } from '../election-setup.js';
import { recordApiResult } from '../metrics.js';
import { buildLoadTestOptions } from '../options.js';
import { createSingleStepSummary, createStepSummary } from '../summary.js';
import { runVoteCycleIteration } from '../vote-cycle.js';

export const options = buildLoadTestOptions(env.maxVus, {
  gracefulRampDown: '30s',
  http: { timeout: '180s' },
  thresholds: {
    http_req_failed: ['rate<0.12'],
    http_req_duration: ['p(95)<60000', 'p(99)<120000'],
  },
});

export function setup() {
  return electionSetup();
}

function browseFlow(jwt) {
  const headers = authHeaders(jwt);
  const sessionRes = http.get(`${env.baseUrl}/api/auth/session`, { headers, tags: { name: 'session' } });
  recordApiResult(sessionRes, 'session');
  const electionsRes = http.get(`${env.baseUrl}/api/all-elections`, { headers, tags: { name: 'all-elections' } });
  recordApiResult(electionsRes, 'all-elections');
  const detailRes = http.get(`${env.baseUrl}/api/election/${env.electionId}`, { headers, tags: { name: 'election-detail' } });
  recordApiResult(detailRes, 'election-detail');
  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(eligRes, 'eligibility');
}


function voteFlow(candidates) {
  runVoteCycleIteration({ candidates });
}

function staticAssets() {
  const homeRes = http.get(`${env.baseUrl}/`, { tags: { name: 'static-home' } });
  recordApiResult(homeRes, 'static-home');
  const pageRes = http.get(`${env.baseUrl}/election-page/${env.electionId}`, { tags: { name: 'static-election-page' } });
  recordApiResult(pageRes, 'static-election-page');
}

export default function (data) {
  const jwt = generateJWT(env.jwtSecretB64, voterEmail(__VU));
  const roll = Math.random();

  if (roll < 0.05) staticAssets();
  else if (roll < 0.35) voteFlow(data.candidates);
  else browseFlow(jwt);

  sleep(1 + Math.random() * 4);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createSingleStepSummary('mixed-2000')(data);
  return createStepSummary('mixed-2000')(data);
}
