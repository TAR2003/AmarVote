/**
 * Report builder for fixed-count vote sequential scenarios.
 */
import { env } from './env.js';
import { buildSingleStepReport, formatSingleStepReportText } from './summary.js';
import { formatCombinedReportText, buildCombinedReportJson } from './combined-report-format.mjs';

function round(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * @param {object} data k6 handleSummary data
 * @param {string} testName
 * @param {number} concurrentVus
 * @param {number} totalVotes
 */
export function formatVoteSequentialReport(data, testName, concurrentVus, totalVotes) {
  const base = buildSingleStepReport(data, testName, concurrentVus);
  const completed = data.metrics.votes_completed?.values?.count ?? 0;
  const skipped = data.metrics.votes_skipped?.values?.count ?? 0;
  const durationSec = data.state?.testRunDurationMs ? data.state.testRunDurationMs / 1000 : null;
  const votesPerMin =
    durationSec && durationSec > 0 ? round((completed / durationSec) * 60, 2) : null;
  const votesPerHour =
    durationSec && durationSec > 0 ? round((completed / durationSec) * 3600, 1) : null;

  const report = {
    ...base,
    mode: 'fixed-count-mixed',
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

/**
 * @param {object} data
 * @param {string} testName
 * @param {number} concurrentVus
 * @param {number} totalVotes
 */
export function createVoteSequentialSummaryOutputs(data, testName, concurrentVus, totalVotes) {
  const { report, text } = formatVoteSequentialReport(data, testName, concurrentVus, totalVotes);
  const combinedMeta = {
    generated_at: report.generated_at,
    base_url: env.baseUrl,
    election_id: env.electionId,
    mode: report.mode,
    concurrent_vus: concurrentVus,
    vote_target: totalVotes,
  };
  const combinedText = formatCombinedReportText(testName, [report], combinedMeta);
  const combinedJson = buildCombinedReportJson(testName, [report], combinedMeta);

  return {
    stdout: combinedText,
    [`load-tests/results/${testName}-report.json`]: JSON.stringify(report, null, 2),
    [`load-tests/results/${testName}-report.txt`]: text,
    [`load-tests/results/${testName}-combined-report.json`]: JSON.stringify(combinedJson, null, 2),
    [`load-tests/results/${testName}-combined-report.txt`]: combinedText,
  };
}
