/**
 * Shared helpers for AmarVote k6 load tests.
 * See docs/K6_LOAD_TEST_2000_USERS.md for full documentation.
 */
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

export const TARGET_BALLOT_SIZE = 18980;

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

export function checkResponse(res, name) {
  return {
    [`${name} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} latency < 5s`]: (r) => r.timings.duration < 5000,
  };
}
