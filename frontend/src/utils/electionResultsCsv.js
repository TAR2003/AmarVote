import {
  buildCompetitionRankings,
  formatOrdinal,
  isWinnerByRank,
} from './electionRankings';

/**
 * RFC 4180 CSV field escaping — always quoted so long names, commas,
 * quotes, and line breaks never break the file structure.
 */
export function escapeCsvField(value) {
  if (value == null) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function csvRow(cells) {
  return cells.map((cell) => escapeCsvField(cell)).join(',');
}

function buildCandidateMetaMap(electionData) {
  const map = new Map();
  (electionData?.electionChoices || []).forEach((choice) => {
    map.set(choice.optionTitle, {
      description: choice.optionDescription || '',
      partyName: choice.partyName || '',
      candidatePic: choice.candidatePic || '',
    });
  });
  return map;
}

function enrichRankedForExport(ranked, electionData) {
  const metaMap = buildCandidateMetaMap(electionData);
  return ranked.map((row) => {
    const meta = metaMap.get(row.name) || {};
    return {
      ...row,
      description: meta.description || '',
      partyName: meta.partyName || '',
      candidatePic: meta.candidatePic || '',
    };
  });
}

function safeFileSlug(title, fallback = 'election') {
  const slug = (title || fallback).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return slug.slice(0, 60) || fallback;
}

/**
 * Build standings-only CSV: header row + candidate rows.
 * UTF-8 BOM and CRLF for reliable Excel import on Windows.
 */
export function buildElectionResultsCsv({ electionData, ranked, winnerCount }) {
  const enrichedRanked = enrichRankedForExport(ranked, electionData);
  const lines = [];

  lines.push(csvRow([
    'Rank',
    'Position',
    'Candidate Name',
    'Description',
    'Party',
    'Candidate Photo URL',
    'Votes',
    'Vote Share (%)',
    'Status',
  ]));

  enrichedRanked.forEach((row) => {
    const isWinner = isWinnerByRank(row.rank, winnerCount) && row.votes > 0;
    lines.push(csvRow([
      row.rank,
      formatOrdinal(row.rank),
      row.name,
      row.description,
      row.partyName,
      row.candidatePic,
      row.votes,
      row.percentage,
      isWinner ? 'Winner' : '—',
    ]));
  });

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function getElectionResultsCsvFilename(electionData, electionId) {
  const safeTitle = safeFileSlug(electionData?.electionTitle);
  return `election-results-${safeTitle}-${electionId}.csv`;
}

export function prepareElectionResultsCsvContent({
  electionData,
  electionId,
  processedResults,
  winnerCount,
}) {
  const ranked = buildCompetitionRankings(
    processedResults.chartData.map((item) => ({
      name: item.name,
      votes: item.votes,
      percentage: item.percentage,
    }))
  );

  const content = buildElectionResultsCsv({
    electionData,
    ranked,
    winnerCount,
  });

  return {
    content,
    filename: getElectionResultsCsvFilename(electionData, electionId),
  };
}
