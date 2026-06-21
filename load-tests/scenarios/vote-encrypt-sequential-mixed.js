/**
 * Mixed browse + vote — fixed-count sequential benchmark (same profile as vote-encrypt-sequential).
 *
 * Each iteration: browser APIs (session → elections → detail → eligibility)
 * then eligibility → encrypt → cast for one unique voter email.
 *
 * Run:
 *   ./load-tests/run.sh scenarios/vote-encrypt-sequential-mixed.js
 *   SEQ_CONCURRENT_VUS=2 SEQ_TOTAL_VOTES=200 ./load-tests/run.sh scenarios/vote-encrypt-sequential-mixed.js
 */
import exec from 'k6/execution';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  generateJWT,
  padBallotPayload,
  authHeaders,
  postEncryptBallot,
} from '../helpers.js';
import { runBrowseFlow } from '../browse-flow.js';
import { env, voterEmailBaseOffset } from '../env.js';
import { formatVoterEmail } from '../voter-emails.js';
import { electionSetup, pickCandidate } from '../election-setup.js';
import { recordApiResult, recordEncryptOutcome } from '../metrics.js';
import { createVoteSequentialSummaryOutputs } from '../sequential-report.js';
import {
  isAlreadyVotedApi,
  parseEligibility,
} from '../vote-lifecycle.js';
import { classifyAndLogFailure } from '../failure-log.js';

const TEST_NAME = 'vote-encrypt-sequential-mixed';

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const concurrentVus = parsePositiveInt(__ENV.SEQ_CONCURRENT_VUS, 1);
const totalVotes = parsePositiveInt(__ENV.SEQ_TOTAL_VOTES ?? __ENV.SEQ_VOTE_COUNT, 50);
const pauseMs = Math.max(0, Number(__ENV.SEQ_PAUSE_MS || '0'));

const encryptDuration = new Trend('vote_encrypt_duration', true);
const castDuration = new Trend('vote_cast_duration', true);
const voteCycleDuration = new Trend('vote_cycle_duration', true);
const encryptErrors = new Rate('vote_encrypt_errors');
const castErrors = new Rate('vote_cast_errors');
const votesCompleted = new Counter('votes_completed');
const votesSkipped = new Counter('votes_skipped');

export const options = {
  scenarios: {
    sequential_votes_mixed: {
      executor: 'shared-iterations',
      vus: concurrentVus,
      iterations: totalVotes,
      maxDuration: __ENV.SEQ_MAX_DURATION || '24h',
    },
  },
  http: { timeout: '180s' },
  thresholds: {
    vote_encrypt_errors: ['rate<0.05'],
    vote_cast_errors: ['rate<0.05'],
  },
};

export function setup() {
  return electionSetup();
}

function sequentialVoterEmail(voteNumber) {
  const index = voterEmailBaseOffset() + voteNumber;
  return formatVoterEmail(env.emailPrefix, env.emailDomain, index, env.emailPadWidth);
}

function currentVoteNumber() {
  return exec.scenario.iterationInTest + 1;
}

export default function (data) {
  const candidates = data.candidates;
  const voteNumber = currentVoteNumber();
  const email = sequentialVoterEmail(voteNumber);
  const jwt = generateJWT(env.jwtSecretB64, email);
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(candidates, __VU, voteNumber);
  const failCtx = { email, emailIndex: voterEmailBaseOffset() + voteNumber, candidate };
  const cycleStart = Date.now();

  runBrowseFlow(jwt);

  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(eligRes, 'eligibility');

  const eligBody = parseEligibility(eligRes);
  if (eligRes.status !== 200 || eligBody.eligible !== true) {
    classifyAndLogFailure('eligibility', eligRes, failCtx);
    votesSkipped.add(1);
    return;
  }

  const ballotBody = padBallotPayload({
    electionId: env.electionId,
    selectedCandidates: [candidate],
    botDetection: {
      isBot: false,
      requestId: `k6-seq-mixed-vu${__VU}-vote${voteNumber}`,
      timestamp: new Date().toISOString(),
    },
  });

  const encryptRes = postEncryptBallot(env.baseUrl, jwt, ballotBody);
  recordEncryptOutcome(encryptRes);
  encryptDuration.add(encryptRes.timings.duration);
  encryptErrors.add(encryptRes.status !== 200);

  if (isAlreadyVotedApi(encryptRes)) {
    classifyAndLogFailure('create-encrypted-ballot', encryptRes, failCtx);
    votesSkipped.add(1);
    return;
  }

  if (
    !check(encryptRes, {
      'encrypt status 200': (r) => r.status === 200,
      'encrypt has ballot': (r) => r.status === 200 && r.json('encrypted_ballot') !== undefined,
    })
  ) {
    classifyAndLogFailure('create-encrypted-ballot', encryptRes, failCtx);
    return;
  }

  const ballot = encryptRes.json();
  const castRes = http.post(
    `${env.baseUrl}/api/cast-encrypted-ballot`,
    JSON.stringify({
      electionId: env.electionId,
      encrypted_ballot: ballot.encrypted_ballot,
      ballot_hash: ballot.ballot_hash,
      ballot_tracking_code: ballot.ballot_tracking_code,
    }),
    { headers, tags: { name: 'cast-encrypted-ballot' } },
  );

  recordApiResult(castRes, 'cast-encrypted-ballot');
  castDuration.add(castRes.timings.duration);

  if (isAlreadyVotedApi(castRes)) {
    classifyAndLogFailure('cast-encrypted-ballot', castRes, failCtx);
    votesSkipped.add(1);
    return;
  }

  const castOk = castRes.status === 200 && castRes.json('success') === true;
  castErrors.add(!castOk);

  check(castRes, {
    'cast status 200': (r) => r.status === 200,
    'cast success': (r) => r.status === 200 && r.json('success') === true,
  });

  if (!castOk) {
    classifyAndLogFailure('cast-encrypted-ballot', castRes, failCtx);
    return;
  }

  voteCycleDuration.add(Date.now() - cycleStart);
  votesCompleted.add(1);

  if (pauseMs > 0) {
    sleep(pauseMs / 1000);
  }
}

export function handleSummary(data) {
  return createVoteSequentialSummaryOutputs(data, TEST_NAME, concurrentVus, totalVotes);
}
