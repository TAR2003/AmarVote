#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { generateJWT } from './jwt.mjs';

const secretB64 = (process.env.JWT_SECRET_B64 || process.env.JWT_SECRET || '').trim();
const baseUrl = process.env.BASE_URL || 'https://amarvote2026.me';
const email = `${process.env.TEST_EMAIL_PREFIX || 'loadtest-voter'}-0001@${process.env.TEST_EMAIL_DOMAIN || 'example.com'}`;
const ttlMs = Number(process.env.JWT_EXPIRATION_MS || '3600000');

if (!secretB64) {
  console.error('000\nMissing JWT_SECRET');
  process.exit(1);
}

const jwt = generateJWT(secretB64, email, ttlMs);
const out = execSync(
  `curl -sS -w "\\n%{http_code}" -H "Authorization: Bearer ${jwt}" "${baseUrl}/api/auth/session"`,
  { encoding: 'utf8', timeout: 20000 },
);
const lines = out.trimEnd().split('\n');
const status = lines.pop() || '000';
const body = lines.join('\n');
process.stdout.write(`${status}\n${body}`);
