import React, { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiUser, FiShield, FiInfo, FiLoader } from 'react-icons/fi';
import { downloadJsonArtifact } from '../utils/artifactDownload';
import { electionApi } from '../utils/electionApi';

const GuardianDataDisplay = ({ electionId }) => {
  const [guardians, setGuardians] = useState([]);
  const [guardianDetails, setGuardianDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGuardians = async () => {
      if (!electionId) return;

      try {
        setLoading(true);
        const data = await electionApi.getElectionGuardians(electionId, { summary: true });
        if (data.success) {
          setGuardians(data.guardians || []);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Error fetching guardians:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGuardians();
  }, [electionId]);

  const loadGuardianDetail = useCallback(async (guardianId) => {
    if (guardianDetails[guardianId]) {
      return guardianDetails[guardianId];
    }

    if (loadingDetails[guardianId]) {
      return null;
    }

    setLoadingDetails((prev) => ({ ...prev, [guardianId]: true }));
    try {
      const data = await electionApi.getElectionGuardianDetail(electionId, guardianId);
      if (data.success && data.guardian) {
        setGuardianDetails((prev) => ({ ...prev, [guardianId]: data.guardian }));
        return data.guardian;
      }
      throw new Error(data.error || 'Failed to load guardian detail');
    } catch (err) {
      console.error('Error fetching guardian detail:', err);
      return null;
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [guardianId]: false }));
    }
  }, [electionId, guardianDetails, loadingDetails]);

  const downloadAllGuardianData = async (guardian) => {
    const detail = guardianDetails[guardian.id] || await loadGuardianDetail(guardian.id);
    const payload = detail || guardian;
    if (!detail && !guardian.guardianPublicKey) {
      alert('Guardian artifact data is not available yet');
      return;
    }

    const filename = `guardian_${guardian.sequenceOrder}_complete_data_election_${electionId}.json`;
    const dataToSave = {
      ...payload,
      timestamp: new Date().toISOString(),
    };

    try {
      await downloadJsonArtifact(filename, dataToSave);
    } catch {
      alert('Failed to prepare guardian artifact download');
    }
  };

  const downloadAllGuardiansData = async () => {
    const detailedGuardians = await Promise.all(
      guardians.map(async (guardian) => guardianDetails[guardian.id] || await loadGuardianDetail(guardian.id) || guardian)
    );
    const filename = `all_guardians_election_${electionId}.json`;
    const dataToSave = {
      electionId,
      guardians: detailedGuardians,
      totalGuardians: detailedGuardians.length,
      timestamp: new Date().toISOString(),
    };

    try {
      await downloadJsonArtifact(filename, dataToSave);
    } catch {
      alert('Failed to prepare guardian artifacts download');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <span className="ml-2 text-gray-600">Loading guardian data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-600 font-medium">Error loading guardian data</div>
        </div>
        <div className="mt-2 text-red-700 text-sm">{error}</div>
      </div>
    );
  }

  if (guardians.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <FiUser className="h-5 w-5 text-yellow-600 mr-2" />
          <div className="text-yellow-800 font-medium">No Guardian Data Found</div>
        </div>
        <div className="mt-2 text-yellow-700 text-sm">
          No guardian information is available for this election yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FiShield className="h-5 w-5 mr-2 text-brand" />
            Guardian Information
            <span className="ml-3 bg-glacier text-ink text-sm font-medium px-2.5 py-1 rounded-full">
              {guardians.length} {guardians.length === 1 ? 'Guardian' : 'Guardians'}
            </span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Download guardian keys, backup data, and chunk decryption artifacts
          </p>
        </div>
        <button
          type="button"
          onClick={downloadAllGuardiansData}
          className="flex items-center space-x-2 bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-all shadow-sm hover:shadow-md"
        >
          <FiDownload className="h-4 w-4" />
          <span>Download All</span>
        </button>
      </div>

      <div className="bg-glacier border border-brand/20 rounded-lg p-3">
        <div className="flex items-start">
          <FiInfo className="h-5 w-5 text-brand mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-ink">
            Cryptographic artifacts are not shown inline. Download a guardian package to inspect
            public keys, backup data, and partial decryption shares locally.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {guardians.map((guardian) => {
          const isDownloading = loadingDetails[guardian.id];
          return (
            <div
              key={guardian.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
            >
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                    <FiUser className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-gray-900">
                    Guardian {guardian.sequenceOrder}
                  </h4>
                  <p className="text-sm text-gray-600 truncate">
                    {guardian.userEmail}
                    {guardian.chunkDecryptionCount != null
                      ? ` • ${guardian.chunkDecryptionCount} chunk decryption(s)`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  guardian.decryptedOrNot
                    ? 'bg-sage-soft text-emerald-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {guardian.decryptedOrNot ? 'Decrypted' : 'Pending'}
                </div>
                <button
                  type="button"
                  onClick={() => downloadAllGuardianData(guardian)}
                  disabled={isDownloading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand hover:bg-brand-dark disabled:opacity-50 transition-colors"
                >
                  {isDownloading ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FiDownload className="h-4 w-4" />
                  )}
                  <span>{isDownloading ? 'Preparing...' : 'Download'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GuardianDataDisplay;
