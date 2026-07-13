import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { BarChart } from './charts';
import { IvoryPageFooter } from './PageFooter';
import { styles } from './styles';

export function BarChartPage({ result, layout }) {
  return (
    <Page size="LETTER" style={styles.ivoryPage} wrap={false}>
      <Text style={styles.eyebrow}>VISUAL ANALYTICS</Text>
      <Text style={styles.pageTitle}>Vote Distribution</Text>
      <Text style={styles.subtitle}>
        Votes received per candidate, ordered by competition rank.
      </Text>
      <View style={styles.chartFrame}>
        <BarChart candidates={result.candidates} maxLabelChars={layout.maxLabelChars} />
      </View>
      <IvoryPageFooter electionId={result.electionId} />
    </Page>
  );
}
