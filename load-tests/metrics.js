/**
 * Live counters — shown in k6 terminal output while tests run.
 * Names prefixed with live_ok_ / live_fail_ / api_duration_ so live-reporter.mjs
 * and summary.js can parse per-endpoint ok/fail and latency.
 */
import { Counter, Trend } from 'k6/metrics';

export const liveOkTotal = new Counter('live_ok_total');
export const liveFailTotal = new Counter('live_fail_total');
export const encryptBusinessReject = new Counter('encrypt_business_reject');
export const encryptTransientFail = new Counter('encrypt_transient_fail');

export const API_NAMES = [
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

/** @param {string} api */
export function apiMetricKey(api) {
  return api.replace(/[^a-z0-9]+/gi, '_');
}

/** @type {Record<string, { ok: Counter, fail: Counter, duration: Trend }>} */
export const liveByApi = {};

for (const api of API_NAMES) {
  const key = apiMetricKey(api);
  liveByApi[api] = {
    ok: new Counter(`live_ok_${key}`),
    fail: new Counter(`live_fail_${key}`),
    duration: new Trend(`api_duration_${key}`, true),
  };
}

/**
 * Record one HTTP result for live stats (overall + per API).
 * @param {import('k6/http').RefinedResponse} res
 * @param {string} api
 */
export function recordApiResult(res, api) {
  const entry = liveByApi[api];
  if (res?.timings?.duration != null) {
    entry?.duration.add(res.timings.duration);
  }

  const ok = res && res.status >= 200 && res.status < 400;
  if (ok) {
    liveOkTotal.add(1);
    entry?.ok.add(1);
  } else {
    liveFailTotal.add(1);
    entry?.fail.add(1);
  }
}

/**
 * Classify encrypt failures for clearer reports (business vs gateway).
 * @param {import('k6/http').RefinedResponse} res
 */
export function recordEncryptOutcome(res) {
  recordApiResult(res, 'create-encrypted-ballot');
  if (!res || res.status === 200) return;
  if (res.status === 400) {
    encryptBusinessReject.add(1);
  } else if (res.status === 0 || res.status === 429 || res.status >= 502) {
    encryptTransientFail.add(1);
  }
}
