#!/usr/bin/env node
/**
 * Mirrors load-tests/helpers.js generateJWT() — kept in sync for verify-auth.sh
 */
import crypto from 'node:crypto';

export function generateJWT(secretB64, email, ttlMs = 3_600_000) {
  const ttlSeconds = Math.floor(ttlMs / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: email, iat: now, exp: now + ttlSeconds })).toString(
    'base64url',
  );
  const signingInput = `${header}.${payload}`;
  const key = Buffer.from(secretB64, 'base64');
  const sig = crypto.createHmac('sha256', key).update(signingInput).digest('base64url');
  return `${signingInput}.${sig}`;
}
