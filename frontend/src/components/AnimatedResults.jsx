import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import TruncatedCandidateName from './TruncatedCandidateName';
import CandidateThumbnail from './CandidateThumbnail';
import {
  buildCompetitionRankings,
  formatOrdinal,
  getCandidatePic,
  getVoteCountFromTally,
  isWinnerByRank,
} from '../utils/electionRankings';

const AnimatedResults = ({ electionResults, electionChoices = [], winnerCount = 1, votersWhoVoted = null }) => {
  const [animationStep, setAnimationStep] = useState(0);
  const [currentTotals, setCurrentTotals] = useState({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastAnimatedDataKey, setLastAnimatedDataKey] = useState(null);

  useEffect(() => {
    if (!electionResults || !electionResults.results || !electionResults.results.chunks) return;

    const chunks = electionResults.results.chunks;

    const dataKey = JSON.stringify({
      totalChunks: chunks.length,
      finalTallies: electionResults.results.finalTallies,
      totalBallots: electionResults.results.allBallots?.length,
    });

    if (dataKey === lastAnimatedDataKey) {
      setCurrentTotals(electionResults.results.finalTallies || {});
      setIsAnimating(false);
      return;
    }

    setLastAnimatedDataKey(dataKey);
    setIsAnimating(true);
    setAnimationStep(0);
    setCurrentTotals({});

    const animateNextChunk = (chunkIndex) => {
      if (chunkIndex >= chunks.length) {
        setIsAnimating(false);
        return;
      }

      setTimeout(() => {
        const chunk = chunks[chunkIndex];

        setCurrentTotals((prev) => {
          const newTotals = { ...prev };
          Object.entries(chunk.candidateVotes || {}).forEach(([candidate, voteData]) => {
            const votes = getVoteCountFromTally(voteData);
            newTotals[candidate] = (newTotals[candidate] || 0) + votes;
          });
          return newTotals;
        });

        setAnimationStep(chunkIndex + 1);
        animateNextChunk(chunkIndex + 1);
      }, 1500);
    };

    animateNextChunk(0);
  }, [electionResults, lastAnimatedDataKey]);

  if (!electionResults || !electionResults.success) {
    return (
      <div className="bg-ember-soft border border-ember/30 rounded-lg p-6 text-center">
        <p className="text-ember">{electionResults?.message || 'Failed to load results'}</p>
      </div>
    );
  }

  const results = electionResults.results;
  const finalTallies = results.finalTallies || {};

  const rankedCandidates = useMemo(() => {
    const items = Object.keys(finalTallies).map((name) => ({
      name,
      votes: getVoteCountFromTally(finalTallies[name]),
    }));
    return buildCompetitionRankings(items);
  }, [finalTallies]);

  const totalVotes = rankedCandidates.reduce((sum, item) => sum + item.votes, 0);

  const votersWhoVotedCount = votersWhoVoted != null
    ? votersWhoVoted
    : (results.allBallots?.length || results.total_ballots_cast || results.total_valid_ballots || 0);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-deep p-5 text-paper shadow-glass sm:p-6">
        <h2 className="font-display text-3xl font-bold mb-2">Election Results</h2>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p className="text-dusk-soft text-lg">
            Voters Who Voted: <span className="font-bold text-paper">{votersWhoVotedCount}</span>
          </p>
          <p className="text-dusk-soft text-sm">
            Ranked by votes received (highest first). Tied candidates share the same position.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rankedCandidates.map((candidate, index) => {
          const displayVotes = candidate.votes;
          const percentage = totalVotes > 0 ? (displayVotes / totalVotes) * 100 : 0;
          const isWinner = isWinnerByRank(candidate.rank, winnerCount) && displayVotes > 0;
          const positionLabel = formatOrdinal(candidate.rank);

          return (
            <motion.div
              key={candidate.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`surface-card rounded-2xl p-5 sm:p-6 border-2 ${
                isWinner && !isAnimating
                  ? 'border-amber-400 ring-4 ring-amber-100 bg-gradient-to-br from-amber-50 to-white'
                  : 'border-ink/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="min-w-0 flex-1 flex items-start gap-3">
                  <CandidateThumbnail
                    src={getCandidatePic(electionChoices, candidate.name)}
                    name={candidate.name}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                      isWinner && !isAnimating ? 'text-ink' : 'text-dusk'
                    }`}>
                      {positionLabel}
                    </p>
                    <h3 className={`text-lg font-bold leading-snug ${
                      isWinner && !isAnimating ? 'text-ink' : 'text-ink'
                    }`}>
                      <TruncatedCandidateName name={candidate.name} />
                    </h3>
                  </div>
                </div>
                {isWinner && !isAnimating && (
                  <span className="flex flex-col items-center flex-shrink-0" title={`${positionLabel} place`}>
                    <span className="text-2xl leading-none"></span>
                    <span className="text-[10px] font-bold text-ink mt-0.5">{positionLabel}</span>
                  </span>
                )}
              </div>

              <motion.div
                className="text-4xl font-extrabold text-brand mb-4"
                key={displayVotes}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {displayVotes}
              </motion.div>

              <div className="relative h-3 bg-frost-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${
                    isWinner && !isAnimating
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                      : 'bg-gradient-to-r from-brand to-brand-dark'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink">
                  {Math.round(percentage)}%
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AnimatedResults;
