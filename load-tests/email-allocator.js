/**
 * Collision-free voter email allocation (k6 only).
 *
 * Stride partitioning — unlimited distinct emails per VU, no cross-VU reuse:
 *
 *   index(vu, seq) = base + (seq - 1) * stepVus + (vu - 1)
 *
 *   stepVus=50: VU1 → a1, a51, a101…  VU2 → a2, a52, a102…
 *
 * Warmup encrypt iterations reuse the same email within one vote cycle.
 * A new seq (next index) is used only when starting a new cycle or after skip.
 */
import { durationToSeconds } from './stages.js';
import { formatVoterEmail } from './voter-emails.js';
import { env, voterEmailBaseOffset } from './env.js';
import { encryptWarmupIters } from './vote-lifecycle.js';

/** Per-VU state for the active vote cycle. */
let emailSeq = 0;
let emailForCurrentCycle = null;
let lastCycleKey = null;

function voteCycleKey(warmup) {
  const cycleLen = Math.max(1, warmup + 1);
  return Math.floor(Math.max(0, __ITER - 1) / cycleLen);
}

function stepTargetVus() {
  const n = Number(__ENV.STEP_VUS || '0');
  return Number.isFinite(n) && n > 0 ? n : Number(__ENV.MAX_VUS || '50');
}

function avgVoteCycleSeconds(warmup) {
  const configured = Number(__ENV.VOTE_CYCLE_SECONDS || '0');
  if (Number.isFinite(configured) && configured > 0) return configured;
  return 12 + warmup * 10;
}

/**
 * Estimated max vote cycles per VU in one step (for stepped offset planning only — not a cap).
 */
export function estimatedCyclesPerVu(warmup) {
  const rampSec = durationToSeconds(__ENV.STAGE_RAMP_DURATION || '2m');
  const holdSec = durationToSeconds(__ENV.STAGE_HOLD_DURATION || '3m');
  const cycleSec = avgVoteCycleSeconds(warmup);
  return Math.max(Math.ceil((rampSec + holdSec) / cycleSec) + 5, encryptWarmupIters() + 2);
}

/** Unique 1-based voter index — no two (vu, seq) pairs collide across VUs. */
export function voterIndexForSeq(vu, seq) {
  if (seq < 1) {
    throw new Error(`Internal error: invalid email seq ${seq} for VU${vu}`);
  }
  const stride = stepTargetVus();
  return voterEmailBaseOffset() + (seq - 1) * stride + (vu - 1);
}

function assignEmailForSeq(seq) {
  emailSeq = seq;
  emailForCurrentCycle = formatVoterEmail(
    env.emailPrefix,
    env.emailDomain,
    voterIndexForSeq(__VU, seq),
    env.emailPadWidth,
  );
}

function assignEmailForCycle(cycleKey) {
  emailSeq += 1;
  assignEmailForSeq(emailSeq);
  lastCycleKey = cycleKey;
}

/**
 * Email for the current vote cycle (same address for warmup + cast in one cycle).
 */
export function emailForVoteCycle(warmup) {
  const cycleKey = voteCycleKey(warmup);

  if (cycleKey !== lastCycleKey) {
    assignEmailForCycle(cycleKey);
  } else if (emailSeq < 1 || emailForCurrentCycle == null) {
    assignEmailForSeq(emailSeq > 0 ? emailSeq : 1);
    lastCycleKey = cycleKey;
  }

  return emailForCurrentCycle;
}

/** Current 1-based voter index (for failure logs). */
export function currentVoterIndex(warmup) {
  emailForVoteCycle(warmup);
  return voterIndexForSeq(__VU, emailSeq);
}

/**
 * Move to the next unused email (e.g. already voted from a prior run).
 * Stays on the same vote cycle so warmup iterations can continue with the new address.
 */
export function skipToNextEmailSlot(warmup) {
  const cycleKey = voteCycleKey(warmup);
  assignEmailForSeq(Math.max(emailSeq, 0) + 1);
  lastCycleKey = cycleKey;
}

/** Estimated emails touched in a step (for run-stepped.sh offset — not a limit). */
export function emailsReservedForStep(stepVus, warmup) {
  return stepVus * estimatedCyclesPerVu(warmup);
}

export function emailRangeForStep(stepOffset, stepVus, warmup) {
  const cycles = estimatedCyclesPerVu(warmup);
  const total = stepVus * cycles;
  return {
    first: stepOffset + 1,
    last: stepOffset + (cycles - 1) * stepVus + stepVus,
    estimatedCyclesPerVu: cycles,
    estimatedEmails: total,
  };
}
