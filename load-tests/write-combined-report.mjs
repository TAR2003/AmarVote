#!/usr/bin/env node
/**
 * Write combined load-test report (txt + json) from step summary objects.
 *
 * Usage:
 *   node write-combined-report.mjs --test browse --steps-json '[...]' \
 *     --out-txt load-tests/results/browse-combined-report.txt \
 *     --out-json load-tests/results/browse-combined-report.json
 */
import fs from 'fs';
import path from 'path';
import { buildCombinedReportJson, formatCombinedReportText } from './combined-report-format.mjs';

function parseArgs(argv) {
  const args = {
    test: '',
    stepsJson: '[]',
    outTxt: '',
    outJson: '',
    metaJson: '{}',
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--test') args.test = argv[++i] || '';
    else if (arg === '--steps-json') args.stepsJson = argv[++i] || '[]';
    else if (arg === '--steps-file') {
      const file = argv[++i];
      args.stepsJson = fs.readFileSync(file, 'utf8');
    } else if (arg === '--out-txt') args.outTxt = argv[++i] || '';
    else if (arg === '--out-json') args.outJson = argv[++i] || '';
    else if (arg === '--meta-json') args.metaJson = argv[++i] || '{}';
  }

  return args;
}

const args = parseArgs(process.argv);
const steps = JSON.parse(args.stepsJson);
const meta = JSON.parse(args.metaJson);

if (!args.test) {
  console.error('ERROR: --test is required');
  process.exit(1);
}

const reportJson = buildCombinedReportJson(args.test, steps, meta);
const reportText = formatCombinedReportText(args.test, steps, meta);

if (args.outJson) {
  fs.mkdirSync(path.dirname(args.outJson), { recursive: true });
  fs.writeFileSync(args.outJson, JSON.stringify(reportJson, null, 2));
}

if (args.outTxt) {
  fs.mkdirSync(path.dirname(args.outTxt), { recursive: true });
  fs.writeFileSync(args.outTxt, reportText);
}

console.log(reportText);
