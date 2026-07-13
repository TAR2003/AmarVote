import React, { useState, useEffect, useCallback, useRef } from 'react';
import ModalOverlay, { ModalPanel } from './ModalOverlay';
import { FiRefreshCw } from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { electionApi } from '../utils/electionApi';
import useElectionProgressStream from '../hooks/useElectionProgressStream';
import { timezoneUtils } from '../utils/timezoneUtils';
import {
  getSnapshotFromEvent,
  pickCombine,
  shouldApplyCombineEvent,
} from '../utils/progressSnapshot';

const CombineProgressModal = ({ isOpen, onClose, electionId, onCombineComplete }) => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const completionHandledRef = useRef(false);

  // Calculate estimated time remaining
  const calculateEstimatedTime = (status) => {
    if (!status || !status.startedAt || status.processedChunks === 0 || !status.totalChunks) {
      return null;
    }

    const startTime = new Date(status.startedAt).getTime();
    const currentTime = Date.now();
    const elapsedMs = currentTime - startTime;
    
    const chunksProcessed = status.processedChunks || 0;
    const totalChunks = status.totalChunks || 1;
    const chunksRemaining = totalChunks - chunksProcessed;
    
    if (chunksProcessed === 0) return null;
    
    const msPerChunk = elapsedMs / chunksProcessed;
    const estimatedRemainingMs = msPerChunk * chunksRemaining;
    
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

  const handleCombineCompleted = useCallback((combineStatus) => {
    if (combineStatus?.status !== 'completed' || completionHandledRef.current) {
      return;
    }
    completionHandledRef.current = true;
    if (onCombineComplete) {
      setTimeout(() => {
        onCombineComplete();
      }, 1500);
    }
  }, [onCombineComplete]);

  const applyCombineFromEvent = useCallback((event) => {
    if (!shouldApplyCombineEvent(event)) return;
    const combine = pickCombine(getSnapshotFromEvent(event));
    if (!combine) return;
    setStatus((prev) => {
      if (prev?.status === 'completed' || prev?.status === 'failed') {
        if (combine.status !== 'completed' && combine.status !== 'failed' && combine.status !== 'stopped' && combine.status !== 'deleted') {
          return prev;
        }
      }
      return combine;
    });
    setError(null);
    handleCombineCompleted(combine);
  }, [handleCombineCompleted]);

  const refreshStatus = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsRefreshing(true);
    try {
      const data = await electionApi.getCombineStatus(electionId);
      setStatus((prev) => {
        if (prev?.status === 'completed' || prev?.status === 'failed') {
          if (data?.status !== 'completed' && data?.status !== 'failed' && data?.status !== 'stopped') {
            return prev;
          }
        }
        return data;
      });
      setError(null);
      handleCombineCompleted(data);
      return data;
    } catch (err) {
      console.error('Error refreshing combine status:', err);
      if (!silent) setError(err.message);
      return null;
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [electionId, handleCombineCompleted]);

  useEffect(() => {
    if (!isOpen) {
      setStatus(null);
      setError(null);
      return;
    }
    if (!electionId) return;

    completionHandledRef.current = false;
    let cancelled = false;
    refreshStatus().finally(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, electionId, refreshStatus]);

  const { connected: sseConnected } = useElectionProgressStream(electionId, {
    enabled: isOpen && Boolean(electionId),
    onEvent: applyCombineFromEvent,
  });

  // Fallback poll only while SSE is down — avoid hammering status APIs every 2s
  useEffect(() => {
    if (!isOpen || !electionId || sseConnected) return;
    const terminal = status?.status === 'completed' || status?.status === 'failed' || status?.status === 'stopped';
    if (terminal) return;

    const interval = setInterval(() => {
      refreshStatus({ silent: true });
    }, 12000);

    return () => clearInterval(interval);
  }, [isOpen, electionId, sseConnected, status?.status, refreshStatus]);

  if (!isOpen) return null;

  const getStatusDisplay = () => {
    if (!status || !status.status) return 'Initializing...';

    switch (status.status) {
      case 'pending':
        return 'Preparing to combine decryptions...';
      case 'in_progress':
        return 'Combining Partial Decryptions';
      case 'completed':
        return 'Combination Complete';
      case 'stopped':
        return 'Combination Stopped';
      case 'failed':
        return 'Combination Failed';
      default:
        return status.status;
    }
  };

  const getStatusColor = () => {
    if (!status) return '#8B7FE8';
    
    switch (status.status) {
      case 'completed':
        return '#10b981';
      case 'stopped':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      case 'in_progress':
        return '#8B7FE8';
      default:
        return '#94a3b8';
    }
  };

  const getStatusIcon = () => {
    if (!status || !status.status) return '';

    switch (status.status) {
      case 'pending':
        return '';
      case 'in_progress':
        return '';
      case 'completed':
        return '';
      case 'stopped':
        return '';
      case 'failed':
        return '';
      default:
        return '';
    }
  };

  return (
    <ModalOverlay onClose={onClose} dismissible>
      <ModalPanel size="xl" surface="deep">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="rounded-t-3xl border-b border-white/10 bg-ink/80 px-5 py-4 text-paper sm:rounded-t-2xl sm:px-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-threshold">Threshold</p>
              <h2 className="font-display text-xl font-bold sm:text-2xl">Combine partial decryptions</h2>
              <p className="mt-1 text-sm text-paper-muted">Lagrange combine of guardian shares into the election result</p>
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
            <div className="bg-ember-soft border border-ember/30 text-ember px-4 py-3 rounded-lg mb-4">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!status && !error && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
              <p className="text-dusk mt-4">Loading combine status…</p>
            </div>
          )}

          {status && (
            <>
              {/* Lock Metadata Display */}
              {status.isLocked && status.lockHeldBy && (
                <div className="bg-ceremonial-soft border-l-4 border-ceremonial rounded-2xl p-4 mb-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl"></div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-ink mb-2">
                        Task In Progress
                      </h4>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-ink font-medium">Initiated by:</span>
                          <span className="text-ink font-semibold bg-ceremonial-soft px-2 py-0.5 rounded">
                            {status.lockHeldBy}
                          </span>
                        </div>
                        {status.lockStartTime && (
                          <div className="flex items-center gap-2">
                            <span className="text-ink font-medium">Started at:</span>
                            <span className="text-ink font-semibold">
                              {timezoneUtils.formatDateTime(status.lockStartTime)}
                            </span>
                          </div>
                        )}
                        <p className="text-ink text-xs mt-2 italic">
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
                    {getStatusIcon()} {getStatusDisplay()}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    status.status === 'completed' ? 'bg-sage-soft text-aurora-muted' :
                    status.status === 'stopped' ? 'bg-ceremonial-soft text-ink' :
                    status.status === 'failed' ? 'bg-ember-soft text-ember' :
                    status.status === 'in_progress' ? 'bg-glacier text-ink' :
                    'bg-frost text-ink'
                  }`}>
                    {status.status.toUpperCase()}
                  </span>
                </div>

                {/* Circular Progress Bar */}
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32">
                    <CircularProgressbar
                      value={status.progressPercentage || 0}
                      text={`${Math.round(status.progressPercentage || 0)}%`}
                      styles={buildStyles({
                        textSize: '20px',
                        pathColor: getStatusColor(),
                        textColor: getStatusColor(),
                        trailColor: '#e5e7eb',
                        pathTransitionDuration: 0.5,
                      })}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="space-y-2">
                      {status.totalChunks > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-dusk">Chunks Processed:</span>
                          <span className="font-semibold text-ink">
                            {status.processedChunks} / {status.totalChunks}
                          </span>
                        </div>
                      )}
                      {calculateEstimatedTime(status) && status.status === 'in_progress' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-dusk">Est. Time Remaining:</span>
                          <span className="font-semibold text-brand-dark">
                             {calculateEstimatedTime(status)}
                          </span>
                        </div>
                      )}
                      {/* Task Metadata */}
                      {(status.createdBy || status.lockHeldBy) && (
                        <div className="flex justify-between text-sm pt-2 border-t border-ink/10">
                          <span className="text-dusk">Initiated By:</span>
                          <span className="font-semibold text-ink">{status.createdBy || status.lockHeldBy}</span>
                        </div>
                      )}
                      {(status.startedAt || status.lockStartTime) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-dusk">Started:</span>
                          <span className="font-semibold text-ink">
                            {timezoneUtils.formatTimeOnly(status.startedAt || status.lockStartTime)}
                          </span>
                        </div>
                      )}
                      {status.completedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-dusk">Completed:</span>
                          <span className="font-semibold text-ink">
                            {timezoneUtils.formatTimeOnly(status.completedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {status.errorMessage && (
                <div className="bg-ember-soft border border-ember/30 rounded-2xl p-4 mb-6">
                  <h4 className="font-semibold text-ember mb-2">Error Details</h4>
                  <p className="text-sm text-ember">{status.errorMessage}</p>
                </div>
              )}

              {/* Processing Indicator */}
              {status.status === 'in_progress' && (
                <div className="bg-glacier border border-brand/20 rounded-2xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand"></div>
                    <span className="text-ink font-medium">
                      {status.processedChunks > 0 
                        ? `Processing chunk ${status.processedChunks}/${status.totalChunks}...`
                        : 'Starting combination process...'}
                    </span>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-ink mb-3">Process Timeline</h4>
                <div className="space-y-3">
                  {/* Pending */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      ['pending', 'in_progress', 'completed'].includes(status.status)
                        ? 'bg-glacier text-brand'
                        : 'bg-frost text-dusk'
                    }`}>
                      ✓
                    </div>
                    <div>
                      <p className="font-medium text-ink">Initiated</p>
                      <p className="text-sm text-dusk">Combine process started</p>
                    </div>
                  </div>

                  {/* In Progress */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      ['in_progress', 'completed'].includes(status.status)
                        ? 'bg-glacier text-brand'
                        : 'bg-frost text-dusk'
                    }`}>
                      {status.status === 'in_progress' ? '⟳' : '✓'}
                    </div>
                    <div>
                      <p className="font-medium text-ink">Processing Chunks</p>
                      <p className="text-sm text-dusk">
                        Combining decryption shares from guardians
                      </p>
                    </div>
                  </div>

                  {/* Completed */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.status === 'completed'
                        ? 'bg-sage-soft text-sage'
                        : 'bg-frost text-dusk'
                    }`}>
                      ✓
                    </div>
                    <div>
                      <p className="font-medium text-ink">Complete</p>
                      <p className="text-sm text-dusk">Election results available</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-white/10 bg-ink/60 px-5 py-4 sm:px-6">
          {status?.status === 'completed' && (
            <button
              onClick={onClose}
              className="px-4 py-2 btn-brand bg-sage hover:bg-aurora-muted"
            >
              View Results
            </button>
          )}
          {status?.status === 'stopped' && (
            <div className="mt-4 rounded-lg border border-ceremonial/40 bg-ceremonial-soft p-4 text-sm text-ink">
              Combine was stopped before all chunks finished. Start combine again to resume remaining chunks.
            </div>
          )}

          {status?.status !== 'completed' && status?.status !== 'stopped' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-ink/10 text-dusk rounded-lg hover:bg-ink/20 transition-colors font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
      </ModalPanel>
    </ModalOverlay>
  );
};

export default CombineProgressModal;
