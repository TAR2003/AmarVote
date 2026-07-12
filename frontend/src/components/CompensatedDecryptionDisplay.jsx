import React, { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiUsers, FiRefreshCw, FiInfo, FiLoader } from 'react-icons/fi';
import { downloadJsonArtifact } from '../utils/artifactDownload';
import { electionApi } from '../utils/electionApi';

const CompensatedDecryptionDisplay = ({ electionId }) => {
  const [compensatedDecryptions, setCompensatedDecryptions] = useState([]);
  const [decryptionDetails, setDecryptionDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCompensatedDecryptions = async () => {
      if (!electionId) return;

      try {
        setLoading(true);
        const data = await electionApi.getElectionCompensatedDecryptions(electionId, { summary: true });
        if (data.success) {
          setCompensatedDecryptions(data.compensatedDecryptions || []);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Error fetching compensated decryptions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCompensatedDecryptions();
  }, [electionId]);

  const loadDecryptionDetail = useCallback(async (compensatedDecryptionId) => {
    if (decryptionDetails[compensatedDecryptionId]) {
      return decryptionDetails[compensatedDecryptionId];
    }

    if (loadingDetails[compensatedDecryptionId]) {
      return null;
    }

    setLoadingDetails((prev) => ({ ...prev, [compensatedDecryptionId]: true }));
    try {
      const data = await electionApi.getElectionCompensatedDecryptionDetail(
        electionId,
        compensatedDecryptionId
      );
      if (data.success && data.compensatedDecryption) {
        setDecryptionDetails((prev) => ({
          ...prev,
          [compensatedDecryptionId]: data.compensatedDecryption,
        }));
        return data.compensatedDecryption;
      }
      throw new Error(data.error || 'Failed to load compensated decryption detail');
    } catch (err) {
      console.error('Error fetching compensated decryption detail:', err);
      return null;
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [compensatedDecryptionId]: false }));
    }
  }, [electionId, decryptionDetails, loadingDetails]);

  const downloadAllCompensatedDecryptionData = async (cd) => {
    const detail = decryptionDetails[cd.compensatedDecryptionId]
      || await loadDecryptionDetail(cd.compensatedDecryptionId);
    const payload = detail || cd;
    if (!detail && !cd.compensatedTallyShare && !cd.compensatedBallotShare) {
      alert('Compensated decryption artifact data is not available yet');
      return;
    }

    const filename = `compensated_decryption_${payload.compensatingGuardianSequence}_to_${payload.missingGuardianSequence}_complete_election_${electionId}.json`;
    const dataToSave = {
      ...payload,
      timestamp: new Date().toISOString(),
    };

    try {
      await downloadJsonArtifact(filename, dataToSave);
    } catch {
      alert('Failed to prepare compensated decryption artifact download');
    }
  };

  const downloadAllCompensatedDecryptionsData = async () => {
    const detailed = await Promise.all(
      compensatedDecryptions.map(async (cd) =>
        decryptionDetails[cd.compensatedDecryptionId]
          || await loadDecryptionDetail(cd.compensatedDecryptionId)
          || cd
      )
    );
    const filename = `all_compensated_decryptions_election_${electionId}.json`;
    const dataToSave = {
      electionId,
      compensatedDecryptions: detailed,
      totalCompensatedDecryptions: detailed.length,
      timestamp: new Date().toISOString(),
    };

    try {
      await downloadJsonArtifact(filename, dataToSave);
    } catch {
      alert('Failed to prepare compensated decryption artifacts download');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <span className="ml-2 text-gray-600">Loading compensated decryption data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-600 font-medium">Error loading compensated decryption data</div>
        </div>
        <div className="mt-2 text-red-700 text-sm">{error}</div>
      </div>
    );
  }

  if (compensatedDecryptions.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <FiRefreshCw className="h-5 w-5 text-yellow-600 mr-2" />
          <div className="text-yellow-800 font-medium">No Compensated Decryptions Found</div>
        </div>
        <div className="mt-2 text-yellow-700 text-sm">
          No compensated decryption shares have been generated for this election yet.
          These are created when guardians submit their keys to help compensate for missing guardians.
        </div>
      </div>
    );
  }

  const groupedByMissing = compensatedDecryptions.reduce((groups, cd) => {
    const key = cd.missingGuardianSequence;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(cd);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FiRefreshCw className="h-5 w-5 mr-2 text-brand-dark" />
            Compensated Decryption Shares
            <span className="ml-3 bg-glacier text-ink text-sm font-medium px-2.5 py-1 rounded-full">
              {compensatedDecryptions.length} {compensatedDecryptions.length === 1 ? 'Share' : 'Shares'}
            </span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Download recovery shares from guardians compensating for missing guardians
          </p>
        </div>
        <button
          type="button"
          onClick={downloadAllCompensatedDecryptionsData}
          className="flex items-center space-x-2 bg-ink text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all shadow-sm hover:shadow-md"
        >
          <FiDownload className="h-4 w-4" />
          <span>Download All</span>
        </button>
      </div>

      <div className="bg-glacier border border-purple-200 rounded-lg p-3">
        <div className="flex items-start">
          <FiInfo className="h-5 w-5 text-brand-dark mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-ink">
            Compensated decryption artifacts are download-only. Use the buttons below to save share
            payloads for offline verification.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedByMissing).map(([missingGuardianSeq, shares]) => (
          <div key={missingGuardianSeq} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-white border-b border-gray-200">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-sm">
                  <FiUsers className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-semibold text-gray-900">
                  Missing Guardian {missingGuardianSeq}
                </h4>
                {shares[0]?.missingGuardianName && (
                  <p className="text-sm text-gray-600">
                    {shares[0].missingGuardianName} • {shares[0].missingGuardianEmail}
                  </p>
                )}
              </div>
              <span className="ml-auto px-3 py-1 bg-glacier text-ink rounded-full text-sm font-medium">
                {shares.length} Compensator{shares.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {shares.map((cd) => {
                const isDownloading = loadingDetails[cd.compensatedDecryptionId];
                return (
                  <div
                    key={cd.compensatedDecryptionId}
                    className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="min-w-0">
                      <h5 className="font-semibold text-gray-900 text-sm">
                        Compensating Guardian {cd.compensatingGuardianSequence}
                      </h5>
                      {cd.compensatingGuardianName && (
                        <p className="text-xs text-gray-600 truncate">
                          {cd.compensatingGuardianName} • {cd.compensatingGuardianEmail}
                        </p>
                      )}
                      {cd.chunkCount > 1 && (
                        <p className="text-xs text-brand mt-1">
                          Applied across {cd.chunkCount} chunk{cd.chunkCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadAllCompensatedDecryptionData(cd)}
                      disabled={isDownloading}
                      className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white bg-ink hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {isDownloading ? (
                        <FiLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiDownload className="h-4 w-4" />
                      )}
                      <span>{isDownloading ? 'Preparing...' : 'Download'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompensatedDecryptionDisplay;
