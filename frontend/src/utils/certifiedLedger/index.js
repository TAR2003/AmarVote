export {
  buildElectionResult,
  deriveLayoutParams,
  truncate,
  chooseVerdictMode,
  violetRamp,
  parseDescription,
  groupByRank,
  splitBalanced,
} from './data';

export { downloadCertifiedLedger } from './download';
export { registerLedgerFonts } from './fonts';

/** Drop-in replacement for the former jsPDF exporter. */
export { downloadCertifiedLedger as generateElectionResultsPdf } from './download';
