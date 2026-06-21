/**
 * Realistic user journey — stepped ramp (50 → 100 → … → MAX_VUS).
 *
 * Simulates real voter behaviour:
 *   • Some users browse elections only
 *   • Some check eligibility then leave
 *   • Most complete a vote: browse → detail → eligibility → encrypt (1–3×) → cast once
 *
 * Run: ./load-tests/run.sh scenarios/realistic-vote.js
 */
import { sleep } from 'k6';
import { env } from '../env.js';
import { electionSetup } from '../election-setup.js';
import { buildLoadTestOptions } from '../options.js';
import { createRealisticStepSummary, createRealisticCombinedSummary } from '../realistic-report.js';
import { runRealisticUserSession } from '../realistic-journey.js';
import { realisticConfig } from '../realistic-config.js';

const TEST_NAME = 'realistic-vote';

export const options = buildLoadTestOptions(env.maxVus, {
  gracefulRampDown: '30s',
  http: { timeout: '180s' },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    journey_votes_completed: ['count>=0'],
    checks: ['rate>0.85'],
  },
});

export function setup() {
  const data = electionSetup();
  const cfg = realisticConfig();
  console.log(
    `setup: realistic mix — browse-only ${cfg.browseOnlyPct}%, eligibility-only ${cfg.eligibilityOnlyPct}%, ` +
      `vote ${cfg.votePct}%, extra-encrypt ${cfg.extraEncryptPct}% (max +${cfg.extraEncryptMax})`,
  );
  return data;
}

export default function (data) {
  runRealisticUserSession(data);
  sleep(1 + Math.random() * 3);
}

export function handleSummary(data) {
  const vus = Number(__ENV.STEP_VUS || '0');
  if (vus > 0) return createRealisticStepSummary(TEST_NAME)(data);
  return createRealisticCombinedSummary(TEST_NAME)(data);
}
