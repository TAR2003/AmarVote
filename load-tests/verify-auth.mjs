#!/usr/bin/env node
import { generateJWT } from './jwt.mjs';

const secretB64 = (process.env.JWT_SECRET_B64 || process.env.JWT_SECRET || '').trim();
const baseUrl = (process.env.BASE_URL || 'https://amarvote2026.me').replace(/\/$/, '');
const email = `${process.env.TEST_EMAIL_PREFIX || 'loadtest-voter'}-0001@${process.env.TEST_EMAIL_DOMAIN || 'example.com'}`;
const ttlMs = Number(process.env.JWT_EXPIRATION_MS || '3600000');

if (!secretB64) {
  console.error('000\nMissing JWT_SECRET');
  process.exit(1);
}

const jwt = generateJWT(secretB64, email, ttlMs);
const url = `${baseUrl}/api/auth/session`;

let res;
try {
  res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(20000),
  });
} catch (e) {
  process.stdout.write(`000\n${e.message}\n`);
  process.exit(0);
}

const body = await res.text();
process.stdout.write(`${res.status}\n${body}`);
