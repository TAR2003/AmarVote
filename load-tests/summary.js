/**
 * Per-step and per-API load test reports.
 */
import { collectFailureCounters } from './failure-log.js';

function round(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function findSubmetric(metric, needle) {
  if (!metric?.submetrics) return null;
  return metric.submetrics.find((s) => s.name.includes(needle)) || null;
}

function extractApiBreakdown(metrics) {
  const byName = new Map();

  for (const sub of metrics.http_reqs?.submetrics || []) {
    const match = sub.name.match(/name:([^,}]+)/);
    if (!match) continue;
    const api = match[1].trim();
    const total = sub.values?.count ?? 0;
    const failedMetric = findSubmetric(metrics.http_req_failed, `name:${api}`);
    const durationMetric = findSubmetric(metrics.http_req_duration, `name:${api}`);
    const failRate = failedMetric?.values?.rate ?? 0;
    const failed = Math.round(total * failRate);
    byName.set(api, {
      api,
      http_requests_total: total,
      http_requests_ok: total - failed,
      http_requests_failed: failed,
      http_fail_rate_pct: round(failRate * 100),
      avg_duration_ms: round(durationMetric?.values?.avg),
      p95_duration_ms: round(durationMetric?.values?.['p(95)']),
    });
  }

  return [...byName.values()].sort((a, b) => a.api.localeCompare(b.api));
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
    lines.push('  Per API endpoint');
    for (const api of report.apis) {
      lines.push(`    ${api.api}`);
      lines.push(
        `      ${api.http_requests_ok} ok / ${api.http_requests_failed} failed (${api.http_fail_rate_pct}%)` +
          `  avg ${api.avg_duration_ms}ms  p95 ${api.p95_duration_ms}ms`,
      );
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

    const text = formatCombinedReport(testName, steps);
    return {
      stdout: text,
      [`load-tests/results/${testName}-step-report.json`]: JSON.stringify({ test: testName, steps }, null, 2),
      [`load-tests/results/${testName}-step-report.txt`]: text,
    };
  };
}

export function formatCombinedReport(testName, stepSummaries) {
  const lines = [];
  lines.push('');
  lines.push('══════════════════════════════════════════════════════════════');
  lines.push(`  COMBINED REPORT — ${testName}`);
  lines.push('══════════════════════════════════════════════════════════════');
  for (const s of stepSummaries) {
    const status = s.http_fail_rate_pct < 5 ? 'PASS' : 'FAIL';
    lines.push(
      `  ${s.vus} VUs [${status}]: ${s.http_requests_ok} ok / ${s.http_requests_failed} failed (${s.http_fail_rate_pct}%)`,
    );
  }
  lines.push('══════════════════════════════════════════════════════════════');
  lines.push('');
  return lines.join('\n');
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
