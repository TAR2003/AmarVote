import { PDFDocument } from 'pdf-lib';
import { LETTER_HEIGHT_PT, LETTER_WIDTH_PT } from './tokens';

/**
 * Assert every page MediaBox is hard-fixed US Letter (612×792pt).
 * Catches shrink-to-content page geometry before a ledger ships.
 *
 * @param {ArrayBuffer|Uint8Array|Blob} pdfBytes
 */
export async function assertFixedPageSize(pdfBytes) {
  let bytes = pdfBytes;
  if (typeof Blob !== 'undefined' && pdfBytes instanceof Blob) {
    bytes = new Uint8Array(await pdfBytes.arrayBuffer());
  }
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  if (!pages.length) {
    throw new Error('PDF has no pages');
  }
  for (let i = 0; i < pages.length; i += 1) {
    const { width, height } = pages[i].getSize();
    if (width !== LETTER_WIDTH_PT || height !== LETTER_HEIGHT_PT) {
      throw new Error(
        `Page size drift detected on page ${i + 1}: ${width}x${height}, expected ${LETTER_WIDTH_PT}x${LETTER_HEIGHT_PT}`,
      );
    }
  }
  return true;
}
