/**
 * Shared helpers for AmarVote k6 load tests.
 * See docs/K6_LOAD_TEST_2000_USERS.md for full documentation.
 */
import http from 'k6/http';
import { sleep } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

export const TARGET_BALLOT_SIZE = 18980;

/** HTTP statuses worth retrying (transient gateway / rate-limit). */
const TRANSIENT_ENCRYPT_STATUSES = new Set([0, 429, 502, 503, 504]);

/**
 * Generate HS256 JWT matching backend JWTService.generateJWTToken():
 *   - secret: base64-decoded JWT_SECRET (same as Decoders.BASE64.decode in Java)
 *   - claims: sub (email), iat, exp
 *   - TTL: JWT_EXPIRATION_MS from application.properties (default 3600000 = 1h)
 */
export function generateJWT(secretB64, email, ttlMs) {
  const expirationMs = ttlMs ?? Number(__ENV.JWT_EXPIRATION_MS || '3600000');
  const ttlSeconds = Math.floor(expirationMs / 1000);
  const header = encoding.b64encode(JSON.stringify({ alg: 'HS256' }), 'rawurl');
  const now = Math.floor(Date.now() / 1000);
  const payload = encoding.b64encode(
    JSON.stringify({ sub: email, iat: now, exp: now + ttlSeconds }),
    'rawurl',
  );
  const signingInput = `${header}.${payload}`;
  const keyBytes = encoding.b64decode(secretB64, 'std');
  const hasher = crypto.createHMAC('sha256', keyBytes);
  hasher.update(signingInput);
  const signature = hasher.digest('base64url');
  return `${signingInput}.${signature}`;
}

/**
 * PKCS#7 pad ballot JSON to fixed size (matches frontend ballotPadding.js).
 */
export function padBallotPayload(requestBody, targetSize = TARGET_BALLOT_SIZE) {
  const jsonStr = JSON.stringify(requestBody);
  if (jsonStr.length >= targetSize) {
    throw new Error(`Ballot JSON (${jsonStr.length}B) exceeds target ${targetSize}B`);
  }
  const paddingLength = targetSize - jsonStr.length;
  const padded = new Uint8Array(targetSize);
  for (let i = 0; i < jsonStr.length; i++) {
    padded[i] = jsonStr.charCodeAt(i);
  }
  for (let i = jsonStr.length; i < targetSize; i++) {
    padded[i] = paddingLength;
  }
  return padded;
}

export function authHeaders(jwt) {
  return {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export { recordApiResult } from './metrics.js';

/**
 * POST /api/create-encrypted-ballot with retries on transient gateway errors.
 * Does not retry HTTP 400 (business validation — wrong candidate, already voted, etc.).
 */
export function postEncryptBallot(baseUrl, jwt, ballotBody, options = {}) {
  const maxAttempts = options.maxAttempts ?? 3;
  const url = `${baseUrl}/api/create-encrypted-ballot`;
  const headers = {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/octet-stream',
    Accept: 'application/json',
  };
  const params = {
    headers,
    tags: { name: 'create-encrypted-ballot' },
    timeout: options.timeout || '180s',
  };

  let res;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    res = http.post(url, ballotBody, params);
    if (res.status === 200) return res;
    if (res.status === 400 || res.status === 401 || res.status === 403) return res;
    if (attempt < maxAttempts && TRANSIENT_ENCRYPT_STATUSES.has(res.status)) {
      sleep(Math.min(attempt * 2, 6));
      continue;
    }
    return res;
  }
  return res;
}

/** Extract server errorReason / message from a failed API response. */
export function parseApiError(res) {
  try {
    const body = res.json();
    return body.errorReason || body.reason || body.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function checkResponse(res, name) {
  return {
    [`${name} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} latency < 5s`]: (r) => r.timings.duration < 5000,
  };
}
