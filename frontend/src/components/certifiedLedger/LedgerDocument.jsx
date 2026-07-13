import React from 'react';
import { Document } from '@react-pdf/renderer';
import { CoverPage } from './CoverPage';
import { VerdictPage } from './VerdictPage';
import { ConfigPage } from './ConfigPage';
import { BarChartPage } from './BarChartPage';
import { DonutChartPage } from './DonutChartPage';
import { StandingsSection } from './StandingsSection';
import { ColophonPage } from './ColophonPage';

export function LedgerDocument({ result, layout }) {
  return (
    <Document
      title={`AmarVote Certified Ledger — ${result.title}`}
      author="AmarVote"
      subject="Certified election results ledger"
    >
      <CoverPage result={result} />
      <VerdictPage result={result} layout={layout} />
      <ConfigPage result={result} layout={layout} />
      <BarChartPage result={result} layout={layout} />
      <DonutChartPage result={result} layout={layout} />
      <StandingsSection result={result} layout={layout} />
      <ColophonPage result={result} />
    </Document>
  );
}
