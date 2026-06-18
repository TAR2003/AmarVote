/**
 * Central config — values come from run.sh (sources .env / load-tests/.env.loadtest).
 */
import { formatVoterEmail } from './voter-emails.js';

function requireSecret() {
  const secret = __ENV.JWT_SECRET_B64 || __ENV.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Missing JWT secret. Run via ./load-tests/run.sh or set JWT_SECRET_B64 / JWT_SECRET.',
    );
  }
  return secret;
}

function parseNonNegativeInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export const env = {
  baseUrl: __ENV.BASE_URL || 'https://amarvote2026.me',
  jwtSecretB64: requireSecret(),
  jwtExpirationMs: Number(__ENV.JWT_EXPIRATION_MS || '3600000'),
  electionId: Number(__ENV.ELECTION_ID || '10'),
  emailPrefix: __ENV.TEST_EMAIL_PREFIX || 'loadtest-voter',
  emailDomain: __ENV.TEST_EMAIL_DOMAIN || 'example.com',
  maxVus: Number(__ENV.MAX_VUS || '2000'),
  emailPadWidth: Number(__ENV.TEST_EMAIL_PAD_WIDTH || '4'),
};

/** Browse / encrypt-only: fixed VU → email (no cast, can repeat encrypt). */
export function voterEmail(vu) {
  return formatVoterEmail(env.emailPrefix, env.emailDomain, vu, env.emailPadWidth);
}

/** Base index before sequential allocation (stepped runs + optional start skip). */
export function voterEmailBaseOffset() {
  return (
    parseNonNegativeInt(__ENV.TEST_EMAIL_START_OFFSET, 0)
    + parseNonNegativeInt(__ENV.STEP_EMAIL_OFFSET, 0)
  );
}

export function k6EnvFlags() {
  return {
    BASE_URL: env.baseUrl,
    JWT_SECRET_B64: env.jwtSecretB64,
    ELECTION_ID: String(env.electionId),
  };
}
