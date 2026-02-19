import React, { useState, useEffect, useRef } from 'react';
import { FiLoader, FiCheckCircle, FiAlertCircle, FiX, FiRefreshCw } from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const TallyCreationModal = ({ isOpen, onClose, electionId, electionApi }) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

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

  // Poll for status updates
  const pollStatus = async () => {
    try {
      const statusData = await electionApi.getTallyStatus(electionId);
      setStatus(statusData);

      // Stop polling if completed or failed
      if (statusData.status === 'completed' || statusData.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('Error polling tally status:', err);
    }
  };

  // Start polling when modal opens or status is in_progress
  useEffect(() => {
    if (isOpen && electionId) {
      pollStatus();

      // Start polling every 2 seconds
      pollIntervalRef.current = setInterval(pollStatus, 2000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [isOpen, electionId]);

  const handleCreateTally = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await electionApi.initiateTallyCreation(electionId);
      
      if (response.success) {
        // Start polling for status
        pollStatus();
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
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

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
            Processed {status.totalChunks} chunk{status.totalChunks !== 1 ? 's' : ''}
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
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">{getStatusDisplay()}</div>
      </div>
    </div>
  );
};

export default TallyCreationModal;
