import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { formatOrdinal } from '../../utils/electionRankings';
import { truncate } from '../../utils/certifiedLedger/data';
import { tokens } from '../../utils/certifiedLedger/tokens';
import { IvoryPageFooter } from './PageFooter';
import { styles } from './styles';

function HeroWinners({ winnerGroups }) {
  return winnerGroups.map((group) => (
    <View key={`hero-${group.rank}`} style={{ marginBottom: 8 }}>
      {group.members.map((w) => (
        <View key={w.name} style={styles.heroWinnerBlock} wrap={false}>
          <View style={styles.heroNameRow}>
            <View style={{ maxWidth: '65%' }}>
              <Text style={{ fontSize: 9, color: tokens.duskOnLight, marginBottom: 4 }}>
                {formatOrdinal(w.rank)}
                {group.isTied ? ' · TIED' : ''}
              </Text>
              <Text style={styles.heroName}>{w.name}</Text>
            </View>
            <Text style={styles.heroShare}>{w.sharePct.toFixed(1)}%</Text>
          </View>
          <View style={styles.goldRule} />
          <Text style={styles.heroVotes}>{w.votes} votes</Text>
        </View>
      ))}
    </View>
  ));
}

function CompactWinnerList({ winnerGroups, winners }) {
  const fontSize = Math.max(9, 14 - Math.floor(winners.length / 4));

  return winnerGroups.map((group) => (
    <View key={`compact-${group.rank}`} style={{ marginBottom: 4 }}>
      {group.members.map((w, idx) => (
        <View key={w.name} style={styles.compactRow} wrap={false}>
          <View style={{ width: 42 }}>
            {idx === 0 ? (
              <Text style={[styles.compactRank, { fontSize, width: 42 }]}>
                {formatOrdinal(w.rank)}
              </Text>
            ) : null}
            {idx === 0 && group.isTied ? (
              <Text style={styles.tieBadge}>TIED</Text>
            ) : null}
          </View>
          <Text style={[styles.compactName, { fontSize }]}>
            {truncate(w.name, 48)}
          </Text>
          <Text style={[styles.compactShare, { fontSize }]}>
            {w.sharePct.toFixed(1)}%
          </Text>
          <Text style={[styles.compactVotes, { fontSize: Math.max(8, fontSize - 1) }]}>
            {w.votes}
          </Text>
        </View>
      ))}
    </View>
  ));
}

export function VerdictPage({ result, layout }) {
  const winners = result.candidates.filter((c) => c.isWinner);
  const winnerGroups = layout.winnerGroups || [];

  const subtitle =
    winners.length === 1
      ? `One declared winner from ${result.candidates.length} candidates.`
      : `${winners.length} declared winners from ${result.candidates.length} candidates (top ${result.declaredWinnerCount} by competition rank).`;

  return (
    <Page size="LETTER" style={styles.ivoryPage} wrap={false}>
      <Text style={styles.eyebrow}>DECLARED OUTCOME</Text>
      <Text style={styles.pageTitle}>The Verdict</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {winners.length === 0 ? (
        <Text style={styles.subtitle}>No winners declared for this election.</Text>
      ) : layout.verdictMode === 'hero' ? (
        <HeroWinners winnerGroups={winnerGroups} />
      ) : (
        <CompactWinnerList winnerGroups={winnerGroups} winners={winners} />
      )}

      <IvoryPageFooter electionId={result.electionId} />
    </Page>
  );
}
