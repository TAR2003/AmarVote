/**
 * Central config — values come from run.sh (sources .env / load-tests/.env.loadtest).
 * Never commit secrets; only .env.loadtest.example is tracked.
 */
function parseCandidates(raw) {
  return raw.split('|').map((s) => s.trim()).filter(Boolean);
}

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
  candidates: parseCandidates(
    __ENV.CANDIDATES || 'A big name|nobo tobo|masnoon muztahid',
  ),
  maxVus: Number(__ENV.MAX_VUS || '2000'),
};

export function voterEmail(vu) {
  return `${env.emailPrefix}-${String(vu).padStart(4, '0')}@${env.emailDomain}`;
}

export function pickCandidate(vu, iter) {
  const list = env.candidates;
  return list[(vu + iter) % list.length];
}

export function k6EnvFlags() {
  return {
    BASE_URL: env.baseUrl,
    JWT_SECRET_B64: env.jwtSecretB64,
    ELECTION_ID: String(env.electionId),
    CANDIDATES: env.candidates.join('|'),
  };
}
