import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { assertFixedPageSize } from '../certifiedLedger/assertPageSize';
import { LETTER_HEIGHT_PT, LETTER_WIDTH_PT } from '../certifiedLedger/tokens';

describe('assertFixedPageSize', () => {
  it('passes when every page is US Letter', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([LETTER_WIDTH_PT, LETTER_HEIGHT_PT]);
    doc.addPage([LETTER_WIDTH_PT, LETTER_HEIGHT_PT]);
    const bytes = await doc.save();
    await expect(assertFixedPageSize(bytes)).resolves.toBe(true);
  });

  it('throws on shrink-to-content page heights', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([LETTER_WIDTH_PT, LETTER_HEIGHT_PT]);
    doc.addPage([LETTER_WIDTH_PT, 356]);
    const bytes = await doc.save();
    await expect(assertFixedPageSize(bytes)).rejects.toThrow(/Page size drift/);
  });
});
