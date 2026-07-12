import React, { useState, useEffect } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { electionApi } from '../utils/electionApi';
import { timezoneUtils } from '../utils/timezoneUtils';
import useElectionProgressStream from '../hooks/useElectionProgressStream';
import {
  getSnapshotFromEvent,
  pickDecryptionDetail,
  pickMyDecryption,
  shouldApplyDecryptionEvent,
} from '../utils/progressSnapshot';

const DecryptionProgressModal = ({ isOpen, onClose, electionId, guardianName }) => {
  const [status, setStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Calculate total operations (n * m where n = chunks, m = guardians)
  // EDGE CASE: When there's only 1 guardian, no compensated shares are needed
  const calculateTotalOperations = (status) => {
    if (!status) return { total: 0, completed: 0, numChunks: 0, totalGuardians: 0 };
    
    // Get the number of other guardians (m-1)
    const otherGuardians = status.totalCompensatedGuardians || 0;
    
    // Get the number of total guardians (m) = 1 (self) + other guardians
    const totalGuardians = otherGuardians + 1;
    
    // Backend now returns totalChunks and processedChunks correctly based on phase:
    // - During partial_decryption: totalChunks = n, processedChunks = partial completed (0...n)
    // - During compensated_shares_generation: totalChunks = n×(m-1), processedChunks = compensated completed (0...n×(m-1))
    
    // Determine the actual number of chunks (n)
    let numChunks;
    
    if (status.currentPhase === 'partial_decryption') {
      // In Phase 1, totalChunks = n (actual number of chunks)
      numChunks = status.totalChunks || 0;
    } else if (status.currentPhase === 'compensated_shares_generation') {
      // In Phase 2, backend returns totalChunks = n × (m-1)
      // So n = totalChunks / (m-1)
      if (otherGuardians > 0) {
        numChunks = Math.floor((status.totalChunks || 0) / otherGuardians);
      } else {
        // Fallback: if no other guardians (single guardian), use totalChunks
        numChunks = status.totalChunks || 0;
      }
    } else if (status.status === 'completed' || status.currentPhase === 'completed') {
      // FIXED: Backend now returns the actual chunk count (n) when completed
      // No need for reverse-calculation anymore
      numChunks = status.totalChunks || 0;
    } else {
      // Fallback for pending/other phases
      numChunks = status.totalChunks || 0;
    }
    
    // EDGE CASE FIX: When there's only 1 guardian (otherGuardians = 0),
    // there's no Phase 2 (compensated shares), so total operations = n (just Phase 1)
    // Otherwise, total operations = n + n×(m-1) = n×m
    const totalOperations = otherGuardians === 0 ? numChunks : numChunks * totalGuardians;
    
    // Calculate completed operations based on current phase
    let completedOperations = 0;
    
    if (status.currentPhase === 'partial_decryption') {
      // In Phase 1: processedChunks = partial decryption completed (0...n)
      completedOperations = status.processedChunks || 0;
    } else if (status.currentPhase === 'compensated_shares_generation') {
      // In Phase 2: all Phase 1 complete (n) + compensated processed
      // Backend returns processedChunks = compensated completed (0...n×(m-1))
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
      completedOperations,
      singleGuardian: otherGuardians === 0
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

  const applyDecryptionFromEvent = (event) => {
    if (!shouldApplyDecryptionEvent(event)) return;
    const snapshot = getSnapshotFromEvent(event);
    if (!snapshot) return;

    const myDecryption = pickMyDecryption(snapshot);
    if (myDecryption) {
      setStatus(myDecryption);
      setError(null);
      return;
    }

    const detail = pickDecryptionDetail(snapshot);
    if (!detail) return;

    setStatus((prev) => {
      if (!prev?.guardianEmail) return detail;
      if (detail.guardianEmail && detail.guardianEmail !== prev.guardianEmail) {
        return prev;
      }
      return detail;
    });
    setError(null);
  };

  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const data = await electionApi.getDecryptionStatus(electionId);
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error('Error refreshing decryption status:', err);
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setStatus(null);
      setError(null);
    }
  }, [isOpen]);

  useElectionProgressStream(electionId, {
    enabled: isOpen && Boolean(electionId),
    onEvent: applyDecryptionFromEvent,
  });

  if (!isOpen) {
    return null;
  }

  const getPhaseDisplay = () => {
    if (!status || !status.currentPhase) {
      // If status is pending or in_progress, show appropriate message
      if (status && status.status === 'pending') {
        return ' Processing Partial Decryption';
      }
      if (status && status.status === 'in_progress') {
        return ' Processing Decryption';
      }
      return 'Initializing...';
    }

    switch (status.currentPhase) {
      case 'pending':
        return 'Preparing for decryption...';
      case 'partial_decryption':
        return 'Processing Partial Decryption';
      case 'compensated_shares_generation':
        return `Generating Compensated Shares`;
      case 'completed':
        return 'Decryption Complete';
      case 'stopped':
        return 'Decryption Stopped';
      case 'error':
        return 'Error Occurred';
      default:
        return status.currentPhase;
    }
  };

  const getStatusColor = () => {
    if (!status) return '#00B4D8';
    
    switch (status.status) {
      case 'completed':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      case 'in_progress':
        return '#00B4D8';
      default:
        return '#94a3b8';
    }
  };

  const getPhaseIcon = () => {
    if (!status || !status.currentPhase) return '';

    switch (status.currentPhase) {
      case 'pending':
        return '';
      case 'partial_decryption':
        return '';
      case 'compensated_shares_generation':
        return '';
      case 'completed':
        return '';
      case 'error':
        return '';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-deep/75 p-0 backdrop-blur-[8px] sm:items-center sm:p-4">
      <div className="observatory-panel w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl">
        {/* Header */}
        <div className="rounded-t-3xl border-b border-white/10 bg-ink/80 px-5 py-4 text-paper sm:rounded-t-2xl sm:px-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-threshold">Partial decryption</p>
              <h2 className="font-display text-xl font-bold sm:text-2xl">Guardian share progress</h2>
              <p className="mt-1 text-sm text-paper-muted">{guardianName || 'Guardian'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshStatus}
                disabled={isRefreshing}
                className="text-paper-muted hover:text-paper transition-colors disabled:opacity-50 w-8 h-8 flex items-center justify-center"
                aria-label="Refresh status"
                title="Refresh status"
              >
                <FiRefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="text-paper-muted hover:text-paper transition-colors font-display text-xl font-bold sm:text-2xl w-8 h-8 flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-frost/95 p-5 text-ink sm:p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!status && !error && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
              <p className="text-slate-600 mt-4">Connecting to live progress…</p>
            </div>
          )}

          {status && (
            <>
              {/* Lock Metadata Display */}
              {status.isLocked && status.lockHeldBy && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-2xl p-4 mb-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl"></div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 mb-2">
                        Task In Progress
                      </h4>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 font-medium">Initiated by:</span>
                          <span className="text-amber-900 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                            {status.lockHeldBy}
                          </span>
                        </div>
                        {status.lockStartTime && (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-700 font-medium">Started at:</span>
                            <span className="text-amber-900 font-semibold">
                              {timezoneUtils.formatDateTime(status.lockStartTime)}
                            </span>
                          </div>
                        )}
                        <p className="text-amber-700 text-xs mt-2 italic">
                          This task is currently being processed. Multiple simultaneous requests are prevented to avoid duplicate operations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Overall Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-ink">
                    {getPhaseIcon()} {getPhaseDisplay()}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    status.status === 'completed' ? 'bg-sage-soft text-emerald-800' :
                    status.status === 'stopped' ? 'bg-amber-100 text-amber-800' :
                    status.status === 'failed' ? 'bg-red-100 text-red-800' :
                    status.status === 'in_progress' ? 'bg-glacier text-ink' :
                    'bg-frost text-ink'
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
                    <div className="bg-frost rounded-2xl p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">Total Progress (All Operations)</p>
                          <p className="font-display text-xl font-bold sm:text-2xl text-deep">
                            {(() => {
                              const { total, completed } = calculateTotalOperations(status);
                              return `${completed} / ${total}`;
                            })()}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(() => {
                              const { numChunks, totalGuardians } = calculateTotalOperations(status);
                              // Show appropriate message based on guardian count
                              if (totalGuardians === 1) {
                                return `${numChunks} chunks (single guardian - no compensated shares needed)`;
                              }
                              return `${numChunks} chunks × ${totalGuardians} guardians`;
                            })()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Current Operation</p>
                          <p className="text-lg font-bold text-brand-dark">
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
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm text-slate-600 font-medium">
                             Estimated time remaining (entire process): <span className="text-brand-dark font-bold">{calculateEstimatedTime(status)}</span>
                          </p>
                        </div>
                      )}
                      
                      {/* Task Metadata */}
                      {(status.startedAt || status.lockStartTime) && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                          {status.guardianEmail && (
                            <p className="text-sm text-slate-600">
                              <span className="font-medium">Guardian:</span>{' '}
                              <span className="text-deep font-semibold">{status.guardianEmail}</span>
                            </p>
                          )}
                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Started:</span>{' '}
                            <span className="text-deep">{timezoneUtils.formatDateTime(status.startedAt || status.lockStartTime)}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase Details */}
              {status.currentPhase === 'partial_decryption' && (
                <div className="bg-glacier border border-brand/20 rounded-2xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl"></div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-deep mb-1">
                        Phase 1: Partial Decryption
                      </h4>
                      <p className="text-sm text-brand-dark mb-2">
                        Decrypting your portion of the encrypted tally for each chunk.
                        This process validates your guardian credentials and generates
                        partial decryption shares.
                      </p>
                      
                      <div className="bg-white rounded-lg p-3 mb-3 border border-brand/20">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-brand">Current Chunk:</p>
                            <p className="text-deep font-semibold text-lg">
                              #{status.currentChunkNumber || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-brand">Phase 1 Progress:</p>
                            <p className="text-deep font-semibold text-lg">
                              {status.processedChunks || 0} / {status.totalChunks || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-brand mb-2">
                        Phase 1 progress:
                      </p>
                      <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand transition-all duration-500"
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
                <div className="bg-glacier border border-brand/20 rounded-2xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl"></div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-deep mb-1">
                        Phase 2: Compensated Shares Generation
                      </h4>
                      <p className="text-sm text-ink mb-2">
                        Generating backup decryption shares for other guardians.
                        This ensures the election can still be decrypted even if some guardians are unavailable.
                      </p>
                      
                      {status.compensatingForGuardianName && (
                        <div className="bg-white rounded-lg p-3 mb-3 border border-brand/20">
                          <p className="text-sm text-slate-600 mb-1">Current Process:</p>
                          <p className="text-lg font-semibold text-deep">
                             Compensating for {status.compensatingForGuardianName}
                          </p>
                          {status.currentChunkNumber > 0 && (
                            <p className="text-xs text-brand-dark mt-1">
                              Processing chunk #{status.currentChunkNumber}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="bg-white rounded-lg p-3 mb-3 border border-brand/20">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-brand-dark mb-1">Guardians Progress</p>
                            <p className="text-lg font-semibold text-deep">
                              {status.processedCompensatedGuardians || 0} / {status.totalCompensatedGuardians || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-dark mb-1">Phase 2 Progress</p>
                            <p className="text-lg font-semibold text-deep">
                              {status.processedChunks || 0} / {status.totalChunks || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-dark mb-1">Current Chunk</p>
                            <p className="text-lg font-semibold text-deep">
                              #{status.currentChunkNumber || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-brand-dark mb-2">
                        Phase 2 progress:
                      </p>
                      <div className="h-2 bg-glacier rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ink transition-all duration-500"
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
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-5 mb-4 shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="text-5xl animate-bounce"></div>
                    <div className="flex-1">
                      <h4 className="font-bold text-green-900 mb-2 text-xl flex items-center gap-2">
                         Decryption Successfully Completed!
                      </h4>
                      <div className="bg-white rounded-2xl p-4 mb-3 border-l-4 border-green-500 shadow-sm">
                        <p className="text-sm text-emerald-800 font-medium mb-2">
                          Your guardian credentials have been verified and processed successfully.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                          <div className="bg-sage-soft rounded p-2">
                            <p className="text-sage font-semibold">Total Operations</p>
                            <p className="text-green-900 text-lg font-bold">
                              {(() => {
                                const { total } = calculateTotalOperations(status);
                                return total;
                              })()}
                            </p>
                            <p className="text-sage text-xs">
                              {(() => {
                                const { numChunks, totalGuardians } = calculateTotalOperations(status);
                                if (totalGuardians === 1) {
                                  return `${numChunks} chunks (single guardian)`;
                                }
                                return `${numChunks} chunks × ${totalGuardians} guardians`;
                              })()}
                            </p>
                          </div>
                          <div className="bg-sage-soft rounded p-2">
                            <p className="text-sage font-semibold">Backup Shares</p>
                            <p className="text-green-900 text-lg font-bold">{status.totalCompensatedGuardians || 0}</p>
                            <p className="text-sage text-xs">
                              {status.totalCompensatedGuardians === 0
                                ? 'none needed (single guardian)'
                                : 'for other guardians'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-sage-soft rounded p-2">
                        <svg className="w-5 h-5 text-sage" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs text-green-900 font-semibold">Your contribution to the election decryption is complete</p>
                          {status.completedAt && (
                            <p className="text-xs text-sage">
                              Completed at: {timezoneUtils.formatDateTime(status.completedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {status.status === 'failed' && (
                <div className="bg-red-50 border border-red-300 rounded-2xl p-5 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl"></div>
                    <div className="flex-1">
                      <h4 className="font-bold text-red-900 mb-2 text-lg">
                         Decryption Failed
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
                          <li>The file should be the one provided after guardian assignment</li>
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
                <h4 className="font-semibold text-ink mb-3">Process Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.startedAt ? 'bg-sage text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-deep">Decryption Initiated</p>
                      {status.startedAt && (
                        <p className="text-xs text-slate-600">
                          {timezoneUtils.formatDateTime(status.startedAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.status === 'in_progress' || status.status === 'completed' 
                        ? 'bg-brand-dark text-paper animate-pulse' 
                        : 'bg-slate-300 text-slate-600'
                    }`}>
                      {status.status === 'in_progress' || status.status === 'completed' ? '⟳' : '○'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-deep">Processing Operations</p>
                      <p className="text-xs text-slate-600">
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
                        ? 'bg-sage text-white' 
                        : 'bg-slate-300 text-slate-600'
                    }`}>
                      {status.status === 'completed' ? '✓' : '○'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-deep">Decryption Complete</p>
                      {status.completedAt && (
                        <p className="text-xs text-slate-600">
                          {timezoneUtils.formatDateTime(status.completedAt)}
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
        <div className="border-t border-white/10 bg-ink/60 px-5 py-4 sm:px-6 flex justify-between items-center gap-3">
          <div className="flex-1">
            {status && status.status === 'failed' && (
              <p className="text-sm text-red-600 font-medium">
                 Close this modal and submit the correct credentials file
              </p>
            )}
            {status && status.status === 'stopped' && (
              <p className="text-sm text-amber-700 font-medium">
                 Decryption stopped. Submit credentials again to resume remaining chunks.
              </p>
            )}
            {status && status.status === 'in_progress' && (
              <p className="text-sm text-brand font-medium">
                 Processing continues in background after closing
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
            {status && status.status === 'stopped' && (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors shadow-md"
              >
                Close
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
