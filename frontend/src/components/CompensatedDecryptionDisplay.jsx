import React, { useState, useEffect } from 'react';
import { FiDownload, FiChevronDown, FiChevronUp, FiUsers, FiKey, FiRefreshCw, FiDatabase, FiInfo } from 'react-icons/fi';
import { saveAs } from 'file-saver';

const CompensatedDecryptionDisplay = ({ electionId }) => {
  const [compensatedDecryptions, setCompensatedDecryptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    const fetchCompensatedDecryptions = async () => {
      if (!electionId) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/election/${electionId}/compensated-decryptions`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch compensated decryption data');
        }
        
        const data = await response.json();
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

  const toggleExpand = (cdId, field) => {
    const key = `${cdId}-${field}`;
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const downloadField = (cd, fieldName, fieldValue) => {
    if (!fieldValue || fieldValue.trim() === '') {
      alert('No data available for this field');
      return;
    }

    const filename = `compensated_decryption_${cd.compensatingGuardianSequence}_to_${cd.missingGuardianSequence}_${fieldName}_election_${electionId}.json`;
    const dataToSave = {
      electionId,
      compensatingGuardianSequence: cd.compensatingGuardianSequence,
      missingGuardianSequence: cd.missingGuardianSequence,
      compensatingGuardianName: cd.compensatingGuardianName,
      missingGuardianName: cd.missingGuardianName,
      fieldName,
      fieldValue: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    saveAs(blob, filename);
  };

  const downloadAllCompensatedDecryptionData = (cd) => {
    const filename = `compensated_decryption_${cd.compensatingGuardianSequence}_to_${cd.missingGuardianSequence}_complete_election_${electionId}.json`;
    const dataToSave = {
      ...cd,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    saveAs(blob, filename);
  };

  const downloadAllCompensatedDecryptionsData = () => {
    const filename = `all_compensated_decryptions_election_${electionId}.json`;
    const dataToSave = {
      electionId,
      compensatedDecryptions,
      totalCompensatedDecryptions: compensatedDecryptions.length,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    saveAs(blob, filename);
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderField = (cd, fieldName, fieldValue, icon) => {
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

    const cdKey = `${cd.compensatingGuardianSequence}-${cd.missingGuardianSequence}`;
    const isExpanded = expandedItems[`${cdKey}-${fieldName}`];
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
              onClick={() => downloadField(cd, fieldName, fieldValue)}
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              <FiDownload className="h-4 w-4" />
              <span>Download</span>
            </button>
            {isLongText && (
              <button
                onClick={() => toggleExpand(cdKey, fieldName)}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 text-sm"
              >
                {isExpanded ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-700 font-mono bg-white p-3 rounded border max-h-96 overflow-y-auto">
          {isLongText && !isExpanded ? truncateText(fieldValue) : fieldValue}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

  // Group by missing guardian for better organization
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FiRefreshCw className="h-5 w-5 mr-2 text-purple-600" />
            Compensated Decryption Shares
            <span className="ml-3 bg-purple-100 text-purple-800 text-sm font-medium px-2.5 py-1 rounded-full">
              {compensatedDecryptions.length} {compensatedDecryptions.length === 1 ? 'Share' : 'Shares'}
            </span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Recovery shares from guardians compensating for missing guardians
          </p>
        </div>
        <button
          onClick={downloadAllCompensatedDecryptionsData}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all shadow-sm hover:shadow-md"
        >
          <FiDownload className="h-4 w-4" />
          <span>Download All</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <div className="flex items-start">
          <FiInfo className="h-5 w-5 text-purple-600 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-purple-800">
            <strong>About Compensated Decryption:</strong> These shares are created by available guardians to compensate 
            for missing guardians during the decryption process. This ensures the election can proceed even if some 
            guardians are unavailable, as long as the minimum quorum is met.
          </p>
        </div>
      </div>

      {/* Grouped by Missing Guardian - Accordion Style */}
      <div className="space-y-3">
        {Object.entries(groupedByMissing).map(([missingGuardianSeq, shares]) => {
          const isExpanded = expandedGroups[missingGuardianSeq];
          return (
            <div key={missingGuardianSeq} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all">
              {/* Group Header (Clickable) */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer bg-gradient-to-r from-purple-50 to-white hover:from-purple-100 hover:to-purple-50"
                onClick={() => setExpandedGroups(prev => ({ ...prev, [missingGuardianSeq]: !prev[missingGuardianSeq] }))}
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-sm">
                      <FiUsers className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-gray-900">
                      Missing Guardian {missingGuardianSeq}
                    </h4>
                    {shares[0]?.missingGuardianName && (
                      <p className="text-sm text-gray-600">
                        {shares[0].missingGuardianName} • {shares[0].missingGuardianEmail}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    {shares.length} Compensator{shares.length !== 1 ? 's' : ''}
                  </span>
                  {isExpanded ? (
                    <FiChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FiChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Compensating Guardians */}
              {isExpanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
                  {shares.map((cd) => (
                    <div key={cd.compensatedDecryptionId} 
                         className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                              <FiUsers className="h-5 w-5 text-green-600" />
                            </div>
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-900 text-sm">
                              Compensating Guardian {cd.compensatingGuardianSequence}
                            </h5>
                            {cd.compensatingGuardianName && (
                              <p className="text-xs text-gray-600">
                                {cd.compensatingGuardianName} • {cd.compensatingGuardianEmail}
                              </p>
                            )}
                            {cd.chunkCount > 1 && (
                              <p className="text-xs text-blue-600 mt-1">
                                ✓ Applied across {cd.chunkCount} chunk{cd.chunkCount !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => downloadAllCompensatedDecryptionData(cd)}
                          className="flex items-center space-x-1 text-purple-600 hover:text-purple-800 text-sm px-2 py-1 hover:bg-purple-50 rounded transition-colors"
                        >
                          <FiDownload className="h-4 w-4" />
                          <span>Download</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {renderField(cd, 'Compensated Tally Share', cd.compensatedTallyShare, <FiDatabase className="h-4 w-4 text-orange-600" />)}
                        {renderField(cd, 'Compensated Ballot Share', cd.compensatedBallotShare, <FiKey className="h-4 w-4 text-green-600" />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompensatedDecryptionDisplay;