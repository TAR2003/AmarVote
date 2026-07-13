import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { LedgerDocument } from '../../components/certifiedLedger/LedgerDocument';
import { assertFixedPageSize } from './assertPageSize';
import { buildElectionResult, deriveLayoutParams } from './data';
import { registerLedgerFonts } from './fonts';
import { attachCandidateImageData } from './images';

/**
 * Build Certified Ledger ElectionResult + layout, render client-side PDF, trigger download.
 */
export async function downloadCertifiedLedger(pdfArgs) {
  registerLedgerFonts();
  const result = buildElectionResult(pdfArgs);
  // Prefetch photos as data URLs so react-pdf Image gets absolute/embeddable sources.
  // Failed fetches leave imageDataUrl null → initials fallback in CandidateAvatar.
  result.candidates = await attachCandidateImageData(result.candidates);
  const layout = deriveLayoutParams(result);
  const blob = await pdf(<LedgerDocument result={result} layout={layout} />).toBlob();

  // Guardrail: never ship shrink-to-content pages (react-pdf yoga quirk).
  try {
    await assertFixedPageSize(blob);
  } catch (err) {
    console.error(err);
    throw new Error(
      `Certified Ledger page geometry invalid: ${err.message}. Export aborted.`,
    );
  }

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
