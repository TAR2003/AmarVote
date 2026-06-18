/**
 * Stepped load profile — ramp to each level, hold to observe stability, then increase.
 *
 * Configure via run.sh / .env.loadtest:
 *   VU_STEPS=50,100,200,500,1000   comma-separated plateaus (MAX_VUS appended if missing)
 *   STAGE_RAMP_DURATION=2m           time to reach each new level
 *   STAGE_HOLD_DURATION=3m           soak at each level before increasing
 *   RAMP_DOWN_DURATION=5m
 */
const DEFAULT_STEPS = [50, 100, 200, 500, 1000];

function parseSteps(raw) {
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * @param {number} maxVus - peak virtual users (from MAX_VUS)
 * @returns {{ duration: string, target: number }[]}
 */
export function buildSteppedStages(maxVus) {
  const rampDuration = __ENV.STAGE_RAMP_DURATION || '2m';
  const holdDuration = __ENV.STAGE_HOLD_DURATION || '3m';
  const rampDownDuration = __ENV.RAMP_DOWN_DURATION || '5m';

  let steps = __ENV.VU_STEPS
    ? parseSteps(__ENV.VU_STEPS)
    : DEFAULT_STEPS.filter((n) => n < maxVus);

  steps = [...new Set(steps.filter((n) => n <= maxVus))].sort((a, b) => a - b);
  if (steps.length === 0 || steps[steps.length - 1] < maxVus) {
    steps.push(maxVus);
  }

  const stages = [];
  for (const target of steps) {
    stages.push({ duration: rampDuration, target });
    stages.push({ duration: holdDuration, target });
  }
  stages.push({ duration: rampDownDuration, target: 0 });
  return stages;
}
