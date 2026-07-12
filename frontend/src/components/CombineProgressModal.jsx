import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    setStatus(combine);
    setError(null);
    handleCombineCompleted(combine);
  }, [handleCombineCompleted]);

  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await electionApi.getCombineStatus(electionId);
      setStatus(data);
      setError(null);
      handleCombineCompleted(data);
    } catch (err) {
      console.error('Error refreshing combine status:', err);
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  }, [electionId, handleCombineCompleted]);

  useEffect(() => {
    if (isOpen && electionId) {
      completionHandledRef.current = false;
    } else if (!isOpen) {
      setStatus(null);
      setError(null);
    }
  }, [isOpen, electionId]);

  useElectionProgressStream(electionId, {
    enabled: isOpen && Boolean(electionId),
    onEvent: applyCombineFromEvent,
  });

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
    if (!status) return '#6366f1';
    
    switch (status.status) {
      case 'completed':
        return '#10b981';
      case 'stopped':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      case 'in_progress':
        return '#6366f1';
      default:
        return '#94a3b8';
    }
  };

  const getStatusIcon = () => {
    if (!status || !status.status) return '🔄';

    switch (status.status) {
      case 'pending':
        return '⏳';
      case 'in_progress':
        return '🔐';
      case 'completed':
        return '✅';
      case 'stopped':
        return '⏸️';
      case 'failed':
        return '❌';
      default:
        return '🔄';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand to-purple-600 text-white px-6 py-4 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Combine Partial Decryptions</h2>
              <p className="text-glacier mt-1">Processing encrypted votes</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshStatus}
                disabled={isRefreshing}
                className="text-white hover:text-gray-200 transition-colors disabled:opacity-50 w-8 h-8 flex items-center justify-center"
                aria-label="Refresh status"
                title="Refresh status"
              >
                <FiRefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>
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
              <p className="text-gray-600 mt-4">Connecting to live progress…</p>
            </div>
          )}

          {status && (
            <>
              {/* Lock Metadata Display */}
              {status.isLocked && status.lockHeldBy && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 mb-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🔒</div>
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
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getStatusIcon()} {getStatusDisplay()}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    status.status === 'completed' ? 'bg-sage-soft text-emerald-800' :
                    status.status === 'stopped' ? 'bg-amber-100 text-amber-800' :
                    status.status === 'failed' ? 'bg-red-100 text-red-800' :
                    status.status === 'in_progress' ? 'bg-glacier text-ink' :
                    'bg-gray-100 text-gray-800'
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
                          <span className="text-gray-600">Chunks Processed:</span>
                          <span className="font-semibold text-gray-800">
                            {status.processedChunks} / {status.totalChunks}
                          </span>
                        </div>
                      )}
                      {calculateEstimatedTime(status) && status.status === 'in_progress' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Est. Time Remaining:</span>
                          <span className="font-semibold text-brand-dark">
                            ⏱️ {calculateEstimatedTime(status)}
                          </span>
                        </div>
                      )}
                      {/* Task Metadata */}
                      {(status.createdBy || status.lockHeldBy) && (
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-300">
                          <span className="text-gray-600">Initiated By:</span>
                          <span className="font-semibold text-gray-800">{status.createdBy || status.lockHeldBy}</span>
                        </div>
                      )}
                      {(status.startedAt || status.lockStartTime) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Started:</span>
                          <span className="font-semibold text-gray-800">
                            {timezoneUtils.formatTimeOnly(status.startedAt || status.lockStartTime)}
                          </span>
                        </div>
                      )}
                      {status.completedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Completed:</span>
                          <span className="font-semibold text-gray-800">
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
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-red-800 mb-2">Error Details</h4>
                  <p className="text-sm text-red-700">{status.errorMessage}</p>
                </div>
              )}

              {/* Processing Indicator */}
              {status.status === 'in_progress' && (
                <div className="bg-glacier border border-brand/20 rounded-lg p-4 mb-6">
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
                <h4 className="font-semibold text-gray-800 mb-3">Process Timeline</h4>
                <div className="space-y-3">
                  {/* Pending */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      ['pending', 'in_progress', 'completed'].includes(status.status)
                        ? 'bg-glacier text-brand'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      ✓
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Initiated</p>
                      <p className="text-sm text-gray-500">Combine process started</p>
                    </div>
                  </div>

                  {/* In Progress */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      ['in_progress', 'completed'].includes(status.status)
                        ? 'bg-glacier text-brand'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {status.status === 'in_progress' ? '⟳' : '✓'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Processing Chunks</p>
                      <p className="text-sm text-gray-500">
                        Combining decryption shares from guardians
                      </p>
                    </div>
                  </div>

                  {/* Completed */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.status === 'completed'
                        ? 'bg-sage-soft text-sage'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      ✓
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Complete</p>
                      <p className="text-sm text-gray-500">Election results available</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
          {status?.status === 'completed' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              View Results
            </button>
          )}
          {status?.status === 'stopped' && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Combine was stopped before all chunks finished. Start combine again to resume remaining chunks.
            </div>
          )}

          {status?.status !== 'completed' && status?.status !== 'stopped' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CombineProgressModal;
