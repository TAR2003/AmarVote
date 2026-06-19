/**
 * Fixed-count encrypt → cast benchmark — configurable concurrency.
 *
 * Each iteration: eligibility → encrypt → cast for one unique voter email.
 * Set concurrent VUs and total votes in load-tests/.env.loadtest (SEQ_* vars).
 *
 * Run:
 *   ./load-tests/run.sh scenarios/vote-encrypt-sequential.js
 *   SEQ_CONCURRENT_VUS=2 SEQ_TOTAL_VOTES=200 ./load-tests/run.sh scenarios/vote-encrypt-sequential.js
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
import { env, voterEmailBaseOffset } from '../env.js';
import { formatVoterEmail } from '../voter-emails.js';
import { electionSetup, pickCandidate } from '../election-setup.js';
import { recordApiResult, recordEncryptOutcome } from '../metrics.js';
import {
  isAlreadyVotedApi,
  parseEligibility,
  voterHasAlreadyCast,
} from '../vote-lifecycle.js';
import { classifyAndLogFailure } from '../failure-log.js';
import { buildSingleStepReport, formatSingleStepReportText } from '../summary.js';

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
    sequential_votes: {
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

/** Globally unique vote slot (0-based) across all concurrent VUs. */
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
      requestId: `k6-seq-vu${__VU}-vote${voteNumber}`,
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

function round(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function formatSequentialReport(data) {
  const base = buildSingleStepReport(data, 'vote-encrypt-sequential', concurrentVus);
  const completed = data.metrics.votes_completed?.values?.count ?? 0;
  const skipped = data.metrics.votes_skipped?.values?.count ?? 0;
  const durationSec = data.state?.testRunDurationMs ? data.state.testRunDurationMs / 1000 : null;
  const votesPerMin =
    durationSec && durationSec > 0 ? round((completed / durationSec) * 60, 2) : null;
  const votesPerHour =
    durationSec && durationSec > 0 ? round((completed / durationSec) * 3600, 1) : null;

  const report = {
    ...base,
    mode: 'fixed-count',
    concurrent_vus: concurrentVus,
    vote_target: totalVotes,
    votes_completed: completed,
    votes_skipped: skipped,
    test_duration_sec: round(durationSec),
    throughput_votes_per_min: votesPerMin,
    throughput_votes_per_hour: votesPerHour,
    encrypt_avg_ms: round(data.metrics.vote_encrypt_duration?.values?.avg),
    encrypt_p95_ms: round(data.metrics.vote_encrypt_duration?.values?.['p(95)']),
    cast_avg_ms: round(data.metrics.vote_cast_duration?.values?.avg),
    cast_p95_ms: round(data.metrics.vote_cast_duration?.values?.['p(95)']),
    cycle_avg_ms: round(data.metrics.vote_cycle_duration?.values?.avg),
    cycle_p95_ms: round(data.metrics.vote_cycle_duration?.values?.['p(95)']),
  };

  const lines = [
    formatSingleStepReportText({ ...base, vus: concurrentVus }),
    `  Fixed-count throughput (${concurrentVus} concurrent VU${concurrentVus === 1 ? '' : 's'})`,
    `    Concurrent VUs     : ${report.concurrent_vus}`,
    `    Target votes       : ${report.vote_target}`,
    `    Completed          : ${report.votes_completed}`,
    `    Skipped            : ${report.votes_skipped} (already voted / ineligible)`,
    `    Wall time          : ${report.test_duration_sec}s`,
    `    Throughput         : ${report.throughput_votes_per_min} votes/min  (${report.throughput_votes_per_hour}/hr)`,
    `    Encrypt latency    : avg ${report.encrypt_avg_ms}ms  p95 ${report.encrypt_p95_ms}ms`,
    `    Cast latency       : avg ${report.cast_avg_ms}ms  p95 ${report.cast_p95_ms}ms`,
    `    Full cycle         : avg ${report.cycle_avg_ms}ms  p95 ${report.cycle_p95_ms}ms`,
    '',
  ];

  return { report, text: lines.join('\n') };
}

export function handleSummary(data) {
  const { report, text } = formatSequentialReport(data);
  return {
    stdout: text,
    'load-tests/results/vote-encrypt-sequential-report.json': JSON.stringify(report, null, 2),
    'load-tests/results/vote-encrypt-sequential-report.txt': text,
  };
}
