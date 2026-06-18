/**
 * Node helpers for run-stepped.sh (mirrors email-allocator.js).
 */

function durationToSeconds(duration) {
  const m = String(duration).trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!m) return 0;
  const n = Number(m[1]);
  switch (m[2]) {
    case 'ms':
      return n / 1000;
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    default:
      return 0;
  }
}

function avgVoteCycleSeconds(warmup) {
  const configured = Number(process.env.VOTE_CYCLE_SECONDS || '0');
  if (Number.isFinite(configured) && configured > 0) return configured;
  return 12 + warmup * 10;
}

function estimatedCyclesPerVu(options = {}) {
  const warmup = options.warmup ?? Number(process.env.ENCRYPT_WARMUP_ITERS || '2');
  const rampSec = durationToSeconds(options.ramp || process.env.STAGE_RAMP_DURATION || '2m');
  const holdSec = durationToSeconds(options.hold || process.env.STAGE_HOLD_DURATION || '3m');
  const cycleSec = avgVoteCycleSeconds(warmup);
  return Math.max(Math.ceil((rampSec + holdSec) / cycleSec) + 5, warmup + 2);
}

function formatVoterEmail(prefix, domain, index, padWidth = 4) {
  return `${prefix}-${String(index).padStart(padWidth, '0')}@${domain}`;
}

function emailsReservedForStep(stepVus, options = {}) {
  return stepVus * estimatedCyclesPerVu(options);
}

function emailRangeForStep(stepEmailOffset, stepVus, options = {}) {
  const cycles = estimatedCyclesPerVu(options);
  const total = stepVus * cycles;
  return {
    first: stepEmailOffset + 1,
    last: stepEmailOffset + (cycles - 1) * stepVus + stepVus,
    estimatedCyclesPerVu: cycles,
    estimatedEmails: total,
  };
}

module.exports = {
  formatVoterEmail,
  estimatedCyclesPerVu,
  emailsReservedForStep,
  emailRangeForStep,
};
