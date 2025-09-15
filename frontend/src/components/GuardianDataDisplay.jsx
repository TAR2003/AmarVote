import React, { useState, useEffect } from 'react';
import { FiDownload, FiChevronDown, FiChevronUp, FiUser, FiKey, FiShield, FiDatabase } from 'react-icons/fi';
import { saveAs } from 'file-saver';

const GuardianDataDisplay = ({ electionId }) => {
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});

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
        <div className="mt-2 text-sm text-gray-700 font-mono bg-white p-3 rounded border">
          {isLongText && !isExpanded ? truncateText(fieldValue) : fieldValue}
        </div>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FiShield className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Guardian Information</h3>
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
            {guardians.length} {guardians.length === 1 ? 'Guardian' : 'Guardians'}
          </span>
        </div>
        <button
          onClick={downloadAllGuardiansData}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiDownload className="h-4 w-4" />
          <span>Download All</span>
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-blue-800">
          <strong>Note:</strong> Sensitive credential fields are excluded from this display for security purposes. 
          All other guardian information including public keys, decryption status, and backup data is shown below.
        </div>
      </div>

      <div className="space-y-8">
        {guardians.map((guardian) => (
          <div key={guardian.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <FiUser className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    Guardian {guardian.sequenceOrder}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {guardian.userName} ({guardian.userEmail})
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  guardian.decryptedOrNot 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {guardian.decryptedOrNot ? 'Decryption Submitted' : 'Pending Decryption'}
                </div>
                <button
                  onClick={() => downloadAllGuardianData(guardian)}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <FiDownload className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {renderField(guardian, 'Guardian Public Key', guardian.guardianPublicKey, <FiKey className="h-4 w-4 text-blue-600" />)}
              {renderField(guardian, 'Guardian Decryption Key', guardian.guardianDecryptionKey, <FiKey className="h-4 w-4 text-green-600" />)}
              {renderField(guardian, 'Partial Decrypted Tally', guardian.partialDecryptedTally, <FiDatabase className="h-4 w-4 text-purple-600" />)}
              {renderField(guardian, 'Tally Share', guardian.tallyShare, <FiDatabase className="h-4 w-4 text-orange-600" />)}
              {renderField(guardian, 'Key Backup', guardian.keyBackup, <FiShield className="h-4 w-4 text-gray-600" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GuardianDataDisplay;