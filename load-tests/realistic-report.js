/**
 * Reporting for realistic user-journey load tests.
 */
import { env } from './env.js';
import {
  buildSingleStepReport,
  formatSingleStepReportText,
  buildCombinedReportJson,
} from './summary.js';
import { formatCombinedReportText } from './combined-report-format.mjs';
import { realisticConfig } from './realistic-config.js';

function round(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function collectJourneyStats(metrics) {
  const sessions = metrics.iterations?.values?.count ?? 0;
  const browseOnly = metrics.journey_browse_only?.values?.count ?? 0;
  const eligibilityOnly = metrics.journey_eligibility_only?.values?.count ?? 0;
  const votesCompleted = metrics.journey_votes_completed?.values?.count ?? 0;
  const votesAbandoned = metrics.journey_votes_abandoned?.values?.count ?? 0;
  const ineligible = metrics.journey_ineligible?.values?.count ?? 0;
  const alreadyVoted = metrics.journey_already_voted?.values?.count ?? 0;
  const extraEncryptUsers = metrics.journey_extra_encrypt_users?.values?.count ?? 0;
  const encryptAttempts = metrics.journey_encrypt_attempts_total?.values?.count ?? 0;
  const voteAttempts = votesCompleted + votesAbandoned + alreadyVoted;

  return {
    user_sessions: sessions,
    browse_only_sessions: browseOnly,
    eligibility_only_sessions: eligibilityOnly,
    votes_completed: votesCompleted,
    votes_abandoned: votesAbandoned,
    ineligible_sessions: ineligible,
    already_voted_sessions: alreadyVoted,
    extra_encrypt_users: extraEncryptUsers,
    encrypt_attempts_total: encryptAttempts,
    avg_encrypt_per_voting_session:
      voteAttempts > 0 ? round(encryptAttempts / voteAttempts, 2) : null,
    session_duration_avg_ms: round(metrics.journey_session_duration?.values?.avg),
    session_duration_p95_ms: round(metrics.journey_session_duration?.values?.['p(95)']),
    encrypt_duration_avg_ms: round(metrics.journey_encrypt_duration?.values?.avg),
    encrypt_duration_p95_ms: round(metrics.journey_encrypt_duration?.values?.['p(95)']),
    cast_duration_avg_ms: round(metrics.journey_cast_duration?.values?.avg),
    cast_duration_p95_ms: round(metrics.journey_cast_duration?.values?.['p(95)']),
    realistic_config: realisticConfig(),
  };
}

export function formatJourneyStatsText(journey) {
  const lines = [];
  const cfg = journey.realistic_config;
  lines.push('  User journey mix (configured)');
  lines.push(`    Browse only        : ${cfg.browseOnlyPct}%`);
  lines.push(`    Eligibility only   : ${cfg.eligibilityOnlyPct}%`);
  lines.push(`    Full vote path     : ${cfg.votePct}%`);
  lines.push(`    Extra encrypt test : ${cfg.extraEncryptPct}% (up to +${cfg.extraEncryptMax} retries)`);
  lines.push('');
  lines.push('  User sessions observed');
  lines.push(`    Total sessions     : ${journey.user_sessions}`);
  lines.push(`    Browse only        : ${journey.browse_only_sessions}`);
  lines.push(`    Eligibility only   : ${journey.eligibility_only_sessions}`);
  lines.push(`    Votes completed    : ${journey.votes_completed}`);
  lines.push(`    Vote abandoned     : ${journey.votes_abandoned} (encrypt/cast failed)`);
  lines.push(`    Ineligible         : ${journey.ineligible_sessions}`);
  lines.push(`    Already voted      : ${journey.already_voted_sessions}`);
  lines.push(`    Multi-encrypt users: ${journey.extra_encrypt_users} (tried ballot before casting)`);
  lines.push(`    Encrypt API calls  : ${journey.encrypt_attempts_total} total`);
  if (journey.avg_encrypt_per_voting_session != null) {
    lines.push(`    Avg encrypt/voter  : ${journey.avg_encrypt_per_voting_session} (1.0 = never retried)`);
  }
  lines.push('');
  lines.push('  Journey latency');
  lines.push(
    `    Full session       : avg ${journey.session_duration_avg_ms}ms  p95 ${journey.session_duration_p95_ms}ms`,
  );
  lines.push(
    `    Encrypt step       : avg ${journey.encrypt_duration_avg_ms}ms  p95 ${journey.encrypt_duration_p95_ms}ms`,
  );
  lines.push(
    `    Cast step          : avg ${journey.cast_duration_avg_ms}ms  p95 ${journey.cast_duration_p95_ms}ms`,
  );
  lines.push('');
  lines.push('  API call order (full vote path)');
  lines.push('    session → all-elections → election-detail → eligibility');
  lines.push('    → create-encrypted-ballot (1× usual, 2–3× for testers) → cast-encrypted-ballot (once)');
  lines.push('');
  return lines.join('\n');
}

export function buildRealisticStepReport(data, testName, vus) {
  const base = buildSingleStepReport(data, testName, vus);
  const journey = collectJourneyStats(data.metrics);
  return {
    ...base,
    mode: 'realistic-journey',
    journey,
  };
}

export function formatRealisticStepReportText(report) {
  const lines = [
    formatSingleStepReportText(report),
    formatJourneyStatsText(report.journey),
  ];
  return lines.join('\n');
}

export function createRealisticStepSummary(testName) {
  return function handleSummary(data) {
    const vus = Number(__ENV.STEP_VUS || '0');
    const report = buildRealisticStepReport(data, testName, vus);
    const text = formatRealisticStepReportText(report);

    return {
      [`load-tests/results/${testName}-step-${vus}-report.json`]: JSON.stringify(report, null, 2),
      [`load-tests/results/${testName}-step-${vus}-report.txt`]: text,
    };
  };
}

export function createRealisticCombinedSummary(testName) {
  return function handleSummary(data) {
    const report = buildRealisticStepReport(data, testName, 0);
    const text = formatRealisticStepReportText(report);
    return {
      stdout: text,
      [`load-tests/results/${testName}-step-report.json`]: JSON.stringify(report, null, 2),
      [`load-tests/results/${testName}-step-report.txt`]: text,
    };
  };
}

export function createRealisticSequentialSummary(testName, concurrentVus, totalSessions) {
  return function handleSummary(data) {
    const report = buildRealisticStepReport(data, testName, concurrentVus);
    report.concurrent_vus = concurrentVus;
    report.session_target = totalSessions;
    report.test_duration_sec = round(
      data.state?.testRunDurationMs ? data.state.testRunDurationMs / 1000 : null,
    );

    const stepText = formatRealisticStepReportText(report);
    const combinedMeta = {
      generated_at: report.generated_at,
      base_url: env.baseUrl,
      election_id: env.electionId,
      mode: 'realistic-journey-sequential',
      concurrent_vus: concurrentVus,
      session_target: totalSessions,
    };
    const combinedText = formatCombinedReportText(testName, [report], combinedMeta);
    const combinedJson = buildCombinedReportJson(testName, [report], combinedMeta);

    return {
      stdout: combinedText,
      [`load-tests/results/${testName}-report.json`]: JSON.stringify(report, null, 2),
      [`load-tests/results/${testName}-report.txt`]: stepText,
      [`load-tests/results/${testName}-combined-report.json`]: JSON.stringify(combinedJson, null, 2),
      [`load-tests/results/${testName}-combined-report.txt`]: combinedText,
    };
  };
}
