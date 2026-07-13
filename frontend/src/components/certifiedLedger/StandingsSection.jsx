import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { formatOrdinal } from '../../utils/electionRankings';
import { truncate } from '../../utils/certifiedLedger/data';
import { IvoryPageFooter } from './PageFooter';
import { styles } from './styles';

function StandingBlock({ candidate, tieGroup }) {
  const displayName =
    candidate.name.length > 60 ? truncate(candidate.name, 60) : candidate.name;
  const isTied = Boolean(tieGroup?.isTied);

  return (
    <View style={styles.standingBlock} wrap={false} minPresenceAhead={80}>
      <View style={styles.standingRankCol}>
        <Text style={styles.standingRank}>{formatOrdinal(candidate.rank)}</Text>
        {isTied ? <Text style={styles.tieBadge}>TIED</Text> : null}
      </View>
      <View style={styles.standingBody}>
        <View style={styles.standingNameRow}>
          <Text style={styles.standingName}>{displayName}</Text>
          <Text style={styles.standingShare}>
            {candidate.sharePct.toFixed(1)}% · {candidate.votes}
          </Text>
        </View>
        {candidate.party ? (
          <Text style={styles.standingParty}>{candidate.party}</Text>
        ) : null}
        {candidate.platform ? (
          <Text style={styles.standingQuote}>“{candidate.platform}”</Text>
        ) : null}
        {(candidate.policies || []).map((policy) => (
          <View key={policy.label}>
            <Text style={styles.policyLabel}>{policy.label}</Text>
            <Text style={styles.policyText}>{policy.text}</Text>
          </View>
        ))}
        {candidate.slogan && candidate.slogan !== candidate.platform ? (
          <Text style={styles.standingSlogan}>{candidate.slogan}</Text>
        ) : null}
        {candidate.isWinner ? (
          <View style={styles.winnerBadge}>
            <Text style={styles.winnerBadgeText}>WINNER</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function StandingsSection({ result, layout }) {
  return (
    <Page size="LETTER" style={styles.ivoryPage} wrap>
      <Text
        style={styles.continuedHeader}
        fixed
        render={({ subPageNumber }) =>
          subPageNumber > 1 ? 'Full Standings Ledger (continued)' : ''
        }
      />
      <Text style={styles.eyebrow}>COMPLETE RECORD</Text>
      <Text style={styles.pageTitle}>Full Standings Ledger</Text>
      <Text style={styles.subtitle}>
        {result.candidates.length} candidates · competition ranking (ties share rank; next
        rank skips).
      </Text>

      {result.candidates.map((c) => (
        <StandingBlock
          key={c.name}
          candidate={c}
          tieGroup={layout.rankGroups?.[c.rank]}
        />
      ))}

      <IvoryPageFooter electionId={result.electionId} />
    </Page>
  );
}
