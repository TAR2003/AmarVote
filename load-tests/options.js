/**
 * Shared k6 options — single VU step (STEP_VUS) or full sequential profile.
 */
import { buildSequentialStepScenarios } from './stages.js';

function singleStepVus() {
  const vus = Number(__ENV.STEP_VUS || '0');
  return Number.isFinite(vus) && vus > 0 ? vus : 0;
}

/**
 * @param {number} maxVus
 * @param {{ gracefulRampDown?: string, http?: object }} [config]
 */
export function buildLoadTestOptions(maxVus, config = {}) {
  const stepVus = singleStepVus();
  const rampDuration = __ENV.STAGE_RAMP_DURATION || '2m';
  const holdDuration = __ENV.STAGE_HOLD_DURATION || '3m';
  const gracefulRampDown = config.gracefulRampDown || '15s';

  const base = {
    thresholds: config.thresholds || {},
    ...(config.http ? { http: config.http } : {}),
  };

  if (stepVus > 0) {
    return {
      ...base,
      scenarios: {
        [`step_${stepVus}_vus`]: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: rampDuration, target: stepVus },
            { duration: holdDuration, target: stepVus },
          ],
          gracefulRampDown,
          tags: { load_step: String(stepVus), vus: String(stepVus) },
        },
      },
    };
  }

  return {
    ...base,
    scenarios: buildSequentialStepScenarios(maxVus, { gracefulRampDown }),
  };
}

export function isSingleStepMode() {
  return singleStepVus() > 0;
}

export function currentStepVus() {
  return singleStepVus();
}
