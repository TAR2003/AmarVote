import { Font } from '@react-pdf/renderer';

import fraunces400 from '@fontsource/fraunces/files/fraunces-latin-400-normal.woff?url';
import fraunces500 from '@fontsource/fraunces/files/fraunces-latin-500-normal.woff?url';
import fraunces400Italic from '@fontsource/fraunces/files/fraunces-latin-400-italic.woff?url';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url';
import inter400Italic from '@fontsource/inter/files/inter-latin-400-italic.woff?url';
import mono400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url';
import mono500 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff?url';

let registered = false;

/**
 * Register static font cuts once before any PDF render.
 * Bundled via @fontsource (WOFF) — fontkit in @react-pdf supports WOFF.
 */
export function registerLedgerFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: 'Fraunces',
    fonts: [
      { src: fraunces400, fontWeight: 400 },
      { src: fraunces500, fontWeight: 500 },
      { src: fraunces400Italic, fontWeight: 400, fontStyle: 'italic' },
    ],
  });

  Font.register({
    family: 'Inter',
    fonts: [
      { src: inter400, fontWeight: 400 },
      { src: inter500, fontWeight: 500 },
      { src: inter600, fontWeight: 600 },
      { src: inter400Italic, fontWeight: 400, fontStyle: 'italic' },
    ],
  });

  Font.register({
    family: 'JetBrains Mono',
    fonts: [
      { src: mono400, fontWeight: 400 },
      { src: mono500, fontWeight: 500 },
    ],
  });

  Font.registerHyphenationCallback((word) => [word]);
}
