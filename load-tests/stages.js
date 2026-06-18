/**
 * Stepped load profile — one isolated scenario per VU level for per-step reports.
 *
 * Configure via run.sh / .env.loadtest:
 *   VU_STEPS=50,100,200,500,1000   comma-separated plateaus (MAX_VUS appended if missing)
 *   STAGE_RAMP_DURATION=2m           time to reach each new level
 *   STAGE_HOLD_DURATION=3m           soak at each level before increasing
 *   RAMP_DOWN_DURATION=5m            optional final ramp-down scenario
 */
const DEFAULT_STEPS = [50, 100, 200, 500, 1000];

function parseSteps(raw) {
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Parse k6 duration strings (30s, 2m, 1h) to seconds. */
export function durationToSeconds(duration) {
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

/**
 * @param {number} maxVus
 * @returns {number[]}
 */
export function resolveSteps(maxVus) {
  let steps = __ENV.VU_STEPS
    ? parseSteps(__ENV.VU_STEPS)
    : DEFAULT_STEPS.filter((n) => n < maxVus);

  steps = [...new Set(steps.filter((n) => n <= maxVus))].sort((a, b) => a - b);
  if (steps.length === 0 || steps[steps.length - 1] < maxVus) {
    steps.push(maxVus);
  }
  return steps;
}

/**
 * Legacy single-scenario ramp (kept for compatibility).
 * @param {number} maxVus
 * @returns {{ duration: string, target: number }[]}
 */
export function buildSteppedStages(maxVus) {
  const rampDuration = __ENV.STAGE_RAMP_DURATION || '2m';
  const holdDuration = __ENV.STAGE_HOLD_DURATION || '3m';
  const rampDownDuration = __ENV.RAMP_DOWN_DURATION || '5m';
  const steps = resolveSteps(maxVus);

  const stages = [];
  for (const target of steps) {
    stages.push({ duration: rampDuration, target });
    stages.push({ duration: holdDuration, target });
  }
  stages.push({ duration: rampDownDuration, target: 0 });
  return stages;
}

/**
 * Sequential scenarios — one per VU step (50, 100, 200, …).
 * k6 reports metrics per scenario → per-step pass/fail reports.
 *
 * @param {number} maxVus
 * @param {{ exec?: string, gracefulRampDown?: string, includeRampDown?: boolean }} [config]
 */
export function buildSequentialStepScenarios(maxVus, config = {}) {
  const rampDuration = __ENV.STAGE_RAMP_DURATION || '2m';
  const holdDuration = __ENV.STAGE_HOLD_DURATION || '3m';
  const rampDownDuration = __ENV.RAMP_DOWN_DURATION || '5m';
  const gracefulRampDown = config.gracefulRampDown || '15s';
  const steps = resolveSteps(maxVus);

  const rampSecs = durationToSeconds(rampDuration);
  const holdSecs = durationToSeconds(holdDuration);
  const gracefulSecs = durationToSeconds(gracefulRampDown);

  const scenarios = {};
  let offsetSecs = 0;

  for (const target of steps) {
    const name = `vus_${target}`;
    scenarios[name] = {
      executor: 'ramping-vus',
      exec: config.exec || 'default',
      startVUs: 0,
      startTime: `${offsetSecs}s`,
      stages: [
        { duration: rampDuration, target },
        { duration: holdDuration, target },
      ],
      gracefulRampDown,
      tags: { load_step: String(target), vus: String(target) },
    };
    offsetSecs += rampSecs + holdSecs + gracefulSecs;
  }

  if (config.includeRampDown) {
    scenarios.ramp_down = {
      executor: 'ramping-vus',
      exec: config.exec || 'default',
      startVUs: 0,
      startTime: `${offsetSecs}s`,
      stages: [{ duration: rampDownDuration, target: 0 }],
      gracefulRampDown: '0s',
      tags: { load_step: 'ramp_down', vus: '0' },
    };
  }

  return scenarios;
}
