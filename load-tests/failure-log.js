/**
 * Structured failure logging for vote load tests.
 * Set LOG_FAILURES=0 to silence console output (counters still recorded).
 */
import { Counter } from 'k6/metrics';
import { parseApiError } from './helpers.js';

export const failEncryptAlreadyVoted = new Counter('fail_encrypt_already_voted');
export const failEncryptIneligible = new Counter('fail_encrypt_ineligible');
export const failEncryptValidation = new Counter('fail_encrypt_validation');
export const failEncryptGateway = new Counter('fail_encrypt_gateway');
export const failEncryptServer = new Counter('fail_encrypt_server');
export const failEncryptOther = new Counter('fail_encrypt_other');

export const failCastAlreadyVoted = new Counter('fail_cast_already_voted');
export const failCastValidation = new Counter('fail_cast_validation');
export const failCastServer = new Counter('fail_cast_server');
export const failCastOther = new Counter('fail_cast_other');

export const failEligibilityAlreadyVoted = new Counter('fail_eligibility_already_voted');
export const failEligibilityOther = new Counter('fail_eligibility_ineligible');

function loggingEnabled() {
  return __ENV.LOG_FAILURES !== '0';
}

function safeBodySnippet(res, maxLen = 240) {
  try {
    const raw = res.body || '';
    const text = typeof raw === 'string' ? raw : String(raw);
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  } catch {
    return '';
  }
}

function parseBody(res) {
  try {
    return res.json();
  } catch {
    return {};
  }
}

/**
 * @param {'eligibility'|'create-encrypted-ballot'|'cast-encrypted-ballot'} api
 */
export function classifyAndLogFailure(api, res, context = {}) {
  const status = res?.status ?? 0;
  const body = parseBody(res);
  const reason =
    body.errorReason || body.reason || body.message || parseApiError(res) || `HTTP ${status}`;
  const reasonLower = String(reason).toLowerCase();

  const entry = {
    api,
    status,
    reason,
    vu: context.vu ?? __VU,
    iter: context.iter ?? __ITER,
    email: context.email ?? null,
    candidate: context.candidate ?? null,
    emailIndex: context.emailIndex ?? null,
    durationMs: res?.timings?.duration != null ? Math.round(res.timings.duration) : null,
  };

  if (api === 'eligibility') {
    if (reasonLower.includes('already voted') || body.hasVoted === true) {
      failEligibilityAlreadyVoted.add(1);
      entry.category = 'already_voted';
    } else {
      failEligibilityOther.add(1);
      entry.category = 'ineligible';
    }
  } else if (api === 'create-encrypted-ballot') {
    if (reasonLower.includes('already voted')) {
      failEncryptAlreadyVoted.add(1);
      entry.category = 'already_voted';
    } else if (status === 0 || status === 429 || status === 502 || status === 503 || status === 504) {
      failEncryptGateway.add(1);
      entry.category = 'gateway';
    } else if (status >= 500) {
      failEncryptServer.add(1);
      entry.category = 'server_error';
    } else if (status === 400) {
      failEncryptValidation.add(1);
      entry.category = 'validation';
    } else {
      failEncryptOther.add(1);
      entry.category = 'other';
    }
  } else if (api === 'cast-encrypted-ballot') {
    if (reasonLower.includes('already voted')) {
      failCastAlreadyVoted.add(1);
      entry.category = 'already_voted';
    } else if (status >= 500) {
      failCastServer.add(1);
      entry.category = 'server_error';
    } else if (status === 400) {
      failCastValidation.add(1);
      entry.category = 'validation';
    } else {
      failCastOther.add(1);
      entry.category = 'other';
    }
  }

  if (loggingEnabled()) {
    console.warn(`[VOTE-FAIL] ${JSON.stringify(entry)} body=${safeBodySnippet(res)}`);
  }

  return entry;
}

export function collectFailureCounters(metrics) {
  const pairs = [
    ['Eligibility — already voted', failEligibilityAlreadyVoted],
    ['Eligibility — other', failEligibilityOther],
    ['Encrypt — already voted', failEncryptAlreadyVoted],
    ['Encrypt — validation (HTTP 400)', failEncryptValidation],
    ['Encrypt — gateway (429/502/503)', failEncryptGateway],
    ['Encrypt — server (5xx)', failEncryptServer],
    ['Encrypt — other', failEncryptOther],
    ['Cast — already voted', failCastAlreadyVoted],
    ['Cast — validation (HTTP 400)', failCastValidation],
    ['Cast — server (5xx)', failCastServer],
    ['Cast — other', failCastOther],
  ];

  const rows = [];
  for (const [label, counter] of pairs) {
    const count = metrics[counter.name]?.values?.count ?? 0;
    if (count > 0) rows.push({ label, count });
  }
  return rows;
}
