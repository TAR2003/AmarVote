import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { LedgerDocument } from '../../components/certifiedLedger/LedgerDocument';
import { buildElectionResult, deriveLayoutParams } from './data';
import { registerLedgerFonts } from './fonts';

/**
 * Build Certified Ledger ElectionResult + layout, render client-side PDF, trigger download.
 */
export async function downloadCertifiedLedger(pdfArgs) {
  registerLedgerFonts();
  const result = buildElectionResult(pdfArgs);
  const layout = deriveLayoutParams(result);
  const blob = await pdf(<LedgerDocument result={result} layout={layout} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AmarVote_Certified_Ledger_${result.electionId || 'election'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
