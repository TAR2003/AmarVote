import React, { useState, useEffect } from 'react';
import { Shield, Clock, CheckCircle, AlertCircle, FileText, Hash } from 'lucide-react';
import axios from 'axios';

const BlockchainLogs = ({ electionId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const fetchBlockchainLogs = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      
      let url = `${apiUrl}/api/blockchain/logs/${electionId}`;
      if (filter !== 'ALL') {
        url += `/${filter}`;
      }

      const response = await axios.get(url);
      
      if (response.data.success) {
        setLogs(response.data.data || []);
        setError(null);
      } else {
        setError(response.data.error || 'Failed to fetch blockchain logs');
      }
    } catch (err) {
      console.error('Error fetching blockchain logs:', err);
      setError('Unable to connect to blockchain service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockchainLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electionId, filter]);

  const getLogIcon = (logType) => {
    switch (logType) {
      case 'ELECTION_CREATED':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'ELECTION_STARTED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'BALLOT_RECEIVED':
        return <Hash className="w-5 h-5 text-purple-500" />;
      case 'ENCRYPTED_BALLOT_CREATED':
        return <Shield className="w-5 h-5 text-indigo-500" />;
      case 'BENALOH_CHALLENGE':
        return <Shield className="w-5 h-5 text-orange-500" />;
      case 'BALLOT_CAST':
        return <CheckCircle className="w-5 h-5 text-teal-500" />;
      case 'GUARDIAN_KEY_SUBMITTED':
        return <Hash className="w-5 h-5 text-cyan-500" />;
      case 'BALLOT_AUDITED':
        return <Shield className="w-5 h-5 text-yellow-500" />;
      case 'ELECTION_ENDED':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getLogTitle = (log) => {
    switch (log.logType) {
      case 'ELECTION_CREATED':
        return `Election "${log.electionName}" Created`;
      case 'ELECTION_STARTED':
        return `Election Started by ${log.startedBy}`;
      case 'BALLOT_RECEIVED':
        return `Ballot Received - Tracking Code: ${log.trackingCode}`;
      case 'ENCRYPTED_BALLOT_CREATED':
        return `Encrypted Ballot Created - Tracking Code: ${log.trackingCode}`;
      case 'BENALOH_CHALLENGE':
        return `Benaloh Challenge ${log.challengeSucceeded ? 'Passed' : 'Failed'} - Code: ${log.trackingCode}`;
      case 'BALLOT_CAST':
        return `Ballot Cast Successfully - Tracking Code: ${log.trackingCode}`;
      case 'GUARDIAN_KEY_SUBMITTED':
        return `Guardian Key Submitted - ${log.guardianEmail}`;
      case 'BALLOT_AUDITED':
        return `Ballot Audited - Tracking Code: ${log.trackingCode}`;
      case 'ELECTION_ENDED':
        return `Election Ended - Total Votes: ${log.totalVotes}`;
      default:
        return 'Unknown Event';
    }
  };

  const getLogDetails = (log) => {
    const details = [];
    
    if (log.organizerName) details.push({ label: 'Organizer', value: log.organizerName });
    if (log.startDate) details.push({ label: 'Start Date', value: new Date(log.startDate).toLocaleString() });
    if (log.endDate) details.push({ label: 'End Date', value: new Date(log.endDate).toLocaleString() });
    if (log.ballotHash && log.ballotHash !== 'N/A') details.push({ label: 'Ballot Hash', value: log.ballotHash.substring(0, 16) + '...' });
    if (log.voterEmail && log.voterEmail !== 'anonymous') details.push({ label: 'Voter', value: log.voterEmail });
    if (log.voterId && log.voterId !== 'anonymous') details.push({ label: 'Voter ID', value: log.voterId });
    if (log.guardianEmail) details.push({ label: 'Guardian', value: log.guardianEmail });
    if (log.guardianId) details.push({ label: 'Guardian ID', value: log.guardianId });
    if (log.publicKeyHash) details.push({ label: 'Public Key Hash', value: log.publicKeyHash });
    if (log.challengeSucceeded !== undefined) details.push({ label: 'Challenge Result', value: log.challengeSucceeded ? '✅ Passed' : '❌ Failed' });
    if (log.endedBy) details.push({ label: 'Ended By', value: log.endedBy });
    if (log.totalVotes !== undefined) details.push({ label: 'Total Votes', value: log.totalVotes });
    
    return details;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Blockchain Audit Trail</h2>
        </div>
        <button
          onClick={fetchBlockchainLogs}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {[
          { value: 'ALL', label: 'All Events' },
          { value: 'ELECTION_CREATED', label: 'Election Creation' },
          { value: 'ENCRYPTED_BALLOT_CREATED', label: 'Encrypted Ballot' },
          { value: 'BENALOH_CHALLENGE', label: 'Benaloh Challenge' },
          { value: 'BALLOT_CAST', label: 'Ballot Submission' },
          { value: 'GUARDIAN_KEY_SUBMITTED', label: 'Guardian Keys' }
        ].map((filterOption) => (
          <button
            key={filterOption.value}
            onClick={() => setFilter(filterOption.value)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              filter === filterOption.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {filterOption.label}
          </button>
        ))}
      </div>

      {/* Logs Timeline - Scrollable Container */}
      {logs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No blockchain logs found for this election</p>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto pr-2 space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
          {logs.map((log, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start space-x-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getLogIcon(log.logType)}
                </div>

                {/* Content */}
                <div className="flex-grow">
                  {/* Title */}
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {getLogTitle(log)}
                  </h3>

                  {/* Details */}
                  {getLogDetails(log).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      {getLogDetails(log).map((detail, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-600">{detail.label}:</span>
                          <span className="text-sm text-gray-800">{detail.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Hash className="w-4 h-4" />
                      <span className="font-mono text-xs">TX: {log.txId?.substring(0, 12)}...</span>
                    </div>
                  </div>
                </div>

                {/* Log Type Badge */}
                <div className="flex-shrink-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    log.logType === 'ELECTION_CREATED' ? 'bg-blue-100 text-blue-800' :
                    log.logType === 'ELECTION_STARTED' ? 'bg-green-100 text-green-800' :
                    log.logType === 'BALLOT_RECEIVED' ? 'bg-purple-100 text-purple-800' :
                    log.logType === 'ENCRYPTED_BALLOT_CREATED' ? 'bg-indigo-100 text-indigo-800' :
                    log.logType === 'BENALOH_CHALLENGE' ? 'bg-orange-100 text-orange-800' :
                    log.logType === 'BALLOT_CAST' ? 'bg-teal-100 text-teal-800' :
                    log.logType === 'GUARDIAN_KEY_SUBMITTED' ? 'bg-cyan-100 text-cyan-800' :
                    log.logType === 'BALLOT_AUDITED' ? 'bg-yellow-100 text-yellow-800' :
                    log.logType === 'ELECTION_ENDED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {log.logType.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Blockchain Verified</h4>
            <p className="text-sm text-blue-800">
              All election events are recorded on an immutable Hyperledger Fabric blockchain, 
              ensuring complete transparency and tamper-proof audit trails. Each entry is 
              cryptographically signed and timestamped.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockchainLogs;
