#!/usr/bin/env node
/**
 * Real-time load test dashboard — tails k6 --out csv=… and prints
 * overall + per-API ok/fail counts every few seconds.
 *
 * Usage (started by run-stepped.sh before k6):
 *   node load-tests/live-reporter.mjs --vus 50 --csv load-tests/results/.live-browse-50.csv
 */
import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const opts = { vus: 0, intervalSec: 3, csv: '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--vus') opts.vus = Number(argv[++i]);
    else if (argv[i] === '--interval') opts.intervalSec = Number(argv[++i]);
    else if (argv[i] === '--csv') opts.csv = argv[++i];
  }
  return opts;
}

const opts = parseArgs(process.argv);
if (!opts.csv) {
  console.error('live-reporter: --csv path required');
  process.exit(1);
}

const totals = { ok: 0, fail: 0 };
/** @type {Map<string, { ok: number, fail: number }>} */
const byApi = new Map();
let sawHeader = false;
let filePos = 0;
let stopped = false;

function apiLabel(metricName) {
  const rest = metricName.replace(/^live_(ok|fail)_/, '');
  return rest.replace(/_/g, '-');
}

function ingestMetric(metricName) {
  if (metricName === 'live_ok_total') {
    totals.ok += 1;
    return;
  }
  if (metricName === 'live_fail_total') {
    totals.fail += 1;
    return;
  }
  const okMatch = metricName.match(/^live_ok_(.+)$/);
  if (okMatch) {
    const api = apiLabel(metricName);
    if (!byApi.has(api)) byApi.set(api, { ok: 0, fail: 0 });
    byApi.get(api).ok += 1;
    return;
  }
  const failMatch = metricName.match(/^live_fail_(.+)$/);
  if (failMatch) {
    const api = apiLabel(metricName);
    if (!byApi.has(api)) byApi.set(api, { ok: 0, fail: 0 });
    byApi.get(api).fail += 1;
  }
}

function readNewBytes() {
  if (stopped || !fs.existsSync(opts.csv)) return;
  const stat = fs.statSync(opts.csv);
  if (stat.size <= filePos) return;

  const fd = fs.openSync(opts.csv, 'r');
  const chunk = Buffer.alloc(stat.size - filePos);
  fs.readSync(fd, chunk, 0, chunk.length, filePos);
  fs.closeSync(fd);
  filePos = stat.size;

  const lines = chunk.toString('utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    if (!sawHeader) {
      sawHeader = true;
      continue;
    }
    const metricName = line.split(',')[0];
    if (metricName.startsWith('live_')) ingestMetric(metricName);
  }
}

function pct(fail, total) {
  if (!total) return '0.00';
  return ((fail / total) * 100).toFixed(2);
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function printSnapshot() {
  const total = totals.ok + totals.fail;
  const failPct = pct(totals.fail, total);
  const elapsed = formatDuration(Date.now() - startedAt);
  const vusLabel = opts.vus > 0 ? `${opts.vus} VUs` : path.basename(opts.csv, '.csv');

  const lines = [];
  lines.push('');
  lines.push(`┌─ LIVE ${elapsed} │ step ${vusLabel} ─────────────────────────────────────`);
  lines.push(
    `│  Overall: ${totals.ok} ok / ${totals.fail} failed (${failPct}% fail) — ${total} requests`,
  );

  const apis = [...byApi.entries()]
    .filter(([, v]) => v.ok + v.fail > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (apis.length) {
    lines.push('│  Per API:');
    for (const [api, v] of apis) {
      const t = v.ok + v.fail;
      lines.push(
        `│    ${api.padEnd(24)} ${String(v.ok).padStart(6)} ok / ${String(v.fail).padStart(5)} fail (${pct(v.fail, t)}%)`,
      );
    }
  } else if (total === 0) {
    lines.push('│  (waiting for first requests…)');
  }

  lines.push('└────────────────────────────────────────────────────────────────');
  process.stdout.write(`${lines.join('\n')}\n`);
}

const startedAt = Date.now();
let lastPrint = 0;

const poll = setInterval(() => {
  readNewBytes();
  const now = Date.now();
  if (now - lastPrint >= opts.intervalSec * 1000) {
    lastPrint = now;
    printSnapshot();
  }
}, 500);

function shutdown() {
  if (stopped) return;
  stopped = true;
  clearInterval(poll);
  readNewBytes();
  printSnapshot();
  process.stdout.write('\n── Live reporter finished ──\n');
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
