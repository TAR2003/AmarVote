import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { IndigoPageFooter } from './PageFooter';
import { styles } from './styles';

export function CoverPage({ result }) {
  const subtitle =
    result.description?.trim() ||
    'Certified election results ledger.';

  return (
    <Page size="LETTER" style={styles.indigoPage} wrap={false}>
      <View style={styles.insetBorder} />
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmark}>
          <Text style={styles.wordmarkAmar}>AMAR</Text>
          <Text style={styles.wordmarkVote}>VOTE</Text>
        </Text>
        <Text style={styles.coverCaption}>
          Official Record{'\n'}
          End-to-end verifiable
        </Text>
      </View>

      <View style={styles.coverCenter}>
        <Text style={styles.coverKicker}>Official Record</Text>
        <Text style={styles.coverTitle}>{result.title}</Text>
        <Text style={styles.coverSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.coverBottom}>
        <Text style={styles.coverMeta}>
          {result.electionId ? `ID ${result.electionId}` : '—'}
          {'  ·  '}
          {result.generatedAt}
        </Text>
        <View style={styles.certifiedRow}>
          <View style={styles.tealDot} />
          <Text style={styles.certifiedLabel}>CERTIFIED</Text>
        </View>
      </View>

      <IndigoPageFooter electionId={result.electionId} />
    </Page>
  );
}
