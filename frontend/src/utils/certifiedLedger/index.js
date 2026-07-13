export {
  buildElectionResult,
  deriveLayoutParams,
  truncate,
  chooseVerdictMode,
  violetRamp,
  colorRamp,
  getDonutSliceColors,
  assignChartColors,
  getDonutSliceColorsByWinnerPriority,
  parseDescription,
  groupByRank,
  splitBalanced,
} from './data';

export { downloadCertifiedLedger } from './download';
export { registerLedgerFonts } from './fonts';
export { assertFixedPageSize } from './assertPageSize';
export {
  LETTER_WIDTH_PT,
  LETTER_HEIGHT_PT,
  VIOLET_FAINT,
  GOLD_DEEP,
  GOLD_LIGHT,
  VIOLET_DEEP,
} from './tokens';

/** Drop-in replacement for the former jsPDF exporter. */
export { downloadCertifiedLedger as generateElectionResultsPdf } from './download';
