/**
 * Competition ranking (1224 system): tied candidates share the same rank;
 * the next rank skips positions (e.g. 1, 2, 2, 4).
 */

export function getVoteCountFromTally(tallyData) {
  if (typeof tallyData === 'number') return tallyData;
  if (typeof tallyData === 'object' && tallyData?.votes != null) {
    return typeof tallyData.votes === 'string' ? parseInt(tallyData.votes, 10) : tallyData.votes;
  }
  if (typeof tallyData === 'string') return parseInt(tallyData, 10);
  return 0;
}

export function buildCompetitionRankings(items, getVotes = (item) => item.votes ?? 0) {
  const sorted = [...items].sort((a, b) => getVotes(b) - getVotes(a));
  let lastVotes = null;
  let lastRank = 0;

  return sorted.map((item, index) => {
    const votes = getVotes(item);
    const rank = lastVotes !== null && votes === lastVotes ? lastRank : index + 1;
    lastVotes = votes;
    lastRank = rank;
    return { ...item, votes, rank };
  });
}

export function formatOrdinal(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return '';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Winner if their competition rank is within the declared winner positions. */
export function isWinnerByRank(rank, winnerCount) {
  return rank <= Math.max(1, winnerCount);
}
