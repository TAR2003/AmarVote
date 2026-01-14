import React, { useState, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { electionApi } from '../utils/electionApi';

const DecryptionProgressModal = ({ isOpen, onClose, electionId, guardianName }) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Calculate total operations (n * m where n = chunks, m = guardians)
  const calculateTotalOperations = (status) => {
    if (!status) return { total: 0, completed: 0, numChunks: 0, totalGuardians: 0 };
    
    // Get the number of other guardians (m-1)
    const otherGuardians = status.totalCompensatedGuardians || 0;
    
    // Get the number of total guardians (m) = 1 (self) + other guardians
    const totalGuardians = otherGuardians + 1;
    
    // Determine the actual number of chunks (n)
    let numChunks;
    
    if (status.currentPhase === 'partial_decryption') {
      // In Phase 1, totalChunks = n (actual number of chunks)
      numChunks = status.totalChunks || 0;
    } else if (status.currentPhase === 'compensated_shares_generation') {
      // In Phase 2, totalChunks = n * (m-1) (chunks × other guardians)
      // So n = totalChunks / (m-1)
      if (otherGuardians > 0) {
        numChunks = Math.floor((status.totalChunks || 0) / otherGuardians);
      } else {
        // Fallback: if no other guardians (shouldn't happen), use totalChunks
        numChunks = status.totalChunks || 0;
      }
    } else if (status.status === 'completed' || status.currentPhase === 'completed') {
      // When completed, the backend resets totalChunks to the actual number of ballot chunks (n)
      // So we can use it directly without any calculation
      numChunks = status.totalChunks || 0;
    } else {
      // Fallback for pending/other phases
      numChunks = status.totalChunks || 0;
    }
    
    // Total operations = n * m (chunks × total guardians)
    const totalOperations = numChunks * totalGuardians;
    
    // Calculate completed operations based on current phase
    let completedOperations = 0;
    
    if (status.currentPhase === 'partial_decryption') {
      // In Phase 1: only count processed chunks
      completedOperations = status.processedChunks || 0;
    } else if (status.currentPhase === 'compensated_shares_generation') {
      // In Phase 2: add all Phase 1 chunks (n) + current compensated chunks
      completedOperations = numChunks + (status.processedChunks || 0);
    } else if (status.status === 'completed') {
      // Completed: all operations done
      completedOperations = totalOperations;
    }
    
    // Debug logging
    console.log('calculateTotalOperations:', {
      phase: status.currentPhase,
      statusValue: status.status,
      totalChunks: status.totalChunks,
      processedChunks: status.processedChunks,
      otherGuardians,
      totalGuardians,
      numChunks,
      totalOperations,
      completedOperations
    });
    
    return { 
      total: totalOperations, 
      completed: completedOperations,
      numChunks,
      totalGuardians
    };
  };

  // Calculate estimated time remaining
  const calculateEstimatedTime = (status) => {
    if (!status || !status.startedAt) {
      return null;
    }

    const { total, completed } = calculateTotalOperations(status);
    
    if (completed === 0 || total === 0) return null;

    const startTime = new Date(status.startedAt).getTime();
    const currentTime = Date.now();
    const elapsedMs = currentTime - startTime;
    
    const operationsRemaining = total - completed;
    
    if (completed === 0) return null;
    
    const msPerOperation = elapsedMs / completed;
    const estimatedRemainingMs = msPerOperation * operationsRemaining;
    
    // Convert to seconds
    const estimatedRemainingSec = Math.ceil(estimatedRemainingMs / 1000);
    
    if (estimatedRemainingSec < 60) {
      return `${estimatedRemainingSec}s`;
    } else if (estimatedRemainingSec < 3600) {
      const minutes = Math.floor(estimatedRemainingSec / 60);
      const seconds = estimatedRemainingSec % 60;
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(estimatedRemainingSec / 3600);
      const minutes = Math.floor((estimatedRemainingSec % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  // Debug logging
  useEffect(() => {
    console.log('DecryptionProgressModal props:', { isOpen, electionId, guardianName });
  }, [isOpen, electionId, guardianName]);

  useEffect(() => {
    if (isOpen && electionId) {
      console.log('Modal is open, starting to poll status...');
      // Start polling for status immediately
      pollStatus();
      const interval = setInterval(pollStatus, 2000); // Poll every 2 seconds

      return () => {
        console.log('Stopping polling...');
        clearInterval(interval);
      };
    } else if (!isOpen) {
      // Reset status when modal closes
      setStatus(null);
      setError(null);
    }
  }, [isOpen, electionId]);

  const pollStatus = async () => {
    try {
      console.log('Polling status for election:', electionId);
      const data = await electionApi.getDecryptionStatus(electionId);
      console.log('Received status data:', data);
      setStatus(data);
      setError(null);

      // If completed or failed, we can optionally stop polling
      // but keeping it running allows real-time updates if user reopens
    } catch (err) {
      console.error('Error polling status:', err);
      setError(err.message);
    }
  };

  if (!isOpen) {
    // console.log('Modal is closed, not rendering');
    return null;
  }

  console.log('Modal is rendering with status:', status);

  const getPhaseDisplay = () => {
    if (!status || !status.currentPhase) return 'Initializing...';

    switch (status.currentPhase) {
      case 'pending':
        return 'Preparing for decryption...';
      case 'partial_decryption':
        return 'Processing Partial Decryption';
      case 'compensated_shares_generation':
        return `Generating Compensated Shares`;
      case 'completed':
        return 'Decryption Complete';
      case 'error':
        return 'Error Occurred';
      default:
        return status.currentPhase;
    }
  };

  const getStatusColor = () => {
    if (!status) return '#6366f1';
    
    switch (status.status) {
      case 'completed':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      case 'in_progress':
        return '#6366f1';
      default:
        return '#94a3b8';
    }
  };

  const getPhaseIcon = () => {
    if (!status || !status.currentPhase) return '🔄';

    switch (status.currentPhase) {
      case 'pending':
        return '⏳';
      case 'partial_decryption':
        return '🔐';
      case 'compensated_shares_generation':
        return '💫';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '🔄';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Guardian Decryption Progress</h2>
              <p className="text-indigo-100 mt-1">{guardianName || 'Guardian'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!status && !error && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading status...</p>
            </div>
          )}

          {status && (
            <>
              {/* Overall Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getPhaseIcon()} {getPhaseDisplay()}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    status.status === 'completed' ? 'bg-green-100 text-green-800' :
                    status.status === 'failed' ? 'bg-red-100 text-red-800' :
                    status.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {status.status}
                  </span>
                </div>

                {/* Circular Progress */}
                <div className="flex items-center gap-6 mt-4">
                  <div style={{ width: 120, height: 120 }}>
                    <CircularProgressbar
                      value={(() => {
                        const { total, completed } = calculateTotalOperations(status);
                        return total > 0 ? (completed * 100) / total : 0;
                      })()}
                      text={`${Math.round((() => {
                        const { total, completed } = calculateTotalOperations(status);
                        return total > 0 ? (completed * 100) / total : 0;
                      })())}%`}
                      styles={buildStyles({
                        pathColor: getStatusColor(),
                        textColor: getStatusColor(),
                        trailColor: '#e5e7eb',
                        textSize: '16px',
                      })}
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Total Progress (All Operations)</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {(() => {
                              const { total, completed } = calculateTotalOperations(status);
                              return `${completed} / ${total}`;
                            })()}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(() => {
                              const { numChunks, totalGuardians } = calculateTotalOperations(status);
                              return `${numChunks} chunks × ${totalGuardians} guardians`;
                            })()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Current Operation</p>
                          <p className="text-lg font-bold text-indigo-600">
                            {status.currentPhase === 'partial_decryption' 
                              ? 'Partial Decryption'
                              : status.currentPhase === 'compensated_shares_generation'
                              ? 'Compensated Shares'
                              : 'Processing'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Chunk #{status.currentChunkNumber || 0}
                            {status.currentPhase === 'compensated_shares_generation' && status.compensatingForGuardianName && (
                              <span className="block">for {status.compensatingForGuardianName}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      {calculateEstimatedTime(status) && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <p className="text-sm text-gray-600 font-medium">
                            ⏱️ Estimated time remaining (entire process): <span className="text-indigo-600 font-bold">{calculateEstimatedTime(status)}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase Details */}
              {status.currentPhase === 'partial_decryption' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🔐</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-1">
                        Phase 1: Partial Decryption
                      </h4>
                      <p className="text-sm text-blue-700 mb-2">
                        Decrypting your portion of the encrypted tally for each chunk.
                        This process validates your guardian credentials and generates
                        partial decryption shares.
                      </p>
                      
                      <div className="bg-white rounded-lg p-3 mb-3 border border-blue-200">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-blue-600">Current Chunk:</p>
                            <p className="text-blue-900 font-semibold text-lg">
                              #{status.currentChunkNumber || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-blue-600">Phase 1 Progress:</p>
                            <p className="text-blue-900 font-semibold text-lg">
                              {status.processedChunks || 0} / {status.totalChunks || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-blue-500 mb-2">
                        Phase 1 progress:
                      </p>
                      <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-500"
                          style={{ 
                            width: `${(() => {
                              const phaseProgress = status.totalChunks > 0 
                                ? ((status.processedChunks || 0) * 100) / status.totalChunks 
                                : 0;
                              return phaseProgress;
                            })()}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {status.currentPhase === 'compensated_shares_generation' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💫</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-purple-900 mb-1">
                        Phase 2: Compensated Shares Generation
                      </h4>
                      <p className="text-sm text-purple-700 mb-2">
                        Generating backup decryption shares for other guardians.
                        This ensures the election can still be decrypted even if some guardians are unavailable.
                      </p>
                      
                      {status.compensatingForGuardianName && (
                        <div className="bg-white rounded-lg p-3 mb-3 border border-purple-200">
                          <p className="text-sm text-gray-600 mb-1">Current Process:</p>
                          <p className="text-lg font-semibold text-purple-900">
                            💫 Compensating for {status.compensatingForGuardianName}
                          </p>
                          {status.currentChunkNumber > 0 && (
                            <p className="text-xs text-purple-600 mt-1">
                              Processing chunk #{status.currentChunkNumber}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="bg-white rounded-lg p-3 mb-3 border border-purple-200">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-purple-600 mb-1">Guardians Progress</p>
                            <p className="text-lg font-semibold text-purple-900">
                              {status.processedCompensatedGuardians || 0} / {status.totalCompensatedGuardians || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-purple-600 mb-1">Phase 2 Progress</p>
                            <p className="text-lg font-semibold text-purple-900">
                              {status.processedChunks || 0} / {status.totalChunks || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-purple-600 mb-1">Current Chunk</p>
                            <p className="text-lg font-semibold text-purple-900">
                              #{status.currentChunkNumber || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-purple-500 mb-2">
                        Phase 2 progress:
                      </p>
                      <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 transition-all duration-500"
                          style={{ 
                            width: `${(() => {
                              const phaseProgress = status.totalChunks > 0 
                                ? ((status.processedChunks || 0) * 100) / status.totalChunks 
                                : 0;
                              return phaseProgress;
                            })()}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {status.status === 'completed' && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-5 mb-4 shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="text-5xl animate-bounce">🎉</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-green-900 mb-2 text-xl flex items-center gap-2">
                        ✅ Decryption Successfully Completed!
                      </h4>
                      <div className="bg-white rounded-lg p-4 mb-3 border-l-4 border-green-500 shadow-sm">
                        <p className="text-sm text-green-800 font-medium mb-2">
                          Your guardian credentials have been verified and processed successfully.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                          <div className="bg-green-50 rounded p-2">
                            <p className="text-green-600 font-semibold">Total Operations</p>
                            <p className="text-green-900 text-lg font-bold">
                              {(() => {
                                const { total } = calculateTotalOperations(status);
                                return total;
                              })()}
                            </p>
                            <p className="text-green-700 text-xs">
                              {(() => {
                                const { numChunks, totalGuardians } = calculateTotalOperations(status);
                                return `${numChunks} chunks × ${totalGuardians} guardians`;
                              })()}
                            </p>
                          </div>
                          <div className="bg-green-50 rounded p-2">
                            <p className="text-green-600 font-semibold">Backup Shares</p>
                            <p className="text-green-900 text-lg font-bold">{status.totalCompensatedGuardians || 0}</p>
                            <p className="text-green-700 text-xs">for other guardians</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-green-100 rounded p-2">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs text-green-900 font-semibold">Your contribution to the election decryption is complete</p>
                          {status.completedAt && (
                            <p className="text-xs text-green-700">
                              Completed at: {new Date(status.completedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {status.status === 'failed' && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-5 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">🚫</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-red-900 mb-2 text-lg">
                        ❌ Decryption Failed
                      </h4>
                      <div className="bg-white rounded p-3 mb-3 border-l-4 border-red-500">
                        <p className="text-sm text-red-800 font-medium mb-2">
                          {status.errorMessage || 'An error occurred during the decryption process.'}
                        </p>
                      </div>
                      <div className="bg-red-100 rounded p-3 mb-3">
                        <p className="text-xs font-semibold text-red-900 mb-1">What to do next:</p>
                        <ul className="text-xs text-red-800 list-disc list-inside space-y-1">
                          <li>Verify you uploaded the correct <strong>credentials.txt</strong> file</li>
                          <li>The file should be the one emailed to you after guardian assignment</li>
                          <li>If you lost the file, contact the election administrator</li>
                          <li>Close this modal and submit again with the correct file</li>
                        </ul>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-red-700 font-medium">
                          You can retry submission after closing this modal
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-800 mb-3">Process Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.startedAt ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Decryption Initiated</p>
                      {status.startedAt && (
                        <p className="text-xs text-gray-600">
                          {new Date(status.startedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.status === 'in_progress' || status.status === 'completed' 
                        ? 'bg-blue-500 text-white animate-pulse' 
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {status.status === 'in_progress' || status.status === 'completed' ? '⟳' : '○'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Processing Operations</p>
                      <p className="text-xs text-gray-600">
                        {(() => {
                          const { total, completed } = calculateTotalOperations(status);
                          return `${completed} of ${total} operations completed`;
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.status === 'completed' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {status.status === 'completed' ? '✓' : '○'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Decryption Complete</p>
                      {status.completedAt && (
                        <p className="text-xs text-gray-600">
                          {new Date(status.completedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-between items-center gap-3">
          <div className="flex-1">
            {status && status.status === 'failed' && (
              <p className="text-sm text-red-600 font-medium">
                ⚠️ Close this modal and submit the correct credentials file
              </p>
            )}
            {status && status.status === 'in_progress' && (
              <p className="text-sm text-blue-600 font-medium">
                🔄 Processing continues in background after closing
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {status && status.status === 'completed' && (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
              >
                ✓ Done
              </button>
            )}
            {status && status.status === 'failed' && (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-md"
              >
                Close & Retry
              </button>
            )}
            {status && status.status === 'in_progress' && (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                Close (Running in Background)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecryptionProgressModal;
