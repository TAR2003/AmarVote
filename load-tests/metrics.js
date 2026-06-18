/**
 * Live counters — shown in k6 terminal output while tests run.
 * Names prefixed with live_ok_ / live_fail_ so live-reporter.mjs can parse them.
 */
import { Counter } from 'k6/metrics';

export const liveOkTotal = new Counter('live_ok_total');
export const liveFailTotal = new Counter('live_fail_total');

const apis = [
  'health',
  'session',
  'all-elections',
  'election-detail',
  'eligibility',
  'create-encrypted-ballot',
  'cast-encrypted-ballot',
  'static-home',
  'static-election-page',
];

/** @type {Record<string, { ok: Counter, fail: Counter }>} */
export const liveByApi = {};

for (const api of apis) {
  const key = api.replace(/[^a-z0-9]+/gi, '_');
  liveByApi[api] = {
    ok: new Counter(`live_ok_${key}`),
    fail: new Counter(`live_fail_${key}`),
  };
}

/**
 * Record one HTTP result for live stats (overall + per API).
 * @param {import('k6/http').RefinedResponse} res
 * @param {string} api
 */
export function recordApiResult(res, api) {
  const ok = res && res.status >= 200 && res.status < 400;
  if (ok) {
    liveOkTotal.add(1);
    liveByApi[api]?.ok.add(1);
  } else {
    liveFailTotal.add(1);
    liveByApi[api]?.fail.add(1);
  }
}
