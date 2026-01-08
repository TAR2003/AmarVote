import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { electionApi } from '../utils/electionApi';

const CombineProgressModal = ({ isOpen, onClose, electionId, onCombineComplete }) => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const completionHandledRef = useRef(false);
  const intervalRef = useRef(null);

  const pollStatus = useCallback(async () => {
    try {
      const data = await electionApi.getCombineStatus(electionId);
      setStatus(data);
      setError(null);

      // If completed, notify parent once and stop polling
      if (data.status === 'completed' && !completionHandledRef.current) {
        completionHandledRef.current = true;
        
        // Stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Notify parent after a short delay to show completion state
        if (onCombineComplete) {
          setTimeout(() => {
            onCombineComplete();
            // Modal will be closed by parent (ElectionPage)
          }, 1500);
        }
      }
      
      // If failed, stop polling
      if (data.status === 'failed') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('Error polling combine status:', err);
      setError(err.message);
    }
  }, [electionId, onCombineComplete]);

  useEffect(() => {
    if (isOpen && electionId) {
      // Reset completion flag when modal opens
      completionHandledRef.current = false;
      
      // Start polling for status
      pollStatus();
      intervalRef.current = setInterval(pollStatus, 2000); // Poll every 2 seconds

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isOpen, electionId, pollStatus]);

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
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Combine Partial Decryptions</h2>
              <p className="text-indigo-100 mt-1">Processing encrypted votes</p>
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
                    {getStatusIcon()} {getStatusDisplay()}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    status.status === 'completed' ? 'bg-green-100 text-green-800' :
                    status.status === 'failed' ? 'bg-red-100 text-red-800' :
                    status.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
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
                      {status.createdBy && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Initiated By:</span>
                          <span className="font-semibold text-gray-800">{status.createdBy}</span>
                        </div>
                      )}
                      {status.startedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Started:</span>
                          <span className="font-semibold text-gray-800">
                            {new Date(status.startedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                      {status.completedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Completed:</span>
                          <span className="font-semibold text-gray-800">
                            {new Date(status.completedAt).toLocaleTimeString()}
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-blue-800 font-medium">
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
                        ? 'bg-blue-100 text-blue-600'
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
                        ? 'bg-blue-100 text-blue-600'
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
                        ? 'bg-green-100 text-green-600'
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
          {status?.status !== 'completed' && (
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
