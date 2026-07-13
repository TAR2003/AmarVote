import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { truncate } from '../../utils/certifiedLedger/data';
import { CandidateAvatar } from './CandidateAvatar';
import { DonutChart } from './charts';
import { IvoryPageFooter } from './PageFooter';
import { styles } from './styles';

export function DonutChartPage({ result, layout }) {
  return (
    <Page size="LETTER" style={styles.ivoryPage} wrap={false}>
      <Text style={styles.eyebrow}>VISUAL ANALYTICS</Text>
      <Text style={styles.pageTitle}>Vote Share</Text>
      <Text style={styles.subtitle}>
        Proportion of the total tally attributed to each candidate.
      </Text>
      <View style={styles.chartFrame}>
        <DonutChart candidates={result.candidates} colors={layout.colors} />
      </View>
      <View style={styles.legendRow}>
        {(layout.legendCols || []).map((col, colIdx) => (
          <View key={colIdx} style={styles.legendCol}>
            {col.map((entry) => (
              <View key={entry.name} style={styles.legendItem} wrap={false}>
                <CandidateAvatar candidate={entry} size={22} />
                <View style={[styles.legendSwatch, { backgroundColor: entry.color }]} />
                <Text style={styles.legendName}>{truncate(entry.name, 24)}</Text>
                <Text style={styles.legendPct}>{entry.sharePct.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <IvoryPageFooter electionId={result.electionId} />
    </Page>
  );
}
