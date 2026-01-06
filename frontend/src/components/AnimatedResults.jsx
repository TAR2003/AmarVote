import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AnimatedResults = ({ electionResults }) => {
  const [animationStep, setAnimationStep] = useState(0);
  const [currentTotals, setCurrentTotals] = useState({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastAnimatedDataKey, setLastAnimatedDataKey] = useState(null);

  useEffect(() => {
    if (!electionResults || !electionResults.results || !electionResults.results.chunks) return;

    const chunks = electionResults.results.chunks;
    
    // Create a unique key for this data to prevent re-animation of the same data
    const dataKey = JSON.stringify({
      totalChunks: chunks.length,
      finalTallies: electionResults.results.finalTallies,
      totalBallots: electionResults.results.allBallots?.length
    });
    
    console.log('🎬 [AnimatedResults] Checking animation trigger:', {
      currentKey: dataKey,
      lastKey: lastAnimatedDataKey,
      willAnimate: dataKey !== lastAnimatedDataKey,
      finalTallies: electionResults.results.finalTallies
    });
    
    // Don't re-animate if we've already animated this exact data
    if (dataKey === lastAnimatedDataKey) {
      console.log('⏭️ [AnimatedResults] Skipping animation - same data already animated');
      return;
    }
    
    console.log('✨ [AnimatedResults] Starting new animation with fresh data');
    setLastAnimatedDataKey(dataKey);
    
    // Start animation
    setIsAnimating(true);
    setAnimationStep(0);
    setCurrentTotals({});

    // Animate through each chunk
    const animateNextChunk = (chunkIndex) => {
      if (chunkIndex >= chunks.length) {
        setIsAnimating(false);
        return;
      }

      setTimeout(() => {
        const chunk = chunks[chunkIndex];
        
        console.log(`🎬 [AnimatedResults] Processing chunk ${chunkIndex + 1}:`, {
          chunkIndex: chunk.chunkIndex,
          candidateVotes: chunk.candidateVotes,
          electionCenterId: chunk.electionCenterId
        });
        
        // Update current totals by adding this chunk's votes
        setCurrentTotals(prev => {
          const newTotals = { ...prev };
          Object.entries(chunk.candidateVotes || {}).forEach(([candidate, voteData]) => {
            // Handle simple integers, strings, and nested object formats
            let votes = 0;
            if (typeof voteData === 'number') {
              votes = voteData;
            } else if (typeof voteData === 'object' && voteData.votes) {
              votes = typeof voteData.votes === 'string' ? parseInt(voteData.votes) : voteData.votes;
            } else if (typeof voteData === 'string') {
              votes = parseInt(voteData);
            }
            console.log(`  📝 Adding ${votes} votes for ${candidate} (was ${prev[candidate] || 0})`);
            newTotals[candidate] = (newTotals[candidate] || 0) + votes;
          });
          console.log(`  ✅ New totals:`, newTotals);
          return newTotals;
        });

        setAnimationStep(chunkIndex + 1);
        animateNextChunk(chunkIndex + 1);
      }, 1500); // 1.5 seconds between chunks
    };

    animateNextChunk(0);
  }, [electionResults, lastAnimatedDataKey]);

  if (!electionResults || !electionResults.success) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{electionResults?.message || 'Failed to load results'}</p>
      </div>
    );
  }

  const results = electionResults.results;
  const candidates = Object.keys(results.finalTallies || {});
  const maxVotes = Math.max(...Object.values(currentTotals), 1);
  
  // Calculate total votes properly - handle both simple integers and nested objects
  const totalVotes = Object.values(results.finalTallies || {}).reduce((sum, tallyData) => {
    if (typeof tallyData === 'number') {
      return sum + tallyData;
    } else if (typeof tallyData === 'object' && tallyData.votes) {
      return sum + (typeof tallyData.votes === 'string' ? parseInt(tallyData.votes) : tallyData.votes);
    } else if (typeof tallyData === 'string') {
      return sum + parseInt(tallyData);
    }
    return sum;
  }, 0);
  
  // Get total ballots from results
  const totalBallots = results.allBallots?.length || results.total_ballots_cast || results.total_valid_ballots || totalVotes;
  
  console.log('📊 [AnimatedResults] Rendering with data:', {
    finalTallies: results.finalTallies,
    totalVotes,
    totalBallots,
    currentTotals,
    isAnimating
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6 shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Election Results</h2>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <p className="text-blue-100 text-lg">Total Votes Cast: <span className="font-bold text-white">{totalVotes}</span></p>
          <p className="text-blue-100 text-lg">Total Ballots: <span className="font-bold text-white">{totalBallots}</span></p>
        </div>
        {isAnimating && (
          <p className="text-sm text-blue-200 mt-2 animate-pulse">
            Processing chunk {animationStep} of {results.totalChunks}...
          </p>
        )}
      </div>

      {/* Animated Vote Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {candidates.map((candidate, index) => {
          // ALWAYS use finalTallies for display, not currentTotals (which may be wrong during animation)
          const finalTallyData = results.finalTallies[candidate];
          let finalVotes = 0;
          if (typeof finalTallyData === 'number') {
            finalVotes = finalTallyData;
          } else if (typeof finalTallyData === 'object' && finalTallyData.votes) {
            finalVotes = typeof finalTallyData.votes === 'string' ? parseInt(finalTallyData.votes) : finalTallyData.votes;
          } else if (typeof finalTallyData === 'string') {
            finalVotes = parseInt(finalTallyData);
          }
          
          // Use finalVotes for display and percentage calculation
          const displayVotes = finalVotes;
          const percentage = totalVotes > 0 ? (displayVotes / totalVotes) * 100 : 0;
          
          // Calculate max from final tallies properly - handle all formats
          const maxFinalVotes = Math.max(...Object.values(results.finalTallies).map(v => {
            if (typeof v === 'number') return v;
            if (typeof v === 'object' && v.votes) {
              return typeof v.votes === 'string' ? parseInt(v.votes) : v.votes;
            }
            if (typeof v === 'string') return parseInt(v);
            return 0;
          }));
          const isWinner = finalVotes === maxFinalVotes && maxFinalVotes > 0;

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
                key={displayVotes}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {displayVotes}
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
          {results.chunks.map((chunk, index) => (
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
                      Chunk {chunk.chunkIndex} (ID: {chunk.electionCenterId})
                    </h4>
                    <span className="text-sm text-gray-500">
                      {chunk.ballotCount || 0} ballots
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(chunk.candidateVotes || {}).map(([candidate, voteData]) => {
                      // Handle simple integers, strings, and nested object formats
                      let votes = 0;
                      if (typeof voteData === 'number') {
                        votes = voteData;
                      } else if (typeof voteData === 'object' && voteData.votes) {
                        votes = typeof voteData.votes === 'string' ? parseInt(voteData.votes) : voteData.votes;
                      } else if (typeof voteData === 'string') {
                        votes = parseInt(voteData);
                      }
                      return (
                        <div key={candidate} className="text-sm">
                          <span className="font-medium text-gray-700">{candidate}:</span>
                          <span className="ml-2 text-blue-600 font-bold">{votes}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ))}
        </div>
      </div>

      {/* All Ballots */}
      {!isAnimating && results.allBallots && results.allBallots.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">All Ballots ({results.allBallots.length})</h3>
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
                {results.allBallots.map((ballot, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                      {ballot.ballot_id || ballot.tracking_code || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 truncate max-w-xs">
                      {ballot.initial_hash || ballot.ballot_hash || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                        {ballot.chunkIndex || '?'}
                      </span>
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
