import React, { useState, useEffect } from 'react';
import { FiDownload, FiChevronDown, FiChevronUp, FiUser, FiKey, FiShield, FiDatabase, FiInfo } from 'react-icons/fi';
import { saveAs } from 'file-saver';

const GuardianDataDisplay = ({ electionId }) => {
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedGuardians, setExpandedGuardians] = useState({});

  useEffect(() => {
    const fetchGuardians = async () => {
      if (!electionId) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/election/${electionId}/guardians`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch guardian data');
        }
        
        const data = await response.json();
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

  const toggleExpand = (guardianId, field) => {
    const key = `${guardianId}-${field}`;
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const downloadField = (guardian, fieldName, fieldValue) => {
    if (!fieldValue || fieldValue.trim() === '') {
      alert('No data available for this field');
      return;
    }

    const filename = `guardian_${guardian.sequenceOrder}_${fieldName}_election_${electionId}.json`;
    const dataToSave = {
      electionId,
      guardianId: guardian.id,
      guardianSequence: guardian.sequenceOrder,
      guardianEmail: guardian.userEmail,
      fieldName,
      fieldValue: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    saveAs(blob, filename);
  };

  const downloadAllGuardianData = (guardian) => {
    const filename = `guardian_${guardian.sequenceOrder}_complete_data_election_${electionId}.json`;
    const dataToSave = {
      ...guardian,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    saveAs(blob, filename);
  };

  const downloadAllGuardiansData = () => {
    const filename = `all_guardians_election_${electionId}.json`;
    const dataToSave = {
      electionId,
      guardians,
      totalGuardians: guardians.length,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    saveAs(blob, filename);
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderField = (guardian, fieldName, fieldValue, icon) => {
    if (!fieldValue || fieldValue.trim() === '') {
      return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {icon}
              <span className="font-medium text-gray-900">{fieldName}</span>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 italic">No data available</div>
        </div>
      );
    }

    const isExpanded = expandedItems[`${guardian.id}-${fieldName}`];
    const isLongText = fieldValue.length > 100;

    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <span className="font-medium text-gray-900">{fieldName}</span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => downloadField(guardian, fieldName, fieldValue)}
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              <FiDownload className="h-4 w-4" />
              <span>Download</span>
            </button>
            {isLongText && (
              <button
                onClick={() => toggleExpand(guardian.id, fieldName)}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 text-sm"
              >
                {isExpanded ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-700 font-mono bg-white p-3 rounded border max-h-48 overflow-y-auto">
          {isLongText && !isExpanded ? truncateText(fieldValue) : fieldValue}
        </div>
      </div>
    );
  };

  const renderChunkDecryptions = (guardian) => {
    if (!guardian.chunkDecryptions || guardian.chunkDecryptions.length === 0) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            No chunk decryption data available yet. Guardian needs to submit partial decryption keys.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            <strong>Submitted:</strong> {guardian.chunkDecryptions.length} chunk decryption(s). 
            Each contains partial decrypted tally, guardian decryption key, and tally share.
          </p>
        </div>
        {guardian.chunkDecryptions.map((chunk, index) => (
          <div key={chunk.electionCenterId} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h6 className="font-medium text-purple-900 text-sm">
                Chunk {index + 1} (ID: {chunk.electionCenterId})
              </h6>
              {chunk.datePerformed && (
                <span className="text-xs text-gray-500">
                  {new Date(chunk.datePerformed).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {renderField(
                { id: `${guardian.id}-chunk-${chunk.electionCenterId}` }, 
                'Partial Decrypted Tally', 
                chunk.partialDecryptedTally, 
                <FiDatabase className="h-4 w-4 text-purple-600" />
              )}
              {renderField(
                { id: `${guardian.id}-chunk-${chunk.electionCenterId}` }, 
                'Guardian Decryption Key', 
                chunk.guardianDecryptionKey, 
                <FiKey className="h-4 w-4 text-green-600" />
              )}
              {renderField(
                { id: `${guardian.id}-chunk-${chunk.electionCenterId}` }, 
                'Tally Share', 
                chunk.tallyShare, 
                <FiDatabase className="h-4 w-4 text-orange-600" />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FiShield className="h-5 w-5 mr-2 text-blue-600" />
            Guardian Information
            <span className="ml-3 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-1 rounded-full">
              {guardians.length} {guardians.length === 1 ? 'Guardian' : 'Guardians'}
            </span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            View cryptographic keys and decryption data for each guardian
          </p>
        </div>
        <button
          onClick={downloadAllGuardiansData}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
        >
          <FiDownload className="h-4 w-4" />
          <span>Download All</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start">
          <FiInfo className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            <strong>Security Notice:</strong> Sensitive credential fields are excluded from this display. 
            All other guardian information including public keys, decryption status, and backup data is shown below.
          </p>
        </div>
      </div>

      {/* Guardian Accordion List */}
      <div className="space-y-3">
        {guardians.map((guardian) => {
          const isExpanded = expandedGuardians[guardian.id];
          return (
            <div key={guardian.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all">
              {/* Guardian Header (Clickable) */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50"
                onClick={() => setExpandedGuardians(prev => ({ ...prev, [guardian.id]: !prev[guardian.id] }))}
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                      <FiUser className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-gray-900">
                      Guardian {guardian.sequenceOrder}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {guardian.userName} • {guardian.userEmail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    guardian.decryptedOrNot 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {guardian.decryptedOrNot ? '✓ Decrypted' : '⏳ Pending'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAllGuardianData(guardian);
                    }}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                  >
                    <FiDownload className="h-4 w-4" />
                    <span>Download</span>
                  </button>
                  {isExpanded ? (
                    <FiChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FiChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Guardian Details */}
              {isExpanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="space-y-4">
                    {/* Guardian Keys Section */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <FiKey className="h-4 w-4 mr-2 text-blue-600" />
                        Cryptographic Keys
                      </h5>
                      <div className="grid grid-cols-1 gap-3">
                        {renderField(guardian, 'Guardian Public Key', guardian.guardianPublicKey, <FiKey className="h-4 w-4 text-blue-600" />)}
                        {renderField(guardian, 'Key Backup', guardian.keyBackup, <FiShield className="h-4 w-4 text-gray-600" />)}
                      </div>
                    </div>

                    {/* Chunk Decryptions Section */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <FiDatabase className="h-4 w-4 mr-2 text-purple-600" />
                        Chunk Decryption Data
                      </h5>
                      {renderChunkDecryptions(guardian)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GuardianDataDisplay;