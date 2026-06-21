/**
 * Browser-like API sequence (session → elections → detail → eligibility).
 * Shared by browse.js and vote+browse mixed scenarios.
 */
import http from 'k6/http';
import { check } from 'k6';
import { authHeaders, recordApiResult } from './helpers.js';
import { env } from './env.js';

/**
 * @param {string} jwt
 * @param {{ checks?: boolean }} [options]
 */
export function runBrowseFlow(jwt, options = {}) {
  const withChecks = options.checks !== false;
  const headers = authHeaders(jwt);

  const sessionRes = http.get(`${env.baseUrl}/api/auth/session`, { headers, tags: { name: 'session' } });
  recordApiResult(sessionRes, 'session');
  if (withChecks) check(sessionRes, { 'session 200': (r) => r.status === 200 });

  const electionsRes = http.get(`${env.baseUrl}/api/all-elections`, { headers, tags: { name: 'all-elections' } });
  recordApiResult(electionsRes, 'all-elections');
  if (withChecks) check(electionsRes, { 'all-elections 200': (r) => r.status === 200 });

  const detailRes = http.get(`${env.baseUrl}/api/election/${env.electionId}`, {
    headers,
    tags: { name: 'election-detail' },
  });
  recordApiResult(detailRes, 'election-detail');
  if (withChecks) check(detailRes, { 'election detail 200': (r) => r.status === 200 });

  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(eligRes, 'eligibility');
  if (withChecks) check(eligRes, { 'eligibility 200': (r) => r.status === 200 });
}
