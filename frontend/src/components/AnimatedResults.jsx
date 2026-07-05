import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AnimatedResults = ({ electionResults, winnerCount = 1, votersWhoVoted = null }) => {
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
      // Set final state immediately without animation
      setCurrentTotals(electionResults.results.finalTallies || {});
      setIsAnimating(false);
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

  const getVoteCount = (tallyData) => {
    if (typeof tallyData === 'number') return tallyData;
    if (typeof tallyData === 'object' && tallyData.votes) {
      return typeof tallyData.votes === 'string' ? parseInt(tallyData.votes, 10) : tallyData.votes;
    }
    if (typeof tallyData === 'string') return parseInt(tallyData, 10);
    return 0;
  };

  const rankedWinners = [...candidates]
    .sort((a, b) => getVoteCount(results.finalTallies[b]) - getVoteCount(results.finalTallies[a]))
    .slice(0, Math.max(1, winnerCount));
  const winnerSet = new Set(rankedWinners);
  
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
  
  // Prefer explicit voter count; fall back to ballot count from tally payload
  const votersWhoVotedCount = votersWhoVoted != null
    ? votersWhoVoted
    : (results.allBallots?.length || results.total_ballots_cast || results.total_valid_ballots || 0);
  
  console.log('📊 [AnimatedResults] Rendering with data:', {
    finalTallies: results.finalTallies,
    totalVotes,
    votersWhoVotedCount,
    currentTotals,
    isAnimating
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6 shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Election Results</h2>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p className="text-blue-100 text-lg">
            Voters Who Voted: <span className="font-bold text-white">{votersWhoVotedCount}</span>
          </p>
          <p className="text-blue-100 text-sm">
            Candidate selections are aggregated below (multi-choice elections may show more selections than voters).
          </p>
        </div>
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
          const isWinner = winnerSet.has(candidate) && finalVotes > 0;

          return (
            <motion.div
              key={candidate}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-lg shadow-lg p-6 border-2 ${
                isWinner && !isAnimating ? 'border-yellow-400 ring-4 ring-yellow-100 bg-gradient-to-br from-yellow-50 to-white' : 'border-gray-200'
              }`}
            >
              {/* Candidate Name */}
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-bold ${isWinner && !isAnimating ? 'text-amber-800' : 'text-gray-800'}`}>{candidate}</h3>
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

      {/* Chunk Breakdown removed from here - now displayed in results tab after detailed results */}

      {/* All Ballots section removed - ballots are displayed in the separate Ballots tab */}
    </div>
  );
};

export default AnimatedResults;
