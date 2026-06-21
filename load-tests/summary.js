/**
 * Per-step and per-API load test reports.
 */
import { collectFailureCounters } from './failure-log.js';
import { API_NAMES, apiMetricKey } from './metrics.js';
import { formatApiTimingLine, formatCombinedReportText, buildCombinedReportJson } from './combined-report-format.mjs';

export { formatApiTimingLine, formatCombinedReportText, buildCombinedReportJson };

function round(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function findSubmetric(metric, needle) {
  if (!metric?.submetrics) return null;
  return metric.submetrics.find((s) => s.name.includes(needle)) || null;
}

function durationStats(metric) {
  return {
    avg_duration_ms: round(metric?.values?.avg),
    p95_duration_ms: round(metric?.values?.['p(95)']),
  };
}

function upsertApiRow(byName, api, patch) {
  const existing = byName.get(api) || {
    api,
    http_requests_total: 0,
    http_requests_ok: 0,
    http_requests_failed: 0,
    http_fail_rate_pct: 0,
    avg_duration_ms: null,
    p95_duration_ms: null,
  };
  byName.set(api, { ...existing, ...patch });
}

function extractCustomApiRows(metrics, byName) {
  for (const api of API_NAMES) {
    const key = apiMetricKey(api);
    const ok = metrics[`live_ok_${key}`]?.values?.count ?? 0;
    const failed = metrics[`live_fail_${key}`]?.values?.count ?? 0;
    const total = ok + failed;
    const durationMetric = metrics[`api_duration_${key}`];
    const hasDuration = (durationMetric?.values?.count ?? 0) > 0;
    if (total === 0 && !hasDuration) continue;

    upsertApiRow(byName, api, {
      http_requests_total: total,
      http_requests_ok: ok,
      http_requests_failed: failed,
      http_fail_rate_pct: round(total > 0 ? (failed / total) * 100 : 0),
      ...durationStats(durationMetric),
    });
  }
}

function extractTaggedApiRows(metrics, byName) {
  for (const metricKey of Object.keys(metrics)) {
    const match = metricKey.match(/^http_reqs\{name:([^}]+)\}$/);
    if (!match) continue;

    const api = match[1].trim();
    const total = metrics[metricKey]?.values?.count ?? 0;
    if (total === 0) continue;

    const failedMetric = metrics[`http_req_failed{name:${api}}`];
    const durationMetric = metrics[`http_req_duration{name:${api}}`];
    const failRate = failedMetric?.values?.rate ?? 0;
    const failed = Math.round(total * failRate);

    upsertApiRow(byName, api, {
      http_requests_total: total,
      http_requests_ok: total - failed,
      http_requests_failed: failed,
      http_fail_rate_pct: round(failRate * 100),
      ...durationStats(durationMetric),
    });
  }
}

function extractLegacySubmetricRows(metrics, byName) {
  for (const sub of metrics.http_reqs?.submetrics || []) {
    const match = sub.name.match(/name:([^,}]+)/);
    if (!match) continue;

    const api = match[1].trim();
    const total = sub.values?.count ?? 0;
    if (total === 0) continue;

    const failedMetric = findSubmetric(metrics.http_req_failed, `name:${api}`);
    const durationMetric = findSubmetric(metrics.http_req_duration, `name:${api}`);
    const failRate = failedMetric?.values?.rate ?? 0;
    const failed = Math.round(total * failRate);

    upsertApiRow(byName, api, {
      http_requests_total: total,
      http_requests_ok: total - failed,
      http_requests_failed: failed,
      http_fail_rate_pct: round(failRate * 100),
      ...durationStats(durationMetric),
    });
  }
}

function extractApiBreakdown(metrics) {
  const byName = new Map();
  extractCustomApiRows(metrics, byName);
  extractTaggedApiRows(metrics, byName);
  extractLegacySubmetricRows(metrics, byName);

  return [...byName.values()]
    .filter((row) => row.http_requests_total > 0 || row.avg_duration_ms != null)
    .sort((a, b) => a.api.localeCompare(b.api));
}


function buildAggregateRow(metrics) {
  const total = metrics.http_reqs?.values?.count ?? 0;
  const failRate = metrics.http_req_failed?.values?.rate ?? 0;
  const failed = Math.round(total * failRate);
  const s429 = metrics.status_429?.values?.count ?? metrics.live_http_429?.values?.count ?? 0;
  const businessReject = metrics.encrypt_business_reject?.values?.count ?? 0;
  const transientFail = metrics.encrypt_transient_fail?.values?.count ?? 0;
  const invalidCandidate = metrics.encrypt_invalid_candidate?.values?.count ?? 0;

  return {
    http_requests_total: total,
    http_requests_ok: total - failed,
    http_requests_failed: failed,
    http_fail_rate_pct: round(failRate * 100),
    http_429_count: s429,
    encrypt_business_reject: businessReject,
    encrypt_transient_fail: transientFail,
    encrypt_invalid_candidate: invalidCandidate,
    checks_passed: metrics.checks?.values?.passes ?? null,
    checks_failed: metrics.checks?.values?.fails ?? null,
    checks_pass_rate_pct:
      metrics.checks?.values?.rate != null ? round(metrics.checks.values.rate * 100) : null,
    avg_duration_ms: round(metrics.http_req_duration?.values?.avg),
    p95_duration_ms: round(metrics.http_req_duration?.values?.['p(95)']),
  };
}

export function buildSingleStepReport(data, testName, vus) {
  const aggregate = buildAggregateRow(data.metrics);
  const apis = extractApiBreakdown(data.metrics);
  const failureBreakdown = collectFailureCounters(data.metrics);
  const passed = aggregate.http_fail_rate_pct < 5;

  return {
    generated_at: new Date().toISOString(),
    test: testName,
    vus,
    status: passed ? 'PASS' : 'FAIL',
    ...aggregate,
    apis,
    failure_breakdown: failureBreakdown,
  };
}

export function formatSingleStepReportText(report) {
  const lines = [];
  const bar = '═'.repeat(62);
  lines.push('');
  lines.push(`╔${bar}╗`);
  lines.push(`║  STEP COMPLETE — ${report.vus} VUs — ${report.test}`.padEnd(63) + '║');
  lines.push(`║  Result: ${report.status}`.padEnd(63) + '║');
  lines.push(`╚${bar}╝`);
  lines.push('');
  lines.push('  Overall');
  lines.push(`    HTTP requests : ${report.http_requests_total} total`);
  lines.push(
    `                    ${report.http_requests_ok} ok / ${report.http_requests_failed} failed (${report.http_fail_rate_pct}% fail)`,
  );
  if (report.http_429_count > 0) {
    lines.push(`    HTTP 429        : ${report.http_429_count} (nginx rate limit)`);
  }
  if (report.encrypt_invalid_candidate > 0) {
    lines.push(
      `    Invalid candidate: ${report.encrypt_invalid_candidate} (API/choice mismatch — check election ${report.election_id ?? '?'})`,
    );
  }
  if (report.encrypt_business_reject > 0) {
    lines.push(`    Encrypt HTTP 400  : ${report.encrypt_business_reject} (validation / already voted)`);
  }
  if (report.encrypt_transient_fail > 0) {
    lines.push(`    Encrypt gateway   : ${report.encrypt_transient_fail} (502/503/429 after retries)`);
  }
  if (report.failure_breakdown?.length) {
    lines.push('    Failure breakdown (see [VOTE-FAIL] lines in k6 output for each event):');
    for (const row of report.failure_breakdown) {
      lines.push(`      ${row.label}: ${row.count}`);
    }
  }
  if (report.checks_passed != null) {
    lines.push(
      `    Checks          : ${report.checks_passed} passed / ${report.checks_failed} failed (${report.checks_pass_rate_pct}% pass)`,
    );
  }
  lines.push(`    Latency         : avg ${report.avg_duration_ms}ms  p95 ${report.p95_duration_ms}ms`);
  lines.push('');

  if (report.apis.length) {
    lines.push('  Per API endpoint (avg / p95 latency)');
    for (const api of report.apis) {
      lines.push(`    ${api.api}`);
      lines.push(`      ${formatApiTimingLine(api)}`);
    }
    lines.push('');
  }

  if (report.status === 'FAIL') {
    lines.push('  ⚠ Failure rate ≥ 5% — consider this the approximate capacity ceiling.');
  } else {
    lines.push('  ✓ Step healthy (< 5% HTTP failures).');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Summary handler for one VU step (STEP_VUS env set by run-stepped.sh).
 */
export function createSingleStepSummary(testName) {
  return function handleSummary(data) {
    const vus = Number(__ENV.STEP_VUS || '0');
    const report = buildSingleStepReport(data, testName, vus);
    const text = formatSingleStepReportText(report);

    const jsonPath = `load-tests/results/${testName}-step-${vus}-report.json`;
    const txtPath = `load-tests/results/${testName}-step-${vus}-report.txt`;

    const outputs = {
      [jsonPath]: JSON.stringify(report, null, 2),
      [txtPath]: text,
    };
    // Stepped runner prints the saved report after each step (avoids duplicate).
    return outputs;
  };
}

/**
 * Summary for full multi-step run (legacy single k6 invocation).
 */
export function createStepSummary(testName) {
  return function handleSummary(data) {
    const steps = [];
    for (const sub of data.metrics.http_reqs?.submetrics || []) {
      const match = sub.name.match(/scenario:vus_(\d+)/);
      if (!match) continue;
      const vus = Number(match[1]);
      const tag = `scenario:vus_${vus}`;
      const row = {
        vus,
        http_requests_total: sub.values?.count ?? 0,
      };
      const failed = findSubmetric(data.metrics.http_req_failed, tag);
      const failRate = failed?.values?.rate ?? 0;
      row.http_requests_failed = Math.round(row.http_requests_total * failRate);
      row.http_requests_ok = row.http_requests_total - row.http_requests_failed;
      row.http_fail_rate_pct = round(failRate * 100);
      steps.push(row);
    }
    steps.sort((a, b) => a.vus - b.vus);

    const text = formatCombinedReport(testName, steps, {
      generated_at: new Date().toISOString(),
      mode: 'single-k6-run',
    });
    const combinedJson = buildCombinedReportJson(testName, steps, { mode: 'single-k6-run' });
    return {
      stdout: text,
      [`load-tests/results/${testName}-step-report.json`]: JSON.stringify({ test: testName, steps }, null, 2),
      [`load-tests/results/${testName}-step-report.txt`]: text,
      [`load-tests/results/${testName}-combined-report.json`]: JSON.stringify(combinedJson, null, 2),
      [`load-tests/results/${testName}-combined-report.txt`]: text,
    };
  };
}

export function formatCombinedReport(testName, stepSummaries, meta = {}) {
  return formatCombinedReportText(testName, stepSummaries, meta);
}

export function createSimpleSummary(testName) {
  return function handleSummary(data) {
    const report = buildSingleStepReport(data, testName, 0);
    const lines = [
      '',
      `── ${testName} summary ──`,
      `  HTTP: ${report.http_requests_ok} ok / ${report.http_requests_failed} failed (${report.http_fail_rate_pct}%)`,
      `  HTTP 429: ${report.http_429_count}${report.http_429_count > 0 ? ' ← nginx limit' : ''}`,
    ];
    if (report.checks_passed != null) {
      lines.push(`  Checks: ${report.checks_passed} passed / ${report.checks_failed} failed`);
    }
    lines.push('');
    return {
      stdout: lines.join('\n'),
      [`load-tests/results/${testName}-report.json`]: JSON.stringify(report, null, 2),
      [`load-tests/results/${testName}-report.txt`]: lines.join('\n'),
    };
  };
}
