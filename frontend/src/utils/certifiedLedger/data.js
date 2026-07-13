import {
  buildCompetitionRankings,
  formatOrdinal,
  getCandidateDescription,
  isWinnerByRank,
} from '../electionRankings';
import {
  CHART_INNER_WIDTH_PT,
  LEGEND_TARGET_ROWS,
  LONG_NAME_CHARS,
  tokens,
} from './tokens';

export function truncate(str, maxChars) {
  const raw = String(str || '').trim();
  if (!raw) return '';
  if (!maxChars || raw.length <= maxChars) return raw;
  return `${raw.slice(0, Math.max(1, maxChars - 1))}…`;
}

export function groupByRank(candidates) {
  const groups = [];
  for (const item of candidates) {
    if (groups.length && groups[groups.length - 1].rank === item.rank) {
      groups[groups.length - 1].members.push(item);
    } else {
      groups.push({
        rank: item.rank,
        ordinal: formatOrdinal(item.rank),
        isTied: false,
        members: [item],
      });
    }
  }
  for (const g of groups) {
    g.isTied = g.members.length > 1;
  }
  return groups;
}

/** Map rank → group for O(1) lookup in standings. */
export function rankGroupsMap(candidates) {
  const map = {};
  for (const g of groupByRank(candidates)) {
    map[g.rank] = g;
  }
  return map;
}

/**
 * Split freeform optionDescription into standings fields.
 * First paragraph → pull quote; next two → Platform/Priorities; last short line → slogan.
 */
export function parseDescription(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return { platform: '', priorities: '', slogan: '', policies: [] };
  }

  const paras = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  if (paras.length === 1) {
    return { platform: paras[0], priorities: '', slogan: '', policies: [] };
  }

  const platform = paras[0] || '';
  let rest = paras.slice(1);
  let slogan = '';
  if (rest.length && rest[rest.length - 1].length <= 80 && !rest[rest.length - 1].endsWith('.')) {
    slogan = rest[rest.length - 1];
    rest = rest.slice(0, -1);
  }

  const labels = ['Platform', 'Priorities'];
  const policies = rest.slice(0, 2).map((para, i) => ({
    label: labels[i] || `Section ${i + 1}`,
    text: para,
  }));

  return {
    platform,
    priorities: policies.find((p) => p.label === 'Priorities')?.text || policies[0]?.text || '',
    slogan,
    policies,
  };
}

export function isRealParty(partyName) {
  if (!partyName || !String(partyName).trim()) return false;
  return !/^\d+$/.test(String(partyName).trim());
}

export function chooseVerdictMode(winners) {
  const n = winners.length;
  if (n === 0) return 'hero';
  const maxName = Math.max(...winners.map((w) => String(w.name || '').length));
  if (n > 3 || (n > 1 && maxName > LONG_NAME_CHARS)) return 'compact';
  return 'hero';
}

export function splitBalanced(items, columns) {
  if (columns <= 1 || !items?.length) return [items || []];
  const colSize = Math.ceil(items.length / columns);
  const cols = [];
  for (let i = 0; i < columns; i += 1) {
    const start = i * colSize;
    const slice = items.slice(start, start + colSize);
    if (slice.length) cols.push(slice);
  }
  return cols;
}

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/** Interpolate violet → violetSoft for N slices. */
export function violetRamp(n) {
  if (n <= 0) return [];
  const from = [0x8b, 0x7f, 0xe8];
  const to = [0xc9, 0xc3, 0xf5];
  if (n === 1) return [tokens.violet];
  const colors = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const r = lerpChannel(from[0], to[0], t);
    const g = lerpChannel(from[1], to[1], t);
    const b = lerpChannel(from[2], to[2], t);
    colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase());
  }
  return colors;
}

export function deriveLayoutParams(result) {
  const winners = result.candidates.filter((c) => c.isWinner);
  const maxWinnerNameLen = winners.length
    ? Math.max(...winners.map((c) => c.name.length))
    : 0;

  const verdictMode =
    winners.length > 3 || (winners.length > 1 && maxWinnerNameLen > LONG_NAME_CHARS)
      ? 'compact'
      : 'hero';

  const rankGroups = rankGroupsMap(result.candidates);
  const winnerGroups = groupByRank(winners);

  const legendColumns = Math.ceil(result.candidates.length / LEGEND_TARGET_ROWS) > 1 ? 2 : 1;
  const rowsPerColumn = Math.ceil(result.candidates.length / legendColumns);

  const barCount = Math.max(1, result.candidates.length);
  const maxLabelChars = Math.max(6, Math.floor(CHART_INNER_WIDTH_PT / barCount / 6.2));

  const guardianCount = result.guardians?.length || 0;
  const guardianColumns = guardianCount > 8 ? 2 : 1;
  const guardianWrap = guardianCount > 24;

  const colors = violetRamp(result.candidates.length);
  const legendEntries = result.candidates.map((c, i) => ({
    ...c,
    color: colors[i] || tokens.violet,
  }));
  const legendCols = splitBalanced(legendEntries, legendColumns);

  const guardianCols = splitBalanced(result.guardians || [], guardianColumns);

  return {
    verdictMode,
    rankGroups,
    winnerGroups,
    legendColumns,
    rowsPerColumn,
    maxLabelChars,
    legendCols,
    colors,
    guardianColumns,
    guardianCols,
    guardianWrap,
  };
}

/**
 * Map ElectionPage PDF args into the Certified Ledger ElectionResult contract.
 */
export function buildElectionResult({
  electionData,
  electionId,
  processedResults,
  ranked,
  winnerCount,
  formatGeneratedAt,
  formatStartTime,
  formatEndTime,
  statusLabel,
}) {
  const choices = electionData?.electionChoices || [];
  const totalVotesTallied =
    ranked.reduce((sum, r) => sum + (Number(r.votes) || 0), 0) ||
    Number(processedResults?.totalVotes) ||
    0;

  const ordered = buildCompetitionRankings(
    ranked.map((r) => ({
      name: r.name,
      votes: Number(r.votes) || 0,
      percentage: Number(r.percentage) || 0,
    })),
  );

  const candidates = ordered.map((r) => {
    const choice = choices.find((c) => c.optionTitle === r.name) || {};
    const description =
      choice.optionDescription || getCandidateDescription(choices, r.name) || '';
    const parsed = parseDescription(description);
    let sharePct = Number(r.percentage) || 0;
    if (sharePct <= 0 && totalVotesTallied > 0) {
      sharePct = (r.votes / totalVotesTallied) * 100;
    }
    const party = isRealParty(choice.partyName) ? String(choice.partyName).trim() : '';

    return {
      name: String(r.name || ''),
      party,
      platform: parsed.platform,
      priorities: parsed.priorities,
      slogan: parsed.slogan,
      policies: parsed.policies,
      votes: r.votes,
      sharePct: Math.round(sharePct * 10) / 10,
      rank: r.rank,
      isWinner: isWinnerByRank(r.rank, winnerCount) && r.votes > 0,
    };
  });

  const guardians = (electionData?.guardians || []).map((g, i) => ({
    email: g.userEmail || g.user_email || g.email || '—',
    sequence: g.sequenceOrder ?? g.sequence_order ?? i + 1,
  }));

  return {
    electionId: String(electionId || electionData?.electionId || electionData?.id || ''),
    title: electionData?.electionTitle || electionData?.title || 'Election',
    description: electionData?.electionDescription || electionData?.description || '',
    status: statusLabel || electionData?.status || '',
    generatedAt: formatGeneratedAt || new Date().toISOString(),
    opensAt: formatStartTime || '',
    closesAt: formatEndTime || '',
    eligibility: electionData?.eligibility || '',
    privacy: electionData?.privacy || '',
    maxSelections: electionData?.maxChoices ?? '',
    declaredWinnerCount: Math.max(1, Number(winnerCount) || 1),
    guardianQuorum: electionData?.quorum || electionData?.quorumRequired || '',
    guardiansRequired: electionData?.numberOfGuardians || guardians.length,
    guardians,
    administratorEmail: electionData?.adminEmail || '',
    ballotsCast:
      processedResults?.totalVotedUsers ??
      processedResults?.totalBallots ??
      '',
    totalVotesTallied,
    candidates,
  };
}
