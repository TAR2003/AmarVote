import React, { useState, useEffect } from 'react';
import { FiLoader, FiCheckCircle, FiAlertCircle, FiX, FiRefreshCw } from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import useElectionProgressStream from '../hooks/useElectionProgressStream';
import {
  getSnapshotFromEvent,
  pickTally,
  shouldApplyTallyEvent,
} from '../utils/progressSnapshot';

const TallyCreationModal = ({ isOpen, onClose, electionId, electionApi, onStatusChange }) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const updateStatus = (next) => {
    setStatus(next);
    onStatusChange?.(next);
  };

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

  const applyTallyFromEvent = (event) => {
    if (!shouldApplyTallyEvent(event)) return;
    const tally = pickTally(getSnapshotFromEvent(event));
    if (tally) {
      updateStatus(tally);
      setError(null);
    }
  };

  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const statusData = await electionApi.getTallyStatus(electionId);
      updateStatus(statusData);
      setError(null);
      return statusData;
    } catch (err) {
      console.error('Error refreshing tally status:', err);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setStatus(null);
      setError(null);
      setIsConnecting(false);
      return;
    }

    let cancelled = false;
    setIsConnecting(true);
    refreshStatus().finally(() => {
      if (!cancelled) {
        setIsConnecting(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, electionId]);

  useElectionProgressStream(electionId, {
    enabled: isOpen && Boolean(electionId),
    onEvent: applyTallyFromEvent,
  });

  const handleCreateTally = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await electionApi.initiateTallyCreation(electionId);

      if (response.success) {
        setError(null);
        const totalFromResponse = (() => {
          const marker = response.encryptedTally || '';
          const initiated = marker.match(/^INITIATED:(\d+)/);
          if (initiated) return Number(initiated[1]);
          const resuming = marker.match(/^RESUMING:\d+\/(\d+)/);
          if (resuming) return Number(resuming[1]);
          return status?.totalChunks || 0;
        })();

        setStatus((prev) => {
          const next = {
            ...(prev || {}),
            success: true,
            status: response.encryptedTally === 'COMPLETED' ? 'completed' : 'in_progress',
            totalChunks: totalFromResponse || prev?.totalChunks || 0,
            processedChunks: prev?.processedChunks || 0,
            progressPercentage: prev?.progressPercentage || 0,
            message: response.message,
          };
          onStatusChange?.(next);
          return next;
        });

        await refreshStatus();
      } else {
        setError(response.message || 'Failed to initiate tally creation');
      }
    } catch (err) {
      setError(err.message || 'Failed to initiate tally creation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  if (!status) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 relative">
          <div className="border-b border-gray-200 p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Tally Creation</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div className="p-6 text-center py-8">
            <FiLoader className="h-10 w-10 text-blue-500 mx-auto animate-spin" />
            <p className="text-gray-600 mt-4">
              {isConnecting ? 'Loading tally status…' : 'Connecting to live progress…'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusDisplay = () => {
    if (!status || status.status === 'not_started') {
      return (
        <div className="text-center py-8">
          <div className="mb-6">
            <FiRefreshCw className="h-16 w-16 text-blue-500 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Ready to Create Tally
          </h3>
          <p className="text-gray-600 mb-6">
            Click the button below to start creating the encrypted tally for this election.
            This process may take a few minutes depending on the number of votes.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center text-red-800">
                <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}
          <button
            onClick={handleCreateTally}
            disabled={isLoading}
            className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <FiLoader className="h-5 w-5 animate-spin" />
                <span>Initiating...</span>
              </div>
            ) : (
              'Create Tally'
            )}
          </button>
        </div>
      );
    }

    if (status.status === 'in_progress' || status.status === 'pending') {
      const progress = status.progressPercentage || 0;
      const estimatedTime = calculateEstimatedTime(status);
      
      return (
        <div className="text-center py-8">
          {/* Lock Metadata Display */}
          {status.isLocked && status.lockHeldBy && (
            <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 mb-6 text-left shadow-sm">
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
                          {new Date(status.lockStartTime).toLocaleString()}
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
          
          <div className="mb-6 flex justify-center">
            <div style={{ width: 150, height: 150 }}>
              <CircularProgressbar
                value={progress}
                text={`${Math.round(progress)}%`}
                styles={buildStyles({
                  textSize: '16px',
                  pathColor: '#3b82f6',
                  textColor: '#1f2937',
                  trailColor: '#e5e7eb',
                })}
              />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Creating Encrypted Tally...
          </h3>
          <div className="space-y-2 mb-6">
            <p className="text-gray-600">
              Processing chunks: {status.processedChunks || 0} / {status.totalChunks || 0}
            </p>
            {estimatedTime && (
              <p className="text-sm text-indigo-600 font-medium">
                ⏱️ Estimated time remaining: {estimatedTime}
              </p>
            )}
            {/* Task Metadata */}
            {(status.createdBy || status.lockHeldBy) && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Initiated by:</span>{' '}
                  <span className="text-gray-900 font-semibold">
                    {status.createdBy || status.lockHeldBy}
                  </span>
                </p>
                {(status.startedAt || status.lockStartTime) && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Started:</span>{' '}
                    <span className="text-gray-900">
                      {new Date(status.startedAt || status.lockStartTime).toLocaleString()}
                    </span>
                  </p>
                )}
              </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center text-blue-800">
              <FiLoader className="h-5 w-5 mr-2 animate-spin flex-shrink-0" />
              <span className="text-sm">
                Tally creation in progress. Please wait...
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (status.status === 'stopped') {
      const progress = status.progressPercentage || 0;
      return (
        <div className="text-center py-8">
          <div className="mb-6">
            <FiAlertCircle className="h-16 w-16 text-amber-500 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Tally Creation Stopped
          </h3>
          <p className="text-gray-600 mb-4">
            Processing was stopped before all chunks finished.
          </p>
          <p className="text-sm text-gray-700 mb-6">
            Completed {status.processedChunks || 0} of {status.totalChunks || 0} chunks ({Math.round(progress)}%)
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <button
            onClick={handleCreateTally}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <FiLoader className="h-5 w-5 animate-spin" />
                <span>Resuming...</span>
              </div>
            ) : (
              'Resume Tally Creation'
            )}
          </button>
        </div>
      );
    }

    if (status.status === 'completed') {
      return (
        <div className="text-center py-8">
          <div className="mb-6">
            <FiCheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Tally Created Successfully!
          </h3>
          <p className="text-gray-600 mb-4">
            The encrypted tally has been successfully created.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Processed {status.processedChunks || status.totalChunks} of {status.totalChunks} chunk{status.totalChunks !== 1 ? 's' : ''}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              ✓ Guardians can now submit their keys to decrypt the results
            </p>
          </div>
        </div>
      );
    }

    if (status.status === 'failed') {
      return (
        <div className="text-center py-8">
          <div className="mb-6">
            <FiAlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Tally Creation Failed
          </h3>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">
              {status.errorMessage || 'An error occurred during tally creation'}
            </p>
          </div>
          <button
            onClick={handleCreateTally}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <FiLoader className="h-5 w-5 animate-spin" />
                <span>Retrying...</span>
              </div>
            ) : (
              'Retry'
            )}
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 relative">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Tally Creation</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshStatus}
                disabled={isRefreshing}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                aria-label="Refresh status"
                title="Refresh status"
              >
                <FiRefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">{getStatusDisplay()}</div>
      </div>
    </div>
  );
};

export default TallyCreationModal;
