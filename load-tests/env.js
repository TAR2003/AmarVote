/**
 * Central config — values come from run.sh (sources .env / load-tests/.env.loadtest).
 * Never commit secrets; only .env.loadtest.example is tracked.
 *
 * Candidate names are NOT configured here — vote scenarios fetch them from
 * GET /api/election/:id in setup() (see election-setup.js).
 */
function requireSecret() {
  const secret = __ENV.JWT_SECRET_B64 || __ENV.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Missing JWT secret. Run via ./load-tests/run.sh or set JWT_SECRET_B64 / JWT_SECRET.',
    );
  }
  return secret;
}

export const env = {
  baseUrl: __ENV.BASE_URL || 'https://amarvote2026.me',
  jwtSecretB64: requireSecret(),
  jwtExpirationMs: Number(__ENV.JWT_EXPIRATION_MS || '3600000'),
  electionId: Number(__ENV.ELECTION_ID || '10'),
  emailPrefix: __ENV.TEST_EMAIL_PREFIX || 'loadtest-voter',
  emailDomain: __ENV.TEST_EMAIL_DOMAIN || 'example.com',
  maxVus: Number(__ENV.MAX_VUS || '2000'),
};

export function voterEmail(vu) {
  return `${env.emailPrefix}-${String(vu).padStart(4, '0')}@${env.emailDomain}`;
}

/**
 * One email per VU for cast scenarios — same voter encrypts many times, casts once.
 * STEP_VUS offset avoids reusing emails that already voted in a prior step.
 */
export function voterEmailForStep(vu) {
  const step = Number(__ENV.STEP_VUS || '0');
  const stepPart = step > 0 ? step * 100_000 : 0;
  const n = stepPart + vu;
  return `${env.emailPrefix}-${String(n).padStart(8, '0')}@${env.emailDomain}`;
}

/**
 * @deprecated Use voterEmailForStep — one email per VU with encrypt-then-cast lifecycle.
 */
export function voterEmailForCast(vu, iter) {
  const step = Number(__ENV.STEP_VUS || '0');
  const stepPart = step > 0 ? step * 10_000_000 : 0;
  const n = stepPart + vu * 100_000 + iter;
  return `${env.emailPrefix}-${String(n).padStart(12, '0')}@${env.emailDomain}`;
}

export function k6EnvFlags() {
  return {
    BASE_URL: env.baseUrl,
    JWT_SECRET_B64: env.jwtSecretB64,
    ELECTION_ID: String(env.electionId),
  };
}
