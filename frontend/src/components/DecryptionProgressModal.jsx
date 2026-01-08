import React, { useState, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { electionApi } from '../utils/electionApi';

const DecryptionProgressModal = ({ isOpen, onClose, electionId, guardianName }) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
    console.log('Modal is closed, not rendering');
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
                      value={status.progressPercentage || 0}
                      text={`${Math.round(status.progressPercentage || 0)}%`}
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
                          <p className="text-sm text-gray-600">Chunks Processed</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {status.processedChunks || 0} / {status.totalChunks || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Current Chunk</p>
                          <p className="text-2xl font-bold text-indigo-600">
                            #{status.currentChunkNumber || 0}
                          </p>
                        </div>
                      </div>
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
                      <p className="text-sm text-blue-700">
                        Decrypting your portion of the encrypted tally for each chunk.
                        This process validates your guardian credentials and generates
                        partial decryption shares.
                      </p>
                      <div className="mt-3 h-2 bg-blue-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-500"
                          style={{ width: `${status.progressPercentage || 0}%` }}
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
                          <p className="text-sm text-gray-600 mb-1">Currently compensating for:</p>
                          <p className="text-lg font-semibold text-purple-900">
                            🛡️ {status.compensatingForGuardianName}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-purple-700">Guardians processed:</span>
                        <span className="font-semibold text-purple-900">
                          {status.processedCompensatedGuardians || 0} / {status.totalCompensatedGuardians || 0}
                        </span>
                      </div>
                      
                      <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 transition-all duration-500"
                          style={{ width: `${status.compensatedProgressPercentage || 0}%` }}
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
                            <p className="text-green-600 font-semibold">Chunks Processed</p>
                            <p className="text-green-900 text-lg font-bold">{status.totalChunks}</p>
                          </div>
                          <div className="bg-green-50 rounded p-2">
                            <p className="text-green-600 font-semibold">Backup Shares Generated</p>
                            <p className="text-green-900 text-lg font-bold">{status.totalCompensatedGuardians || 0}</p>
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
                      <p className="text-sm font-medium text-gray-900">Processing Chunks</p>
                      <p className="text-xs text-gray-600">
                        {status.processedChunks || 0} of {status.totalChunks || 0} chunks processed
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
