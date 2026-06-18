#!/usr/bin/env node
/**
 * Fetch election choice titles from GET /api/election/:id (same as browser UI).
 * Used by shell preflight (verify-election.sh) before vote load tests.
 */
import { execSync } from 'node:child_process';
import { generateJWT } from './jwt.mjs';

const secretB64 = (process.env.JWT_SECRET_B64 || process.env.JWT_SECRET || '').trim();
const baseUrl = (process.env.BASE_URL || 'https://amarvote2026.me').replace(/\/$/, '');
const electionId = process.env.ELECTION_ID || '10';
const email = `${process.env.TEST_EMAIL_PREFIX || 'loadtest-voter'}-0001@${process.env.TEST_EMAIL_DOMAIN || 'example.com'}`;
const ttlMs = Number(process.env.JWT_EXPIRATION_MS || '3600000');

if (!secretB64) {
  console.error('ERROR: JWT_SECRET / JWT_SECRET_B64 is not set');
  process.exit(1);
}

const jwt = generateJWT(secretB64, email, ttlMs);
const url = `${baseUrl}/api/election/${electionId}`;

let out;
try {
  out = execSync(
    `curl -sS -w "\\n%{http_code}" -H "Authorization: Bearer ${jwt}" -H "Accept: application/json" "${url}"`,
    { encoding: 'utf8', timeout: 30000 },
  );
} catch (e) {
  console.error(`ERROR: GET ${url} failed: ${e.message}`);
  process.exit(1);
}

const lines = out.trimEnd().split('\n');
const status = lines.pop() || '000';
const body = lines.join('\n');

if (status !== '200') {
  console.error(`ERROR: GET /api/election/${electionId} returned HTTP ${status}`);
  if (body) console.error(body.slice(0, 500));
  process.exit(1);
}

let data;
try {
  data = JSON.parse(body);
} catch {
  console.error('ERROR: election detail response is not valid JSON');
  process.exit(1);
}

const choices = data.electionChoices || [];
const titles = choices
  .map((c) => c.optionTitle)
  .filter((t) => typeof t === 'string' && t.length > 0);

if (!titles.length) {
  console.error(`ERROR: election ${electionId} has no choices (electionChoices empty)`);
  process.exit(1);
}

// Line 1: count (for shell scripts). Remaining lines: one candidate per line.
process.stdout.write(`${titles.length}\n`);
for (const title of titles) {
  process.stdout.write(`${title}\n`);
}
