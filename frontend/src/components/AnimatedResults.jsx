import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AnimatedResults = ({ electionResults }) => {
  const [animationStep, setAnimationStep] = useState(0);
  const [currentTotals, setCurrentTotals] = useState({});
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!electionResults || !electionResults.chunkResults) return;

    // Start animation
    setIsAnimating(true);
    setAnimationStep(0);
    setCurrentTotals({});

    // Animate through each chunk
    const animateNextChunk = (chunkIndex) => {
      if (chunkIndex >= electionResults.chunkResults.length) {
        setIsAnimating(false);
        return;
      }

      setTimeout(() => {
        const chunk = electionResults.chunkResults[chunkIndex];
        
        // Update current totals by adding this chunk's votes
        setCurrentTotals(prev => {
          const newTotals = { ...prev };
          Object.entries(chunk.candidateVotes || {}).forEach(([candidate, votes]) => {
            newTotals[candidate] = (newTotals[candidate] || 0) + votes;
          });
          return newTotals;
        });

        setAnimationStep(chunkIndex + 1);
        animateNextChunk(chunkIndex + 1);
      }, 1500); // 1.5 seconds between chunks
    };

    animateNextChunk(0);
  }, [electionResults]);

  if (!electionResults || !electionResults.success) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{electionResults?.message || 'Failed to load results'}</p>
      </div>
    );
  }

  const candidates = Object.keys(electionResults.finalResults || {});
  const maxVotes = Math.max(...Object.values(currentTotals), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6 shadow-lg">
        <h2 className="text-3xl font-bold mb-2">{electionResults.electionTitle}</h2>
        <p className="text-blue-100">Total Votes: {electionResults.totalVotes}</p>
        {isAnimating && (
          <p className="text-sm text-blue-200 mt-2 animate-pulse">
            Tallying chunk {animationStep} of {electionResults.chunkResults.length}...
          </p>
        )}
      </div>

      {/* Animated Vote Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((candidate, index) => {
          const currentVotes = currentTotals[candidate] || 0;
          const finalVotes = electionResults.finalResults[candidate] || 0;
          const percentage = maxVotes > 0 ? (currentVotes / maxVotes) * 100 : 0;
          const isWinner = finalVotes === Math.max(...Object.values(electionResults.finalResults));

          return (
            <motion.div
              key={candidate}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-lg shadow-lg p-6 border-2 ${
                isWinner && !isAnimating ? 'border-yellow-400 ring-4 ring-yellow-100' : 'border-gray-200'
              }`}
            >
              {/* Candidate Name */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">{candidate}</h3>
                {isWinner && !isAnimating && (
                  <span className="text-2xl">🏆</span>
                )}
              </div>

              {/* Vote Count */}
              <motion.div
                className="text-4xl font-extrabold text-blue-600 mb-4"
                key={currentVotes}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {currentVotes}
                {!isAnimating && currentVotes < finalVotes && (
                  <span className="text-sm text-gray-400"> / {finalVotes}</span>
                )}
              </motion.div>

              {/* Animated Bar */}
              <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${
                    isWinner && !isAnimating 
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-gray-700">
                  {Math.round(percentage)}%
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Chunk Breakdown */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Chunk Breakdown</h3>
        <div className="space-y-4">
          {electionResults.chunkResults.map((chunk, index) => (
            <AnimatePresence key={chunk.electionCenterId}>
              {index < animationStep && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.5 }}
                  className={`border rounded-lg p-4 ${
                    index === animationStep - 1 && isAnimating
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-700">
                      Chunk {chunk.chunkNumber}
                    </h4>
                    <span className="text-sm text-gray-500">
                      {chunk.trackingCodes?.length || 0} ballots
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(chunk.candidateVotes || {}).map(([candidate, votes]) => (
                      <div key={candidate} className="text-sm">
                        <span className="font-medium text-gray-700">{candidate}:</span>
                        <span className="ml-2 text-blue-600 font-bold">{votes}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ))}
        </div>
      </div>

      {/* All Ballots */}
      {!isAnimating && electionResults.ballots && electionResults.ballots.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">All Ballots</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tracking Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ballot Hash
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chunk
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {electionResults.ballots.map((ballot, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                      {ballot.trackingCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 truncate max-w-xs">
                      {ballot.ballotHash}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ballot.chunkNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimatedResults;
