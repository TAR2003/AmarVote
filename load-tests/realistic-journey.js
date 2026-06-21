/**
 * Realistic voter session — mirrors how real users interact with AmarVote:
 *
 *   session (optional SPA auth) → all-elections → election-detail → eligibility
 *   → create-encrypted-ballot (usually 1, sometimes 2–3 to "try" choices)
 *   → cast-encrypted-ballot (exactly once)
 *
 * Some users browse only or stop after eligibility without voting.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  generateJWT,
  padBallotPayload,
  authHeaders,
  postEncryptBallot,
} from './helpers.js';
import { env } from './env.js';
import { emailForUserSession } from './email-allocator.js';
import { pickCandidate } from './election-setup.js';
import { recordApiResult, recordEncryptOutcome } from './metrics.js';
import {
  isAlreadyVotedApi,
  parseEligibility,
  voterHasAlreadyCast,
} from './vote-lifecycle.js';
import { classifyAndLogFailure } from './failure-log.js';
import { pickUserIntent, realisticConfig, totalEncryptAttempts } from './realistic-config.js';

export const journeyBrowseOnly = new Counter('journey_browse_only');
export const journeyEligibilityOnly = new Counter('journey_eligibility_only');
export const journeyVotesCompleted = new Counter('journey_votes_completed');
export const journeyVotesAbandoned = new Counter('journey_votes_abandoned');
export const journeyIneligible = new Counter('journey_ineligible');
export const journeyAlreadyVoted = new Counter('journey_already_voted');
export const journeyExtraEncryptUsers = new Counter('journey_extra_encrypt_users');
export const journeyEncryptAttempts = new Counter('journey_encrypt_attempts_total');
export const journeySessionDuration = new Trend('journey_session_duration', true);
export const journeyCastDuration = new Trend('journey_cast_duration', true);
export const journeyEncryptDuration = new Trend('journey_encrypt_duration', true);

export const journeyMetrics = {
  journeyBrowseOnly,
  journeyEligibilityOnly,
  journeyVotesCompleted,
  journeyVotesAbandoned,
  journeyIneligible,
  journeyAlreadyVoted,
  journeyExtraEncryptUsers,
  journeyEncryptAttempts,
  journeySessionDuration,
  journeyCastDuration,
  journeyEncryptDuration,
};

function think(cfg) {
  const min = cfg.thinkMinMs / 1000;
  const max = cfg.thinkMaxMs / 1000;
  if (max <= min) return;
  sleep(min + Math.random() * (max - min));
}

function getSession(jwt, headers) {
  const res = http.get(`${env.baseUrl}/api/auth/session`, { headers, tags: { name: 'session' } });
  recordApiResult(res, 'session');
  check(res, { 'session 200': (r) => r.status === 200 });
  return res;
}

function getAllElections(headers) {
  const res = http.get(`${env.baseUrl}/api/all-elections`, { headers, tags: { name: 'all-elections' } });
  recordApiResult(res, 'all-elections');
  check(res, { 'all-elections 200': (r) => r.status === 200 });
  return res;
}

function getElectionDetail(headers) {
  const res = http.get(`${env.baseUrl}/api/election/${env.electionId}`, {
    headers,
    tags: { name: 'election-detail' },
  });
  recordApiResult(res, 'election-detail');
  check(res, { 'election detail 200': (r) => r.status === 200 });
  return res;
}

function postEligibility(headers, failCtx) {
  const res = http.post(
    `${env.baseUrl}/api/eligibility`,
    JSON.stringify({ electionId: env.electionId }),
    { headers, tags: { name: 'eligibility' } },
  );
  recordApiResult(res, 'eligibility');
  check(res, { 'eligibility 200': (r) => r.status === 200 });
  if (res.status !== 200) classifyAndLogFailure('eligibility', res, failCtx);
  return res;
}

function runBrowsePath(headers, cfg, includeDetail) {
  getAllElections(headers);
  think(cfg);
  if (includeDetail) {
    getElectionDetail(headers);
    think(cfg);
  }
}

/**
 * One simulated user session.
 * @param {{ candidates: string[] }} data
 * @param {{ iteration?: number }} [ctx]
 * @returns {'browse_only'|'eligibility_only'|'vote_completed'|'vote_abandoned'|'ineligible'|'already_voted'}
 */
export function runRealisticUserSession(data, ctx = {}) {
  const cfg = realisticConfig();
  const sessionStart = Date.now();
  const sessionSeq = ctx.iteration ?? __ITER + 1;
  const { email, emailIndex } = emailForUserSession(sessionSeq);
  const jwt = generateJWT(env.jwtSecretB64, email);
  const headers = authHeaders(jwt);
  const candidate = pickCandidate(data.candidates, __VU, sessionSeq);
  const failCtx = { email, emailIndex, candidate, iteration: sessionSeq };
  const intent = pickUserIntent(cfg);

  if (cfg.includeSession) {
    getSession(jwt, headers);
    think(cfg);
  }

  if (intent === 'browse_only') {
    const includeDetail = Math.random() * 100 < cfg.browseDetailPct;
    runBrowsePath(headers, cfg, includeDetail);
    journeyBrowseOnly.add(1);
    journeySessionDuration.add(Date.now() - sessionStart);
    return 'browse_only';
  }

  runBrowsePath(headers, cfg, true);

  const eligRes = postEligibility(headers, failCtx);
  think(cfg);
  const eligBody = parseEligibility(eligRes);

  if (eligRes.status !== 200 || eligBody.eligible !== true) {
    if (voterHasAlreadyCast(eligBody)) {
      classifyAndLogFailure('eligibility', eligRes, failCtx);
      journeyAlreadyVoted.add(1);
      journeySessionDuration.add(Date.now() - sessionStart);
      return 'already_voted';
    }
    classifyAndLogFailure('eligibility', eligRes, failCtx);
    journeyIneligible.add(1);
    journeySessionDuration.add(Date.now() - sessionStart);
    return 'ineligible';
  }

  if (intent === 'eligibility_only') {
    journeyEligibilityOnly.add(1);
    journeySessionDuration.add(Date.now() - sessionStart);
    return 'eligibility_only';
  }

  const encryptTotal = totalEncryptAttempts(cfg);
  let lastBallot = null;
  let lastEncryptOk = false;

  for (let attempt = 1; attempt <= encryptTotal; attempt++) {
    const ballotBody = padBallotPayload({
      electionId: env.electionId,
      selectedCandidates: [candidate],
      botDetection: {
        isBot: false,
        requestId: `k6-real-vu${__VU}-iter${sessionSeq}-enc${attempt}`,
        timestamp: new Date().toISOString(),
      },
    });

    const encryptRes = postEncryptBallot(env.baseUrl, jwt, ballotBody);
    recordEncryptOutcome(encryptRes);
    journeyEncryptAttempts.add(1);
    journeyEncryptDuration.add(encryptRes.timings.duration);

    if (isAlreadyVotedApi(encryptRes)) {
      classifyAndLogFailure('create-encrypted-ballot', encryptRes, failCtx);
      journeyAlreadyVoted.add(1);
      journeySessionDuration.add(Date.now() - sessionStart);
      return 'already_voted';
    }

    const encryptOk =
      encryptRes.status === 200 &&
      check(encryptRes, {
        'encrypt status 200': (r) => r.status === 200,
        'encrypt has ballot': (r) => r.status === 200 && r.json('encrypted_ballot') !== undefined,
      });

    if (!encryptOk) {
      classifyAndLogFailure('create-encrypted-ballot', encryptRes, failCtx);
      journeyVotesAbandoned.add(1);
      journeySessionDuration.add(Date.now() - sessionStart);
      return 'vote_abandoned';
    }

    lastBallot = encryptRes.json();
    lastEncryptOk = true;

    if (attempt < encryptTotal) {
      think(cfg);
    }
  }

  if (encryptTotal > 1) {
    journeyExtraEncryptUsers.add(1);
  }

  if (!lastEncryptOk || !lastBallot) {
    journeyVotesAbandoned.add(1);
    journeySessionDuration.add(Date.now() - sessionStart);
    return 'vote_abandoned';
  }

  think(cfg);

  const castRes = http.post(
    `${env.baseUrl}/api/cast-encrypted-ballot`,
    JSON.stringify({
      electionId: env.electionId,
      encrypted_ballot: lastBallot.encrypted_ballot,
      ballot_hash: lastBallot.ballot_hash,
      ballot_tracking_code: lastBallot.ballot_tracking_code,
    }),
    { headers, tags: { name: 'cast-encrypted-ballot' } },
  );

  recordApiResult(castRes, 'cast-encrypted-ballot');
  journeyCastDuration.add(castRes.timings.duration);

  if (isAlreadyVotedApi(castRes)) {
    classifyAndLogFailure('cast-encrypted-ballot', castRes, failCtx);
    journeyAlreadyVoted.add(1);
    journeySessionDuration.add(Date.now() - sessionStart);
    return 'already_voted';
  }

  const castOk =
    castRes.status === 200 &&
    castRes.json('success') === true &&
    check(castRes, {
      'cast status 200': (r) => r.status === 200,
      'cast success': (r) => r.status === 200 && r.json('success') === true,
    });

  if (!castOk) {
    classifyAndLogFailure('cast-encrypted-ballot', castRes, failCtx);
    journeyVotesAbandoned.add(1);
    journeySessionDuration.add(Date.now() - sessionStart);
    return 'vote_abandoned';
  }

  journeyVotesCompleted.add(1);
  journeySessionDuration.add(Date.now() - sessionStart);
  return 'vote_completed';
}
