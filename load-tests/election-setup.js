/**
 * Fetch election choices from the API (same source as the browser UI).
 * Candidate names are never read from env — only ELECTION_ID is configured.
 */
import { fail } from 'k6';
import http from 'k6/http';
import { generateJWT, authHeaders } from './helpers.js';
import { env, voterEmail } from './env.js';

/**
 * k6 setup() — load live optionTitle values for env.electionId.
 * @returns {{ electionId: number, candidates: string[] }}
 */
export function electionSetup() {
  const jwt = generateJWT(env.jwtSecretB64, voterEmail(1));
  const headers = authHeaders(jwt);
  const res = http.get(`${env.baseUrl}/api/election/${env.electionId}`, {
    headers,
    tags: { name: 'setup-election-detail' },
  });

  if (res.status !== 200) {
    fail(
      `setup: GET /api/election/${env.electionId} returned HTTP ${res.status}. ` +
        'Check ELECTION_ID, JWT_SECRET, and that the election exists.',
    );
  }

  let body;
  try {
    body = res.json();
  } catch (e) {
    fail(`setup: could not parse election detail JSON: ${e}`);
  }

  const choices = body.electionChoices || [];
  const titles = choices
    .map((c) => c.optionTitle)
    .filter((t) => typeof t === 'string' && t.length > 0);

  if (!titles.length) {
    fail(
      `setup: election ${env.electionId} has no choices. ` +
        'Activate the election and add candidates before load testing.',
    );
  }

  console.log(
    `setup: election ${env.electionId} — ${titles.length} candidate(s): ${titles.join(' | ')}`,
  );

  return { electionId: env.electionId, candidates: titles };
}

/**
 * Rotate through live candidates (same as browser picking from the dropdown).
 */
export function pickCandidate(candidates, vu, iter) {
  if (!candidates?.length) {
    throw new Error('setup() did not provide candidates — electionSetup() must run first');
  }
  return candidates[(vu + iter) % candidates.length];
}
