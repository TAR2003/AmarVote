import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { IndigoPageFooter } from './PageFooter';
import { styles } from './styles';

export function ColophonPage({ result }) {
  const quorum = result.guardianQuorum
    ? `Guardian quorum ${result.guardianQuorum} of ${result.guardiansRequired || result.guardians.length}.`
    : `${result.guardians?.length || 0} appointed guardians.`;

  return (
    <Page size="LETTER" style={styles.indigoPage} wrap={false}>
      <View style={styles.insetBorder} />
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmark}>
          <Text style={styles.wordmarkAmar}>AMAR</Text>
          <Text style={styles.wordmarkVote}>VOTE</Text>
        </Text>
        <Text style={styles.coverCaption}>Attestation</Text>
      </View>

      <View style={styles.colophonCenter}>
        <View style={styles.tealRing}>
          <View style={styles.tealDot} />
        </View>
        <Text style={styles.colophonCertLabel}>CERTIFIED & VERIFIED</Text>
        <Text style={styles.colophonBody}>
          This document is the Certified Ledger for the election named herein. Tallies were
          produced under threshold cryptography with appointed guardians.
        </Text>
        <Text style={styles.colophonFacts}>{quorum}</Text>
        <View style={styles.colophonRule} />
        <Text style={styles.colophonStamp}>{result.generatedAt}</Text>
      </View>

      <IndigoPageFooter electionId={result.electionId} />
    </Page>
  );
}
