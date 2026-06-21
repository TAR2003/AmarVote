/**
 * Shared text/JSON formatting for multi-step load test combined reports.
 * Used by k6 handleSummary hooks and write-combined-report.mjs (Node).
 */

function padRight(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

export function formatApiTimingLine(api) {
  const total = api.http_requests_total ?? api.http_requests_ok + api.http_requests_failed;
  return (
    `${total} completed (${api.http_requests_ok} ok / ${api.http_requests_failed} failed, ${api.http_fail_rate_pct}% fail)` +
    `  avg ${api.avg_duration_ms}ms  p95 ${api.p95_duration_ms}ms`
  );
}

function formatFailureBreakdown(step) {
  const lines = [];
  if (step.failure_breakdown?.length) {
    lines.push('  Failure breakdown');
    for (const row of step.failure_breakdown) {
      lines.push(`    ${row.label}: ${row.count}`);
    }
  }
  return lines;
}

function formatVoteExtras(step) {
  const lines = [];
  const isVoteRun =
    step.mode === 'fixed-count' ||
    step.mode === 'fixed-count-mixed' ||
    step.mode === 'realistic-journey' ||
    step.mode === 'realistic-journey-sequential' ||
    step.votes_completed != null ||
    step.journey != null;
  if (!isVoteRun) return lines;

  lines.push('  Vote throughput');
  if (step.concurrent_vus != null) {
    lines.push(`    Concurrent VUs     : ${step.concurrent_vus}`);
  }
  if (step.mode === 'realistic-journey-sequential' && step.session_target != null) {
    lines.push(`    Session target     : ${step.session_target}`);
  }
  if (step.vote_target != null) {
    lines.push(`    Target votes       : ${step.vote_target}`);
  }
  const votesCompleted = step.votes_completed ?? step.journey?.votes_completed;
  if (votesCompleted != null) {
    lines.push(`    Votes completed    : ${votesCompleted}`);
  }
  if (step.votes_skipped != null) {
    lines.push(`    Votes skipped      : ${step.votes_skipped} (already voted / ineligible)`);
  }
  if (step.test_duration_sec != null) {
    lines.push(`    Wall time          : ${step.test_duration_sec}s`);
  }
  if (step.throughput_votes_per_min != null) {
    lines.push(
      `    Throughput         : ${step.throughput_votes_per_min} votes/min` +
        (step.throughput_votes_per_hour != null ? `  (${step.throughput_votes_per_hour}/hr)` : ''),
    );
  }
  if (step.encrypt_avg_ms != null) {
    lines.push(`    Encrypt latency    : avg ${step.encrypt_avg_ms}ms  p95 ${step.encrypt_p95_ms}ms`);
  }
  if (step.cast_avg_ms != null) {
    lines.push(`    Cast latency       : avg ${step.cast_avg_ms}ms  p95 ${step.cast_p95_ms}ms`);
  }
  if (step.cycle_avg_ms != null) {
    lines.push(`    Full cycle         : avg ${step.cycle_avg_ms}ms  p95 ${step.cycle_p95_ms}ms`);
  }
  return lines;
}

/**
 * Full detail block for one step (same information as per-step report).
 * @param {object} step
 */
export function formatStepDetailSection(step) {
  const lines = [];
  const bar = '─'.repeat(62);
  const vus = step.vus ?? step.concurrent_vus ?? '?';
  const status = step.status ?? (step.http_fail_rate_pct < 5 ? 'PASS' : 'FAIL');

  lines.push('');
  lines.push(`${bar}`);
  lines.push(`  STEP — ${vus} VUs [${status}]`);
  if (step.generated_at) {
    lines.push(`  Recorded: ${step.generated_at}`);
  }
  lines.push(`${bar}`);
  lines.push('');
  lines.push('  Overall');
  lines.push(`    HTTP requests : ${step.http_requests_total} total`);
  lines.push(
    `                    ${step.http_requests_ok} ok / ${step.http_requests_failed} failed (${step.http_fail_rate_pct}% fail)`,
  );

  if (step.http_429_count > 0) {
    lines.push(`    HTTP 429        : ${step.http_429_count} (nginx rate limit)`);
  }
  if (step.encrypt_invalid_candidate > 0) {
    lines.push(`    Invalid candidate: ${step.encrypt_invalid_candidate}`);
  }
  if (step.encrypt_business_reject > 0) {
    lines.push(`    Encrypt HTTP 400  : ${step.encrypt_business_reject} (validation / already voted)`);
  }
  if (step.encrypt_transient_fail > 0) {
    lines.push(`    Encrypt gateway   : ${step.encrypt_transient_fail} (502/503/429 after retries)`);
  }

  lines.push(...formatFailureBreakdown(step));

  if (step.checks_passed != null) {
    lines.push(
      `    Checks          : ${step.checks_passed} passed / ${step.checks_failed} failed (${step.checks_pass_rate_pct}% pass)`,
    );
  }
  lines.push(`    Latency         : avg ${step.avg_duration_ms}ms  p95 ${step.p95_duration_ms}ms`);
  lines.push('');

  if (step.apis?.length) {
    lines.push('  Per API endpoint (completed · avg / p95 latency)');
    for (const api of step.apis) {
      lines.push(`    ${api.api}`);
      lines.push(`      ${formatApiTimingLine(api)}`);
    }
    lines.push('');
  }

  const voteLines = formatVoteExtras(step);
  if (voteLines.length) {
    lines.push(...voteLines);
    lines.push('');
  }

  if (step.journey) {
    lines.push('  User journey (observed)');
    lines.push(`    Total sessions     : ${step.journey.user_sessions}`);
    lines.push(`    Browse only        : ${step.journey.browse_only_sessions}`);
    lines.push(`    Eligibility only   : ${step.journey.eligibility_only_sessions}`);
    lines.push(`    Votes completed    : ${step.journey.votes_completed}`);
    lines.push(`    Vote abandoned     : ${step.journey.votes_abandoned}`);
    lines.push(`    Multi-encrypt users: ${step.journey.extra_encrypt_users}`);
    lines.push(`    Encrypt API calls  : ${step.journey.encrypt_attempts_total}`);
    if (step.journey.avg_encrypt_per_voting_session != null) {
      lines.push(`    Avg encrypt/voter  : ${step.journey.avg_encrypt_per_voting_session}`);
    }
    lines.push('');
  }

  if (status === 'FAIL') {
    lines.push('  ⚠ Failure rate ≥ 5% — approximate capacity ceiling for this step.');
  } else {
    lines.push('  ✓ Step healthy (< 5% HTTP failures).');
  }

  return lines;
}

function formatOverviewTable(steps) {
  const lines = [];
  lines.push('  OVERVIEW (all steps)');
  lines.push('  ' + '─'.repeat(58));
  lines.push(
    '  ' +
      padRight('VUs', 7) +
      padRight('Status', 8) +
      padRight('HTTP ok', 10) +
      padRight('HTTP fail', 11) +
      padRight('Fail%', 8) +
      padRight('Avg(ms)', 10) +
      'P95(ms)',
  );
  lines.push('  ' + '─'.repeat(58));

  for (const step of steps) {
    const vus = step.vus ?? step.concurrent_vus ?? '?';
    const status = step.status ?? (step.http_fail_rate_pct < 5 ? 'PASS' : 'FAIL');
    lines.push(
      '  ' +
        padRight(vus, 7) +
        padRight(status, 8) +
        padRight(step.http_requests_ok ?? '-', 10) +
        padRight(step.http_requests_failed ?? '-', 11) +
        padRight(step.http_fail_rate_pct ?? '-', 8) +
        padRight(step.avg_duration_ms ?? '-', 10) +
        (step.p95_duration_ms ?? '-'),
    );
  }
  lines.push('');
  return lines;
}

function formatApiOverviewTable(steps) {
  const apiNames = new Set();
  for (const step of steps) {
    for (const api of step.apis || []) {
      apiNames.add(api.api);
    }
  }
  if (!apiNames.size) return [];

  const sortedApis = [...apiNames].sort();
  const lines = [];
  lines.push('  PER-API SUMMARY (completed requests · avg / p95 ms by step)');
  lines.push('  ' + '─'.repeat(58));

  for (const apiName of sortedApis) {
    lines.push(`    ${apiName}`);
    for (const step of steps) {
      const api = (step.apis || []).find((a) => a.api === apiName);
      if (!api) continue;
      const vus = step.vus ?? step.concurrent_vus ?? '?';
      const total = api.http_requests_total ?? api.http_requests_ok + api.http_requests_failed;
      lines.push(
        `      ${padRight(String(vus) + ' VUs', 10)}` +
          `${padRight(String(total) + ' req', 12)}` +
          `avg ${padRight(api.avg_duration_ms ?? '-', 8)}` +
          `p95 ${api.p95_duration_ms ?? '-'}`,
      );
    }
    lines.push('');
  }
  return lines;
}

/**
 * @param {string} testName
 * @param {object[]} steps
 * @param {object} [meta]
 */
export function formatCombinedReportText(testName, steps, meta = {}) {
  const lines = [];
  const bar = '═'.repeat(62);

  lines.push('');
  lines.push(bar);
  lines.push(`  FINAL COMBINED REPORT — ${testName}`);
  lines.push(bar);
  lines.push(`  Generated : ${meta.generated_at || new Date().toISOString()}`);
  if (meta.base_url) lines.push(`  Target    : ${meta.base_url}`);
  if (meta.election_id != null) lines.push(`  Election  : ${meta.election_id}`);
  if (steps.length) {
    const vusList = steps.map((s) => s.vus ?? s.concurrent_vus).filter((v) => v != null);
    if (vusList.length) lines.push(`  VU steps  : ${vusList.join(', ')}`);
  }
  if (meta.stage_ramp) lines.push(`  Ramp/hold : ${meta.stage_ramp} ramp + ${meta.stage_hold || '?'} hold per step`);
  if (meta.mode) lines.push(`  Mode      : ${meta.mode}`);
  lines.push('');

  lines.push(...formatOverviewTable(steps));
  lines.push(...formatApiOverviewTable(steps));

  lines.push(bar);
  lines.push('  STEP DETAILS');
  lines.push(bar);

  for (const step of steps) {
    lines.push(...formatStepDetailSection(step));
  }

  const failedSteps = steps.filter((s) => (s.status ?? (s.http_fail_rate_pct < 5 ? 'PASS' : 'FAIL')) === 'FAIL');
  lines.push('');
  lines.push(bar);
  if (failedSteps.length) {
    lines.push(`  RESULT: ${failedSteps.length}/${steps.length} step(s) exceeded 5% HTTP failure rate.`);
  } else if (steps.length) {
    lines.push(`  RESULT: All ${steps.length} step(s) passed (< 5% HTTP failures).`);
  } else {
    lines.push('  RESULT: No step data recorded.');
  }
  lines.push(bar);
  lines.push('');

  return lines.join('\n');
}

/**
 * @param {string} testName
 * @param {object[]} steps
 * @param {object} [meta]
 */
export function buildCombinedReportJson(testName, steps, meta = {}) {
  return {
    generated_at: meta.generated_at || new Date().toISOString(),
    test: testName,
    meta,
    steps,
    overview: steps.map((step) => ({
      vus: step.vus ?? step.concurrent_vus,
      status: step.status ?? (step.http_fail_rate_pct < 5 ? 'PASS' : 'FAIL'),
      http_requests_ok: step.http_requests_ok,
      http_requests_failed: step.http_requests_failed,
      http_fail_rate_pct: step.http_fail_rate_pct,
      avg_duration_ms: step.avg_duration_ms,
      p95_duration_ms: step.p95_duration_ms,
      apis: step.apis,
    })),
  };
}
