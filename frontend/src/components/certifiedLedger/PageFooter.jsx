import React from 'react';
import { Text } from '@react-pdf/renderer';
import { styles } from './styles';

/** Ivory-page footer with live page numbers. */
export function IvoryPageFooter({ electionId }) {
  return (
    <>
      <Text style={styles.footerLeft} fixed>
        {electionId ? `Election ${electionId}` : 'AmarVote Certified Ledger'}
      </Text>
      <Text
        style={styles.footerRight}
        render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} / ${totalPages}`}
        fixed
      />
    </>
  );
}

export function IndigoPageFooter({ electionId }) {
  return (
    <>
      <Text style={[styles.footerLeft, styles.footerIndigo]} fixed>
        {electionId ? `Election ${electionId}` : 'AmarVote'}
      </Text>
      <Text
        style={[styles.footerRight, styles.footerIndigo]}
        render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} / ${totalPages}`}
        fixed
      />
    </>
  );
}
