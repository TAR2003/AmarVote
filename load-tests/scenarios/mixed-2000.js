/**
 * Mixed realistic load — stepped ramp to MAX_VUS on election 10.
 * ~65% browse, ~30% vote, ~5% static frontend.
 *
 * Run: ./load-tests/run.sh scenarios/mixed-2000.js
 */
import http from 'k6/http';
import { sleep } from 'k6';
import { generateJWT, authHeaders, padBallotPayload } from '../helpers.js';
import { env, voterEmail, pickCandidate } from '../env.js';
import { buildSteppedStages } from '../stages.js';

export const options = {
  scenarios: {
    mixed_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: buildSteppedStages(env.maxVus),
      gracefulRampDown: '3m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.12'],
    http_req_duration: ['p(95)<60000', 'p(99)<120000'],
  },
  http: { timeout: '180s' },
};

function browseFlow(jwt) {
  const headers = authHeaders(jwt);
  http.get(`${env.baseUrl}/api/auth/session`, { headers, tags: { scenario: 'browse' } });
  http.get(`${env.baseUrl}/api/all-elections`, { headers, tags: { scenario: 'browse' } });
  http.get(`${env.baseUrl}/api/election/${env.electionId}`, { headers, tags: { scenario: 'browse' } });
  http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { scenario: 'browse' } },
  );
}

function voteFlow(jwt) {
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(__VU, __ITER);
  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { scenario: 'vote' } },
  );
  if (eligRes.status !== 200 || eligRes.json('eligible') !== true) return;

  const ballotBody = padBallotPayload({
    electionId: env.electionId,
    selectedCandidates: [candidate],
    botDetection: { isBot: false, requestId: `k6-${__VU}`, timestamp: new Date().toISOString() },
  });

  const enc = http.post(`${env.baseUrl}/api/create-encrypted-ballot`, ballotBody, {
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/octet-stream' },
    tags: { scenario: 'vote' },
  });
  if (enc.status !== 200) return;

  const b = enc.json();
  http.post(
    `${env.baseUrl}/api/cast-encrypted-ballot`,
    JSON.stringify({
      electionId: env.electionId,
      encrypted_ballot: b.encrypted_ballot,
      ballot_hash: b.ballot_hash,
      ballot_tracking_code: b.ballot_tracking_code,
    }),
    { headers, tags: { scenario: 'vote' } },
  );
}

function staticAssets() {
  http.get(`${env.baseUrl}/`, { tags: { scenario: 'static' } });
  http.get(`${env.baseUrl}/election-page/${env.electionId}`, { tags: { scenario: 'static' } });
}

export default function () {
  const jwt = generateJWT(env.jwtSecretB64, voterEmail(__VU));
  const roll = Math.random();

  if (roll < 0.05) staticAssets();
  else if (roll < 0.35) voteFlow(jwt);
  else browseFlow(jwt);

  sleep(1 + Math.random() * 4);
}
