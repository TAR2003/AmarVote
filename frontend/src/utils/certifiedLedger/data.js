import {
  buildCompetitionRankings,
  formatOrdinal,
  getCandidateDescription,
  isWinnerByRank,
} from '../electionRankings';
import {
  CHART_INNER_WIDTH_PT,
  GOLD_DEEP,
  GOLD_LIGHT,
  LEGEND_TARGET_ROWS,
  LONG_NAME_CHARS,
  VIOLET_DEEP,
  VIOLET_FAINT,
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

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function lerpRgb(c1, c2, t) {
  return {
    r: lerpChannel(c1.r, c2.r, t),
    g: lerpChannel(c1.g, c2.g, t),
    b: lerpChannel(c1.b, c2.b, t),
  };
}

/** Evenly spaced ramp from deep → light. Index 0 = deepest. */
export function colorRamp(deepHex, lightHex, count) {
  if (count <= 0) return [];
  if (count === 1) return [String(deepHex).toUpperCase()];
  const start = hexToRgb(deepHex);
  const end = hexToRgb(lightHex);
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return rgbToHex(lerpRgb(start, end, t));
  });
}

/** Violet-only ramp (non-winner family). */
export function getDonutSliceColors(count) {
  return colorRamp(VIOLET_DEEP, VIOLET_FAINT, count);
}

export function violetRamp(n) {
  return getDonutSliceColors(n);
}

/**
 * Chart colors in candidate-array order:
 * - winners → gold depth by votes (most votes = deepest gold)
 * - non-winners → violet depth by votes (most votes = deepest violet)
 */
export function assignChartColors(candidates) {
  const list = candidates || [];
  const winners = list
    .filter((c) => c.isWinner)
    .sort((a, b) => (b.votes || 0) - (a.votes || 0) || String(a.name).localeCompare(String(b.name)));
  const others = list
    .filter((c) => !c.isWinner)
    .sort((a, b) => (b.votes || 0) - (a.votes || 0) || String(a.name).localeCompare(String(b.name)));

  const golds = colorRamp(GOLD_DEEP, GOLD_LIGHT, winners.length);
  const violets = colorRamp(VIOLET_DEEP, VIOLET_FAINT, others.length);

  const colorMap = new Map();
  winners.forEach((c, i) => colorMap.set(c.name, golds[i]));
  others.forEach((c, i) => colorMap.set(c.name, violets[i]));

  return list.map((c) => colorMap.get(c.name) || tokens.violet);
}

/** @deprecated Use assignChartColors — gold winners + violet others. */
export function getDonutSliceColorsByWinnerPriority(candidates) {
  return assignChartColors(candidates);
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

  const colors = assignChartColors(result.candidates);
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
