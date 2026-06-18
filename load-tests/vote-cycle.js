/**
 * Shared encrypt → cast vote cycle for load tests.
 * Collision-free emails via stride allocation (email-allocator.js).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  generateJWT,
  padBallotPayload,
  authHeaders,
  postEncryptBallot,
} from './helpers.js';
import { env } from './env.js';
import { pickCandidate } from './election-setup.js';
import { recordApiResult, recordEncryptOutcome } from './metrics.js';
import {
  encryptWarmupIters,
  isAlreadyVotedApi,
  parseEligibility,
  voterHasAlreadyCast,
} from './vote-lifecycle.js';
import {
  emailForVoteCycle,
  currentVoterIndex,
  skipToNextEmailSlot,
} from './email-allocator.js';
import { classifyAndLogFailure } from './failure-log.js';

/**
 * Run one vote-cycle iteration: eligibility → encrypt → (optional warmup) → cast.
 * @returns {'cast'|'warmup'|'ineligible'|'already_voted'|'encrypt_fail'|'cast_fail'}
 */
export function runVoteCycleIteration(data, metrics = {}) {
  const candidates = data.candidates;
  const warmup = encryptWarmupIters();
  const cycleLen = warmup + 1;
  const posInCycle = (__ITER - 1) % cycleLen;

  const email = emailForVoteCycle(warmup);
  const emailIndex = currentVoterIndex(warmup);
  const jwt = generateJWT(env.jwtSecretB64, email);
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(candidates, __VU, __ITER);
  const failCtx = { email, emailIndex, candidate };

  const eligRes = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(eligRes, 'eligibility');

  const eligBody = parseEligibility(eligRes);
  if (eligRes.status !== 200 || eligBody.eligible !== true) {
    if (voterHasAlreadyCast(eligBody)) {
      classifyAndLogFailure('eligibility', eligRes, failCtx);
      skipToNextEmailSlot(warmup);
      if (metrics.alreadyVoted) metrics.alreadyVoted.add(1);
      return 'already_voted';
    }
    classifyAndLogFailure('eligibility', eligRes, failCtx);
    if (metrics.ineligible) metrics.ineligible.add(1);
    return 'ineligible';
  }

  const ballotBody = padBallotPayload({
    electionId: env.electionId,
    selectedCandidates: [candidate],
    botDetection: {
      isBot: false,
      requestId: `k6-cast-vu${__VU}-iter${__ITER}`,
      timestamp: new Date().toISOString(),
    },
  });

  const encryptRes = postEncryptBallot(env.baseUrl, jwt, ballotBody);
  recordEncryptOutcome(encryptRes);
  if (metrics.encryptDuration) metrics.encryptDuration.add(encryptRes.timings.duration);
  if (metrics.encryptErrors) metrics.encryptErrors.add(encryptRes.status !== 200);

  if (isAlreadyVotedApi(encryptRes)) {
    classifyAndLogFailure('create-encrypted-ballot', encryptRes, failCtx);
    skipToNextEmailSlot(warmup);
    if (metrics.alreadyVoted) metrics.alreadyVoted.add(1);
    return 'already_voted';
  }

  if (
    !check(encryptRes, {
      'encrypt status 200': (r) => r.status === 200,
      'encrypt has ballot': (r) => r.status === 200 && r.json('encrypted_ballot') !== undefined,
    })
  ) {
    classifyAndLogFailure('create-encrypted-ballot', encryptRes, failCtx);
    return 'encrypt_fail';
  }

  if (posInCycle < warmup) {
    return 'warmup';
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
  if (metrics.castDuration) metrics.castDuration.add(castRes.timings.duration);

  if (isAlreadyVotedApi(castRes)) {
    classifyAndLogFailure('cast-encrypted-ballot', castRes, failCtx);
    skipToNextEmailSlot(warmup);
    if (metrics.alreadyVoted) metrics.alreadyVoted.add(1);
    return 'already_voted';
  }

  const castOk = castRes.status === 200 && castRes.json('success') === true;
  if (metrics.castErrors) metrics.castErrors.add(!castOk);

  check(castRes, {
    'cast status 200': (r) => r.status === 200,
    'cast success': (r) => r.status === 200 && r.json('success') === true,
  });

  if (!castOk) {
    classifyAndLogFailure('cast-encrypted-ballot', castRes, failCtx);
    return 'cast_fail';
  }

  return 'cast';
}
