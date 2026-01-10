import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { electionApi } from '../utils/electionApi';
import { timezoneUtils } from '../utils/timezoneUtils';
import toast from 'react-hot-toast';
import { load } from '@fingerprintjs/botd';
import {
  FiCalendar,
  FiClock,
  FiUsers,
  FiInfo,
  FiShield,
  FiCheckCircle,
  FiUser,
  FiAlertCircle,
  FiTrendingUp,
  FiX,
  FiLoader,
  FiCopy,
  FiSave,
  FiEye,
  FiDownload,
  FiBarChart,
  FiPieChart,
  FiKey,
  FiRefreshCw,
  FiFileText,
  FiDatabase,
  FiLock,
  FiUnlock,
  FiLayers,
  FiHash,
  FiCheck,
  FiLink,
  FiChevronDown,
  FiChevronUp,
  FiSearch
} from 'react-icons/fi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ErrorBoundary from '../components/ErrorBoundary';
import GuardianDataDisplay from '../components/GuardianDataDisplay';
import CompensatedDecryptionDisplay from '../components/CompensatedDecryptionDisplay';
import AnimatedResults from '../components/AnimatedResults';
import TallyCreationModal from '../components/TallyCreationModal';
import DecryptionProgressModal from '../components/DecryptionProgressModal';
import CombineProgressModal from '../components/CombineProgressModal';

const subMenus = [
  { name: 'Election Info', key: 'info', path: '', icon: FiInfo },
  { name: 'Voting Booth', key: 'voting', path: 'voting-booth', icon: FiCheckCircle },
  { name: 'Guardian Keys', key: 'guardian', path: 'guardian-keys', icon: FiShield },
  { name: 'Results', key: 'results', path: 'results', icon: FiTrendingUp },
  { name: 'Ballots in Tally', key: 'ballots', path: 'ballots-in-tally', icon: FiDatabase },
  { name: 'Verify Your Vote', key: 'verify', path: 'verify-vote', icon: FiHash },
  { name: 'Verification', key: 'verification', path: 'verification', icon: FiEye },
];

// Timer Component
const ElectionTimer = ({ startTime, endTime }) => {
  const [timeInfo, setTimeInfo] = useState({
    timeLeft: '',
    progress: 0,
    phase: 'calculating'
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startTime);
      const end = new Date(endTime);
      const totalDuration = end - start;

      if (now < start) {
        // Election hasn't started
        const timeUntilStart = start - now;
        const days = Math.floor(timeUntilStart / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilStart % (1000 * 60)) / 1000);

        setTimeInfo({
          timeLeft: `${days}d ${hours}h ${minutes}m ${seconds}s until start`,
          progress: 0,
          phase: 'upcoming'
        });
      } else if (now > end) {
        // Election has ended
        setTimeInfo({
          timeLeft: 'Election has ended',
          progress: 100,
          phase: 'ended'
        });
      } else {
        // Election is active
        const elapsed = now - start;
        const remaining = end - now;
        const progressPercent = (elapsed / totalDuration) * 100;

        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        setTimeInfo({
          timeLeft: `${days}d ${hours}h ${minutes}m ${seconds}s remaining`,
          progress: progressPercent,
          phase: 'active'
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, endTime]);

  const getProgressColor = () => {
    switch (timeInfo.phase) {
      case 'upcoming': return '#f59e0b';
      case 'active': return '#10b981';
      case 'ended': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <FiClock className="h-5 w-5 mr-2" />
        Election Timeline
      </h3>
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16">
          <CircularProgressbar
            value={timeInfo.progress}
            text={`${Math.round(timeInfo.progress)}%`}
            styles={buildStyles({
              textColor: getProgressColor(),
              pathColor: getProgressColor(),
              trailColor: '#e5e7eb',
            })}
          />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900">{timeInfo.timeLeft}</p>
          <p className="text-sm text-gray-600 capitalize">Status: {timeInfo.phase}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="h-2 rounded-full transition-all duration-1000"
              style={{
                width: `${timeInfo.progress}%`,
                backgroundColor: getProgressColor()
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Data Display Component for large strings
const DataDisplay = ({ title, data, type = 'json' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    saveAs(blob, `${title.toLowerCase().replace(/\s+/g, '_')}.json`);
  };

  const truncatedData = typeof data === 'string'
    ? data.substring(0, 200) + (data.length > 200 ? '...' : '')
    : JSON.stringify(data, null, 2).substring(0, 200) + '...';

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900">{title}</h4>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            onClick={handleCopy}
            className="text-green-600 hover:text-green-800 text-sm flex items-center"
          >
            <FiCopy className="h-3 w-3 mr-1" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="text-purple-600 hover:text-purple-800 text-sm flex items-center"
          >
            <FiDownload className="h-3 w-3 mr-1" />
            Download
          </button>
        </div>
      </div>
      <div className="bg-gray-50 rounded border">
        <SyntaxHighlighter
          language={type}
          style={atomDark}
          customStyle={{
            margin: 0,
            maxHeight: isExpanded ? 'none' : '150px',
            overflow: isExpanded ? 'visible' : 'hidden'
          }}
        >
          {isExpanded
            ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2))
            : truncatedData
          }
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

// Constants for chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Modern Verification Tab Content Component
const VerificationTabContent = ({ canUserViewVerification, id, electionData, animatedResults }) => {
  const [verificationSubTab, setVerificationSubTab] = useState('overview');
  
  if (!canUserViewVerification()) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <FiEye className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Verification Not Available</h3>
          <p className="text-gray-600 mb-4">
            Election verification will be available after the results have been displayed.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 inline-block">
            <p className="text-sm text-blue-800">
              <strong>Why?</strong> Verification artifacts are only generated after the election results have been computed and displayed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const verificationTabs = [
    { id: 'overview', name: 'Overview', icon: FiEye },
    { id: 'guardians', name: 'Guardians', icon: FiShield },
    { id: 'chunks', name: 'Chunks & Tallies', icon: FiLayers },
    { id: 'compensated', name: 'Compensated Decryptions', icon: FiRefreshCw },
    { id: 'blockchain', name: 'Blockchain', icon: FiLink },
  ];

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with Stats */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 flex items-center">
              <FiEye className="h-7 w-7 mr-3 text-blue-600" />
              Election Verification
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Cryptographic verification data and audit trail
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Guardians</p>
                <p className="text-2xl font-bold text-blue-600">{electionData.numberOfGuardians || electionData.guardians?.length || 0}</p>
              </div>
              <FiShield className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Chunks</p>
                <p className="text-2xl font-bold text-green-600">
                  {animatedResults?.results?.chunks?.length || 0}
                </p>
              </div>
              <FiLayers className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Artifacts</p>
                <p className="text-2xl font-bold text-purple-600">
                  {[
                    electionData.jointPublicKey,
                    electionData.baseHash,
                    electionData.manifestHash
                  ].filter(Boolean).length}
                </p>
              </div>
              <FiKey className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Blockchain</p>
                <p className="text-2xl font-bold text-indigo-600">✓</p>
              </div>
              <FiLink className="h-8 w-8 text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="px-6 py-2">
          <div className="border border-gray-300 rounded-lg bg-white overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
            <nav className="flex space-x-1 px-2 min-w-max" aria-label="Verification sections">
              {verificationTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setVerificationSubTab(tab.id)}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${verificationSubTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
            </nav>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {verificationSubTab === 'overview' && (
          <OverviewTabContent electionData={electionData} id={id} animatedResults={animatedResults} />
        )}

        {/* Guardians Tab */}
        {verificationSubTab === 'guardians' && (
          <GuardianDataDisplay electionId={id} />
        )}

        {/* Chunks Tab */}
        {verificationSubTab === 'chunks' && (
          <ChunksTabContent animatedResults={animatedResults} />
        )}

        {/* Compensated Decryptions Tab */}
        {verificationSubTab === 'compensated' && (
          <CompensatedDecryptionDisplay electionId={id} />
        )}

        {/* Blockchain Tab */}
        {verificationSubTab === 'blockchain' && (
          <BlockchainVerificationSection electionId={id} />
        )}
      </div>
    </div>
  );
};

// Overview Tab Content
const OverviewTabContent = ({ electionData, id, animatedResults }) => {
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <FiInfo className="h-5 w-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Cryptographic Verification</h4>
            <p className="text-sm text-blue-800">
              This section displays cryptographic artifacts and proofs that can be used to verify the integrity of the election.
              All data shown below can be independently verified using ElectionGuard verification tools.
            </p>
          </div>
        </div>
      </div>

      {/* Core Cryptographic Artifacts */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h4 className="font-semibold text-gray-900 flex items-center">
            <FiKey className="h-5 w-5 mr-2 text-blue-600" />
            Core Cryptographic Artifacts
          </h4>
        </div>
        <div className="p-4 space-y-4">
          <DataDisplay
            title="Joint Public Key"
            data={electionData.jointPublicKey || "Not available"}
            type="text"
          />

          <DataDisplay
            title="Commitment Hash"
            data={electionData.baseHash || "Not available"}
            type="text"
          />

          <DataDisplay
            title="Election Manifest"
            data={electionData.manifestHash || "Not available"}
          />

          {electionData.sampleEncryptedBallots && (
            <DataDisplay
              title="Sample Encrypted Ballots"
              data={electionData.sampleEncryptedBallots}
            />
          )}

          {electionData.cryptographicProofs && (
            <DataDisplay
              title="Cryptographic Proofs"
              data={electionData.cryptographicProofs}
            />
          )}
        </div>
      </div>

      {/* Verification Instructions */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-5">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
          <FiInfo className="h-5 w-5 mr-2 text-gray-600" />
          Verification Instructions
        </h4>
        <div className="space-y-3">
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
              <span className="text-blue-600 text-xs font-bold">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Joint Public Key</p>
              <p className="text-sm text-gray-600">Used to encrypt all ballots in this election</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
              <span className="text-blue-600 text-xs font-bold">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Commitment Hash</p>
              <p className="text-sm text-gray-600">Cryptographic commitment to the election parameters</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
              <span className="text-blue-600 text-xs font-bold">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Guardian Keys</p>
              <p className="text-sm text-gray-600">Public keys and polynomials used in the threshold cryptography</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
              <span className="text-blue-600 text-xs font-bold">4</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Encrypted Tally</p>
              <p className="text-sm text-gray-600">The encrypted sum of all valid ballots</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
              <span className="text-blue-600 text-xs font-bold">5</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Proofs</p>
              <p className="text-sm text-gray-600">Zero-knowledge proofs that the tallying was performed correctly</p>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <FiAlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              <strong>Independent Verification:</strong> You can use these artifacts with ElectionGuard verification tools to independently verify that your vote was counted correctly and that the election results are mathematically sound.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Chunks Tab Content
const ChunksTabContent = ({ animatedResults }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedChunks, setExpandedChunks] = useState({});

  if (!animatedResults || !animatedResults.results || !animatedResults.results.chunks) {
    return (
      <div className="text-center py-12">
        <FiLayers className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Chunk Data Available</h3>
        <p className="text-gray-600">
          Chunk tallies and decryptions will appear here once available.
        </p>
      </div>
    );
  }

  const chunks = animatedResults.results.chunks;
  const filteredChunks = chunks.filter(chunk => 
    chunk.electionCenterId?.toString().includes(searchTerm) ||
    chunk.chunkIndex?.toString().includes(searchTerm)
  );

  const toggleChunk = (chunkId) => {
    setExpandedChunks(prev => ({
      ...prev,
      [chunkId]: !prev[chunkId]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-900 text-lg">Per-Chunk Tallies and Decryptions</h4>
          <p className="text-sm text-gray-600 mt-1">
            View detailed tally results and encrypted data for each chunk
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search chunks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          <span className="text-sm text-gray-600">
            {filteredChunks.length} of {chunks.length} chunks
          </span>
        </div>
      </div>

      {/* Chunks List */}
      <div className="space-y-3">
        {filteredChunks.map((chunk, index) => {
          const isExpanded = expandedChunks[chunk.electionCenterId];
          return (
            <div key={chunk.electionCenterId} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              {/* Chunk Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50"
                onClick={() => toggleChunk(chunk.electionCenterId)}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <FiLayers className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900">
                      Chunk {chunk.chunkIndex}
                    </h5>
                    <p className="text-sm text-gray-600">
                      Election Center ID: {chunk.electionCenterId} • {chunk.ballotCount} ballots
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    Processed
                  </span>
                  {isExpanded ? (
                    <FiChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FiChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  {/* Tally Results */}
                  <div className="mb-4">
                    <h6 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <FiBarChart className="h-4 w-4 mr-2 text-blue-600" />
                      Tally Results for this Chunk
                    </h6>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Object.entries(chunk.candidateVotes || {}).map(([candidate, votes]) => (
                        <div key={candidate} className="bg-white rounded-lg px-4 py-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-xs text-gray-500 mb-1">Candidate</p>
                          <p className="font-semibold text-gray-900 truncate">{candidate}</p>
                          <p className="text-2xl font-bold text-blue-600 mt-1">{votes}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Encrypted Tally */}
                  <div className="mb-4">
                    <DataDisplay
                      title="Encrypted Tally"
                      data={chunk.encryptedTally || "Not available"}
                      type="text"
                    />
                  </div>

                  {/* Information Note */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <FiInfo className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">
                        <strong>Threshold Cryptography:</strong> Each guardian submitted a partial decryption for this chunk. 
                        The partial decryptions were combined using threshold cryptography to compute the tally shown above.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredChunks.length === 0 && (
        <div className="text-center py-8">
          <FiSearch className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No chunks match your search</p>
        </div>
      )}
    </div>
  );
};

// Ballots in Tally Section Component
// Blockchain Verification Section Component
const BlockchainVerificationSection = ({ electionId }) => {
  const [blockchainLogs, setBlockchainLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [logsLoaded, setLogsLoaded] = useState(false);

  const fetchBlockchainLogs = async () => {
    if (!electionId) {
      setLogsError('Election ID is required to fetch blockchain logs');
      return;
    }

    setLoadingLogs(true);
    setLogsError(null);

    try {
      // console.log('🔗 Fetching blockchain logs for election:', electionId);

      // const response = await fetch(`/api/blockchain/logs/${electionId}`, {
      //   method: 'GET',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      // });
      // console.log('🔗--- Blockchain logs response:', response);
      const data = await electionApi.getBlockchainLogs(electionId);

      if (data.success) {
        const logs = data.result?.logs || [];
        setBlockchainLogs(logs);
        setLogsLoaded(true);
        toast.success(`✅ Retrieved ${logs.length} blockchain logs successfully!`);
      } else {
        setLogsError(data.message || 'Failed to fetch blockchain logs');
        toast.error(`❌ Failed to fetch blockchain logs: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Blockchain logs fetch error:', error);
      setLogsError(error.message || 'Network error while fetching blockchain logs');
      toast.error('Network error while fetching blockchain logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full p-2 mr-3">
            <FiShield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Blockchain Verification</h4>
            <p className="text-sm text-gray-600 mt-1">
              View election activities recorded on the blockchain for transparency and immutability
            </p>
          </div>
        </div>

        <button
          onClick={fetchBlockchainLogs}
          disabled={loadingLogs}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${loadingLogs
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transform hover:scale-[1.02]'
            }`}
        >
          {loadingLogs ? (
            <>
              <FiLoader className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <FiRefreshCw className="h-4 w-4" />
              <span>{logsLoaded ? 'Refresh Logs' : 'Load Blockchain Logs'}</span>
            </>
          )}
        </button>
      </div>

      {logsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <FiAlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <h5 className="font-medium text-red-900">Error Loading Blockchain Logs</h5>
              <p className="text-sm text-red-700 mt-1">{logsError}</p>
            </div>
          </div>
        </div>
      )}

      {logsLoaded && blockchainLogs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h5 className="font-medium text-gray-900 flex items-center">
              <FiFileText className="h-4 w-4 mr-2" />
              Blockchain Activity Logs ({blockchainLogs.length} entries)
            </h5>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <div className="divide-y divide-gray-200">
              {blockchainLogs.map((log, index) => (
                <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="bg-green-100 rounded-full p-1">
                          <FiCheckCircle className="h-3 w-3 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          Blockchain Event #{index + 1}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{log.message}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <FiClock className="h-3 w-3 mr-1" />
                          {log.formatted_time ? (
                            // If formatted_time is provided, convert it from GMT to local time
                            (() => {
                              try {
                                // Parse the GMT time string and convert to local time
                                const gmtDate = new Date(log.formatted_time.replace(' UTC', ' GMT'));
                                return new Intl.DateTimeFormat('default', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  timeZoneName: 'short'
                                }).format(gmtDate);
                              } catch (e) {
                                // Fallback to original formatted_time if parsing fails
                                return log.formatted_time;
                              }
                            })()
                          ) : (
                            // If no formatted_time, use timestamp and convert to local time
                            new Intl.DateTimeFormat('default', {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              timeZoneName: 'short'
                            }).format(new Date(log.timestamp * 1000))
                          )}
                        </span>
                        <span className="flex items-center">
                          <FiHash className="h-3 w-3 mr-1" />
                          Unix: {log.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {logsLoaded && blockchainLogs.length === 0 && (
        <div className="text-center py-8">
          <FiFileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h5 className="font-medium text-gray-900 mb-2">No Blockchain Logs Found</h5>
          <p className="text-gray-600 text-sm">
            No blockchain activity has been recorded for this election yet.
          </p>
        </div>
      )}

      {!logsLoaded && !loadingLogs && (
        <div className="text-center py-8">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full p-3 w-fit mx-auto mb-3">
            <FiShield className="h-8 w-8 text-white" />
          </div>
          <h5 className="font-medium text-gray-900 mb-2">Blockchain Transparency</h5>
          <p className="text-gray-600 text-sm mb-4">
            Click "Load Blockchain Logs" to view all election activities recorded on the blockchain.
            This provides an immutable audit trail of all election operations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-2 w-fit mx-auto mb-2">
                <FiLock className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xs text-gray-600 font-medium">Immutable Records</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-2 w-fit mx-auto mb-2">
                <FiEye className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-xs text-gray-600 font-medium">Full Transparency</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-2 w-fit mx-auto mb-2">
                <FiCheckCircle className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xs text-gray-600 font-medium">Verifiable Audit Trail</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BallotsInTallySection = ({ resultsData, id }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredBallots, setFilteredBallots] = useState([]);
  const [sortBy, setSortBy] = useState('ballot_id'); // ballot_id, status, verification
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [blockchainVerifying, setBlockchainVerifying] = useState({}); // Track verification state per ballot
  const [blockchainResults, setBlockchainResults] = useState({}); // Store verification results

  // Function to verify ballot on blockchain
  const verifyBallotOnBlockchain = async (trackingCode) => {
    const electionId = id;
    if (!electionId || !trackingCode) {
      toast.error('Missing election ID or tracking code for blockchain verification');
      return;
    }

    setBlockchainVerifying(prev => ({ ...prev, [trackingCode]: true }));

    try {
      const data = await electionApi.verifyBallotOnBlockchainAPI(electionId, trackingCode);

      if (data.success) {
        setBlockchainResults(prev => ({
          ...prev,
          [trackingCode]: {
            ...data,
            verificationTimestamp: new Date().toISOString(),
          },
        }));
        toast.success(`✅ Ballot ${trackingCode} verified on blockchain successfully!`);
      } else {
        setBlockchainResults(prev => ({
          ...prev,
          [trackingCode]: {
            success: false,
            error: data.message || 'Verification failed',
            verificationTimestamp: new Date().toISOString(),
          },
        }));
        toast.error(`❌ Blockchain verification failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Blockchain verification error:', error);
      setBlockchainResults(prev => ({
        ...prev,
        [trackingCode]: {
          success: false,
          error: error.message || 'Network error during verification',
          verificationTimestamp: new Date().toISOString(),
        },
      }));
      toast.error('Network error during blockchain verification');
    } finally {
      setBlockchainVerifying(prev => ({ ...prev, [trackingCode]: false }));
    }
  };

  // Extract and deduplicate ballots from results data using useMemo
  const ballots = useMemo(() => {
    try {
      // More robust check for the nested structure
      if (!resultsData || !resultsData.verification || !Array.isArray(resultsData.verification.ballots)) {
        // We don't set an error here because it might just be loading
        // The UI should handle the empty array case gracefully
        if (resultsData && resultsData.verification && resultsData.verification.ballots) {
          // Only log an error if the structure exists but `ballots` is not an array
          setHasError(true);
          setErrorMessage('Ballot data is not in the expected array format.');
        }
        return [];
      }

      const extractedBallots = resultsData.verification.ballots;

      // Remove duplicates based on ballot_id (tracking code) and ensure items are valid
      const uniqueBallots = extractedBallots.filter((ballot, index, self) =>
        ballot && typeof ballot === 'object' && ballot.ballot_id && // ensure ballot is a valid object
        index === self.findIndex(b => b && b.ballot_id === ballot.ballot_id)
      );

      if (uniqueBallots.length < extractedBallots.length) {
        console.log('🔍 Ballot deduplication removed',
          extractedBallots.length - uniqueBallots.length,
          'duplicate or invalid ballots. Original:', extractedBallots.length,
          'Unique:', uniqueBallots.length);
      }

      // Clear error if data is now valid
      setHasError(false);
      setErrorMessage('');

      return uniqueBallots;
    } catch (error) {
      console.error('Error processing ballot data:', error);
      setHasError(true);
      setErrorMessage('Error processing ballot data: ' + error.message);
      return [];
    }
  }, [resultsData]);

  useEffect(() => {
    let filtered = [...ballots]; // Use already deduplicated ballots

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(ballot =>
        ballot.ballot_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ballot.initial_hash && ballot.initial_hash.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ballot.decrypted_hash && ballot.decrypted_hash.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy] || '';
      let bValue = b[sortBy] || '';

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredBallots(filtered);
  }, [searchTerm, ballots, sortBy, sortOrder]);

  const downloadBallotInfo = async (ballot) => {
    try {
      // Fetch cipher text from backend using the new API
      const ballotDetailsResponse = await electionApi.getBallotDetails(id, ballot.ballot_id);

      let ballotData;
      if (ballotDetailsResponse && ballotDetailsResponse.success && ballotDetailsResponse.ballot) {
        // Include cipher text from backend
        ballotData = {
          tracking_code: ballot.ballot_id,
          hash_code: ballot.initial_hash,
          decrypted_hash: ballot.decrypted_hash,
          cipher_text: ballotDetailsResponse.ballot.cipher_text, // Added cipher text
          status: ballot.status,
          verification: ballot.verification,
          timestamp: new Date().toISOString(),
          election_id: resultsData?.election?.scope_id || 'unknown',
          ballot_selections: ballot.selections || []
        };
      } else {
        // Fallback to original data without cipher text
        ballotData = {
          tracking_code: ballot.ballot_id,
          hash_code: ballot.initial_hash,
          decrypted_hash: ballot.decrypted_hash,
          cipher_text: "Not available", // Indicate cipher text is not available
          status: ballot.status,
          verification: ballot.verification,
          timestamp: new Date().toISOString(),
          election_id: resultsData?.election?.scope_id || 'unknown',
          ballot_selections: ballot.selections || []
        };
        console.warn('Could not fetch cipher text for ballot:', ballot.ballot_id);
      }

      const blob = new Blob([JSON.stringify(ballotData, null, 2)], { type: 'application/json' });
      saveAs(blob, `ballot_${ballot.ballot_id}_verification.json`);
    } catch (error) {
      console.error('Error downloading ballot info:', error);
      // Fallback to original data without cipher text in case of error
      const ballotData = {
        tracking_code: ballot.ballot_id,
        hash_code: ballot.initial_hash,
        decrypted_hash: ballot.decrypted_hash,
        cipher_text: "Error fetching cipher text",
        status: ballot.status,
        verification: ballot.verification,
        timestamp: new Date().toISOString(),
        election_id: resultsData?.election?.scope_id || 'unknown',
        ballot_selections: ballot.selections || []
      };

      const blob = new Blob([JSON.stringify(ballotData, null, 2)], { type: 'application/json' });
      saveAs(blob, `ballot_${ballot.ballot_id}_verification.json`);
    }
  };

  const downloadAllBallotsCSV = () => {
    const csvHeaders = ['Chunk #', 'Tracking Code', 'Hash Code', 'Decrypted Hash', 'Status', 'Verification'];
    const csvRows = ballots.map(ballot => [
      ballot.chunkIndex || 'N/A',
      ballot.ballot_id,
      ballot.initial_hash || 'N/A',
      ballot.decrypted_hash || 'N/A',
      ballot.status,
      ballot.verification
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    saveAs(blob, `all_ballots_verification_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const getVerificationStatus = (ballot) => {
    const status = ballot.verification;
    switch (status) {
      case 'success':
        return { text: 'Verified', color: 'green', icon: FiCheck, bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-200' };
      case 'failed':
        return { text: 'Failed', color: 'red', icon: FiX, bgColor: 'bg-red-100', textColor: 'text-red-800', borderColor: 'border-red-200' };
      case 'no_initial_hash':
        return { text: 'No Hash', color: 'yellow', icon: FiAlertCircle, bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' };
      default:
        return { text: 'Unknown', color: 'gray', icon: FiInfo, bgColor: 'bg-gray-100', textColor: 'text-gray-800', borderColor: 'border-gray-200' };
    }
  };

  const getStatusCounts = () => {
    const counts = { success: 0, failed: 0, no_initial_hash: 0, cast: 0, spoiled: 0 };
    ballots.forEach(ballot => {
      counts[ballot.verification] = (counts[ballot.verification] || 0) + 1;
      counts[ballot.status] = (counts[ballot.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center">
          <FiDatabase className="h-5 w-5 mr-2" />
          Ballots in Tally ({ballots.length} total)
        </h3>

        <button
          onClick={downloadAllBallotsCSV}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          disabled={ballots.length === 0}
        >
          <FiDownload className="h-4 w-4" />
          <span>Download All CSV</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-800">{statusCounts.success || 0}</div>
          <div className="text-sm text-green-600">Verified</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-800">{statusCounts.failed || 0}</div>
          <div className="text-sm text-red-600">Failed</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-800">{statusCounts.cast || 0}</div>
          <div className="text-sm text-blue-600">Cast</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-800">{statusCounts.spoiled || 0}</div>
          <div className="text-sm text-orange-600">Spoiled</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-800">{ballots.length}</div>
          <div className="text-sm text-purple-600">Total</div>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by tracking code, hash code, or verification status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <FiHash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ballot_id">Sort by Tracking Code</option>
            <option value="status">Sort by Status</option>
            <option value="verification">Sort by Verification</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {searchTerm && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredBallots.length} of {ballots.length} ballots
        </div>
      )}

      {/* Ballots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBallots.map((ballot, index) => {
          const statusInfo = getVerificationStatus(ballot);
          const StatusIcon = statusInfo.icon;

          return (
            <div
              key={ballot.ballot_id}
              className={`bg-white border-2 ${statusInfo.borderColor} rounded-lg p-4 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div className={`${statusInfo.bgColor} rounded-full p-2 mr-3`}>
                    <FiFileText className={`h-4 w-4 ${statusInfo.textColor}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Ballot #{index + 1}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`flex items-center ${statusInfo.textColor}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        <span className="text-xs font-medium">{statusInfo.text}</span>
                      </div>
                      {ballot.chunkIndex && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                          Chunk {ballot.chunkIndex}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => downloadBallotInfo(ballot)}
                  className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"
                  title="Download ballot verification details"
                >
                  <FiDownload className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-gray-500 font-medium">Tracking Code:</span>
                  <div className="font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded mt-1 break-all text-xs border">
                    {ballot.ballot_id}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Initial Hash:</span>
                  <div className="font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded mt-1 break-all text-xs border">
                    {ballot.initial_hash || 'N/A'}
                  </div>
                </div>
                {ballot.decrypted_hash && ballot.decrypted_hash !== ballot.initial_hash && (
                  <div>
                    <span className="text-gray-500 font-medium">Decrypted Hash:</span>
                    <div className="font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded mt-1 break-all text-xs border">
                      {ballot.decrypted_hash}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    <span className="text-gray-500 font-medium">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${ballot.status === 'cast' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                      {ballot.status}
                    </span>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                    {statusInfo.text}
                  </div>
                </div>

                {/* Blockchain Verification Button */}
                <div className="pt-3 border-t border-gray-100 mt-3">
                  <button
                    onClick={() => verifyBallotOnBlockchain(ballot.ballot_id)}
                    className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${blockchainVerifying[ballot.ballot_id]
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : blockchainResults[ballot.ballot_id]?.success
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                          : blockchainResults[ballot.ballot_id]?.success === false
                            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                      }`}
                    disabled={!ballot.ballot_id || blockchainVerifying[ballot.ballot_id]}
                    title="Verify this ballot using blockchain technology"
                  >
                    {blockchainVerifying[ballot.ballot_id] ? (
                      <>
                        <FiLoader className="h-4 w-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : blockchainResults[ballot.ballot_id]?.success ? (
                      <>
                        <FiCheckCircle className="h-4 w-4" />
                        <span>Blockchain Verified ✓</span>
                      </>
                    ) : blockchainResults[ballot.ballot_id]?.success === false ? (
                      <>
                        <FiX className="h-4 w-4" />
                        <span>Verification Failed</span>
                      </>
                    ) : (
                      <>
                        <FiShield className="h-4 w-4" />
                        <span>Verify Using Blockchain</span>
                      </>
                    )}
                  </button>

                  {/* Blockchain Verification Result Display */}
                  {blockchainResults[ballot.ballot_id] && (
                    <div className={`mt-2 p-3 rounded-lg text-xs ${blockchainResults[ballot.ballot_id].success
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-medium ${blockchainResults[ballot.ballot_id].success ? 'text-green-800' : 'text-red-800'
                          }`}>
                          {blockchainResults[ballot.ballot_id].success ? '🔗 Blockchain Verified' : '⚠️ Verification Failed'}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {timezoneUtils.formatForDisplay(new Date(blockchainResults[ballot.ballot_id].timestamp * 1000).toISOString(), {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZoneName: 'short'
                          })}
                        </span>
                      </div>

                      {blockchainResults[ballot.ballot_id].success ? (
                        <div className="space-y-1 text-green-700">
                          <div>✅ Ballot found on blockchain</div>
                          <div>✅ Hash validation successful</div>
                          <div>✅ Election context verified</div>
                          <div className="flex items-center pt-1 text-xs text-gray-500">
                            <FiClock className="h-3 w-3 mr-1" />
                            {blockchainResults[ballot.ballot_id].data?.timestamp && (
                              <span>{timezoneUtils.formatForDisplay(new Date(blockchainResults[ballot.ballot_id].data.timestamp * 1000).toISOString())}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-red-700">
                          ❌ {blockchainResults[ballot.ballot_id].error || 'Unknown verification error'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredBallots.length === 0 && searchTerm && (
        <div className="text-center py-12">
          <FiHash className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Ballots Found</h3>
          <p className="text-gray-500">No ballots match your search criteria. Try a different search term.</p>
        </div>
      )}

      {ballots.length === 0 && !hasError && (
        <div className="text-center py-12">
          <FiDatabase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Ballots Available</h3>
          <p className="text-gray-500">Ballot verification data will be available after the election results are computed.</p>
        </div>
      )}

      {hasError && (
        <div className="text-center py-12">
          <FiAlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-600 mb-2">Error Loading Ballots</h3>
          <p className="text-gray-700">{errorMessage}</p>
          <p className="text-gray-500 mt-4">Please refresh the page or contact support if this issue persists.</p>
        </div>
      )}
    </div>
  );
};

// Verify Vote Section Component
const VerifyVoteSection = ({ electionId, resultsData }) => {
  const [verificationFile, setVerificationFile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyingVote, setVerifyingVote] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [manualInput, setManualInput] = useState({ tracking_code: '', hash_code: '' });
  const [inputMethod, setInputMethod] = useState('file'); // 'file' or 'manual'

  const handleFileUpload = (file) => {
    if (file && (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.json'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;

          // First try to parse as JSON in case it's a JSON file
          try {
            const jsonData = JSON.parse(content);
            // Check if this is a valid vote receipt JSON format
            if (jsonData.tracking_code && jsonData.hash_code) {
              setVerificationFile(jsonData);
              verifyVoteData(jsonData);
              return;
            } else if (jsonData.ballot_id && (jsonData.initial_hash || jsonData.hash)) {
              // Alternative format that might be used
              const data = {
                tracking_code: jsonData.ballot_id,
                hash_code: jsonData.initial_hash || jsonData.hash
              };
              setVerificationFile(data);
              verifyVoteData(data);
              return;
            }
          } catch {
            // Not JSON, continue with text parsing
          }

          // Parse TXT vote receipt format - try different possible formats
          const voteHashMatch = content.match(/Vote Hash:\s*([a-f0-9]+)/i) ||
            content.match(/Hash:\s*([a-f0-9]+)/i) ||
            content.match(/Hash Code:\s*([a-f0-9]+)/i);

          const trackingCodeMatch = content.match(/Tracking Code:\s*([a-f0-9]+)/i) ||
            content.match(/Ballot ID:\s*([a-f0-9]+)/i) ||
            content.match(/Ballot Tracking ID:\s*([a-f0-9]+)/i);

          if (voteHashMatch && trackingCodeMatch) {
            const data = {
              tracking_code: trackingCodeMatch[1],
              hash_code: voteHashMatch[1]
            };
            setVerificationFile(data);
            verifyVoteData(data);
          } else {
            toast.error('File must contain both a hash code and tracking code');
          }
        } catch (error) {
          toast.error('Failed to read vote receipt file: ' + error.message);
        }
      };
      reader.readAsText(file);
    } else {
      toast.error('Please upload a valid TXT or JSON vote receipt file');
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleManualVerification = () => {
    if (!manualInput.tracking_code.trim() || !manualInput.hash_code.trim()) {
      toast.error('Please enter both tracking code and hash code');
      return;
    }

    const data = {
      tracking_code: manualInput.tracking_code.trim(),
      hash_code: manualInput.hash_code.trim()
    };

    setVerificationFile(data);
    verifyVoteData(data);
  };

  const verifyVoteData = async (data) => {
    try {
      setVerifyingVote(true);
      setVerificationResult(null);

      // First check if we have ballot data locally (faster verification)
      if (resultsData?.verification?.ballots) {
        const localResult = verifyVoteLocally(data, resultsData.verification.ballots);
        setVerificationResult(localResult);
      } else {
        // Fallback to API verification
        const result = await electionApi.verifyVote(electionId, data);
        setVerificationResult(result);
      }
    } catch (error) {
      setVerificationResult({
        status: 'error',
        message: 'Failed to verify vote: ' + error.message
      });
    } finally {
      setVerifyingVote(false);
    }
  };

  const verifyVoteLocally = (data, ballots) => {
    const { tracking_code, hash_code } = data;

    // Make sure ballots is valid
    if (!Array.isArray(ballots)) {
      return {
        status: 'error',
        message: 'Error: Ballot data is not available or in incorrect format',
        found_ballot: false,
        error_details: 'Ballots is not an array'
      };
    }

    // Find ballot by tracking code
    const foundBallot = ballots.find(ballot => ballot.ballot_id === tracking_code);

    if (!foundBallot) {
      return {
        status: 'not_found',
        message: 'Tracking code not found in the tally',
        found_ballot: false
      };
    }

    // Check hash match
    const hashMatches = foundBallot.initial_hash === hash_code ||
      foundBallot.decrypted_hash === hash_code;

    if (hashMatches) {
      return {
        status: 'verified',
        message: 'Vote verified successfully',
        found_ballot: true,
        ballot_info: foundBallot
      };
    } else {
      return {
        status: 'corrupted',
        message: 'Hash mismatch detected - possible tampering',
        found_ballot: true,
        ballot_info: foundBallot,
        expected_hash: foundBallot.initial_hash,
        provided_hash: hash_code
      };
    }
  };

  const getVerificationStatusDisplay = () => {
    if (!verificationResult) return null;

    const { status, message } = verificationResult;

    switch (status) {
      case 'verified':
        return {
          icon: FiCheck,
          color: 'green',
          title: 'Vote Verified Successfully! ✅',
          description: 'Your vote was found and verified in the tally. Both tracking code and hash match perfectly.',
        };
      case 'corrupted':
        return {
          icon: FiAlertCircle,
          color: 'yellow',
          title: 'Vote Found but Hash Mismatch ⚠️',
          description: 'Your tracking code was found, but the hash doesn\'t match. This may indicate tampering or data corruption.',
        };
      case 'not_found':
        return {
          icon: FiX,
          color: 'red',
          title: 'Vote Not Found ❌',
          description: 'Your tracking code was not found in the final tally. Your vote may not have been counted.',
        };
      case 'error':
        return {
          icon: FiAlertCircle,
          color: 'red',
          title: 'Verification Error',
          description: message || 'An error occurred during verification.',
        };
      default:
        return null;
    }
  };

  const statusDisplay = getVerificationStatusDisplay();

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h3 className="text-base sm:text-lg font-semibold flex items-center">
          <FiHash className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          Verify Your Vote
        </h3>

        <div className="flex space-x-2 w-full sm:w-auto">
          <button
            onClick={() => setInputMethod('file')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              inputMethod === 'file'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setInputMethod('manual')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              inputMethod === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Manual Entry
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex items-start">
          <FiInfo className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 text-sm sm:text-base">How to Verify Your Vote</h4>
            <p className="text-xs sm:text-sm text-blue-800 mt-1">
              Use either method below to verify that your vote was counted correctly in the final tally.
              You need both your tracking code and hash code from your vote receipt.
            </p>
          </div>
        </div>
      </div>

      {inputMethod === 'file' ? (
        /* File Upload Method */
        <div
          className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors mb-4 sm:mb-6 ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
        >
          <input
            type="file"
            accept=".txt,.json"
            onChange={handleFileSelect}
            className="hidden"
            id="verification-file"
          />
          <label htmlFor="verification-file" className="cursor-pointer">
            <FiFileText className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">
              Upload Your Vote Receipt
            </p>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 px-2">
              Drag and drop your vote receipt file here (.txt or .json), or click to browse
            </p>
            <span className="inline-block px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base">
              Choose File
            </span>
          </label>
        </div>
      ) : (
        /* Manual Input Method */
        <div className="bg-white border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h4 className="font-medium text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Enter Verification Details</h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tracking Code
              </label>
              <input
                type="text"
                value={manualInput.tracking_code}
                onChange={(e) => setManualInput(prev => ({ ...prev, tracking_code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                placeholder="Enter your tracking code..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hash Code
              </label>
              <input
                type="text"
                value={manualInput.hash_code}
                onChange={(e) => setManualInput(prev => ({ ...prev, hash_code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                placeholder="Enter your hash code..."
              />
            </div>

            <button
              onClick={handleManualVerification}
              disabled={verifyingVote || !manualInput.tracking_code.trim() || !manualInput.hash_code.trim()}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {verifyingVote ? 'Verifying...' : 'Verify Vote'}
            </button>
          </div>
        </div>
      )}

      {/* Verification in Progress */}
      {verifyingVote && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <FiLoader className="h-5 w-5 text-yellow-600 mr-2 animate-spin" />
            <span className="text-yellow-800">Verifying your vote...</span>
          </div>
        </div>
      )}

      {/* Verification Result */}
      {statusDisplay && (
        <div className={`mb-6 p-6 bg-${statusDisplay.color}-50 border border-${statusDisplay.color}-200 rounded-lg`}>
          <div className="flex items-start">
            <statusDisplay.icon className={`h-6 w-6 text-${statusDisplay.color}-600 mr-3 mt-1 flex-shrink-0`} />
            <div className="flex-1">
              <h4 className={`font-medium text-${statusDisplay.color}-900 mb-2`}>
                {statusDisplay.title}
              </h4>
              <p className={`text-${statusDisplay.color}-800 mb-4`}>
                {statusDisplay.description}
              </p>

              {verificationFile && (
                <div className="bg-white rounded-lg p-4 border shadow-sm">
                  <h5 className="font-medium text-gray-900 mb-3">Verification Details</h5>
                  <div className="text-sm space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center">
                      <span className="text-gray-500 font-medium min-w-[120px]">Tracking Code:</span>
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs break-all">
                        {verificationFile.tracking_code}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center">
                      <span className="text-gray-500 font-medium min-w-[120px]">Hash Code:</span>
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs break-all">
                        {verificationFile.hash_code}
                      </span>
                    </div>
                    {verificationResult.found_ballot && (
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-gray-500 font-medium min-w-[120px]">Found in Tally:</span>
                        <span className="text-green-600 font-medium">✓ Yes</span>
                      </div>
                    )}
                    {verificationResult.ballot_info && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <span className="text-gray-500 font-medium">Ballot Status:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${verificationResult.ballot_info.status === 'cast'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                          }`}>
                          {verificationResult.ballot_info.status}
                        </span>
                      </div>
                    )}
                    {verificationResult.expected_hash && verificationResult.provided_hash && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-red-600">
                          <div>Expected: {verificationResult.expected_hash}</div>
                          <div>Provided: {verificationResult.provided_hash}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Understanding Verification Results</h4>
        <div className="text-sm text-gray-700 space-y-2">
          <div className="flex items-start">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
              <FiCheck className="h-3 w-3 text-green-600" />
            </div>
            <div>
              <span className="font-medium">Verified:</span>
              <span className="ml-1">Your vote was found and the hash matches perfectly. Your vote was counted correctly.</span>
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
              <FiAlertCircle className="h-3 w-3 text-yellow-600" />
            </div>
            <div>
              <span className="font-medium">Hash Mismatch:</span>
              <span className="ml-1">Vote found but hash doesn't match. This may indicate tampering or data corruption.</span>
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
              <FiX className="h-3 w-3 text-red-600" />
            </div>
            <div>
              <span className="font-medium">Not Found:</span>
              <span className="ml-1">Your tracking code was not found in the final tally. Your vote may not have been counted.</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This verification system provides cryptographic proof that your vote was counted correctly.
            The verification is performed against the official election tally and cannot be tampered with.
          </p>
        </div>
      </div>
    </div>
  );
};

export default function ElectionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Extract tab from URL path (e.g., '/election-page/1/voting-booth' -> 'voting-booth')
  const getTabFromPath = useCallback(() => {
    const pathSegments = location.pathname.split('/');
    const tabPath = pathSegments[pathSegments.length - 1];

    // If the last segment is just the ID, show default tab (info)
    if (tabPath === id) {
      return 'info';
    }

    // Find the tab that matches the path
    const matchedTab = subMenus.find(tab => tab.path === tabPath);
    return matchedTab ? matchedTab.key : 'info';
  }, [location.pathname, id]);

  const [activeTab, setActiveTab] = useState(getTabFromPath);

  // Update URL when tab changes
  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    const selectedTab = subMenus.find(tab => tab.key === tabKey);
    if (selectedTab) {
      const newPath = selectedTab.path
        ? `/election-page/${id}/${selectedTab.path}`
        : `/election-page/${id}`;
      navigate(newPath);
    }
  };

  // Update active tab when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabFromPath = getTabFromPath();
    if (tabFromPath !== activeTab) {
      setActiveTab(tabFromPath);
    }
  }, [location.pathname]); // Remove activeTab from dependency to prevent infinite loop

  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [electionData, setElectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Voting-related state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voteResult, setVoteResult] = useState(null);
  const [voteError, setVoteError] = useState(null);

  // Encrypted ballot workflow state
  const [encryptedBallotData, setEncryptedBallotData] = useState(null);
  const [showBallotActions, setShowBallotActions] = useState(false);
  const [challengeResult, setChallengeResult] = useState(null);
  const [ballotChallenged, setBallotChallenged] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [isChallenging, setIsChallenging] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeCandidateChoice, setChallengeCandidateChoice] = useState('');

  // Bot detection state
  const [botDetection, setBotDetection] = useState({
    loading: true,
    isBot: false,
    error: null,
    requestId: null,
    timestamp: null
  });

  // Eligibility state
  const [eligibilityData, setEligibilityData] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Guardian state
  const [guardianKey, setGuardianKey] = useState('');
  const [isSubmittingKey, setIsSubmittingKey] = useState(false);
  const [keySubmissionResult, setKeySubmissionResult] = useState(null);
  const [keySubmissionError, setKeySubmissionError] = useState(null);

  // Results state
  const [resultsData, setResultsData] = useState(null);
  const [rawVerificationData, setRawVerificationData] = useState(null); // Store raw API response for ballots
  const [animatedResults, setAnimatedResults] = useState(null); // Store animated results from new endpoint
  const [loadingResults, setLoadingResults] = useState(false);
  const [combiningDecryptions, setCombiningDecryptions] = useState(false);

  // Tally creation state
  // const [tallyCreated, setTallyCreated] = useState(false);
  const [creatingTally, setCreatingTally] = useState(false);
  const [isTallyModalOpen, setIsTallyModalOpen] = useState(false);
  const [tallyStatus, setTallyStatus] = useState(null);

  // Decryption progress state
  const [isDecryptionModalOpen, setIsDecryptionModalOpen] = useState(false);
  const [currentGuardianName, setCurrentGuardianName] = useState(null);
  const [guardianDecryptionStatus, setGuardianDecryptionStatus] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Combine progress state
  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false);
  const [combineStatus, setCombineStatus] = useState(null);

  // Fetch election data function (moved outside useEffect for reusability)
  const fetchElectionData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await electionApi.getElectionById(id);
      if (data === null) {
        setError('You are not authorized to view this election or the election does not exist.');
      } else {
        setElectionData(data);
        // Check if user has already voted - this info is now handled through eligibilityData

        // Auto-load results if election has ended and is decrypted
        const electionStatus = getElectionStatusFromData(data);
        if (electionStatus === 'Ended') {
          const guardiansSubmitted = data.guardiansSubmitted || 0;
          const electionQuorum = data.electionQuorum || data.totalGuardians || 0;
          const quorumMet = guardiansSubmitted >= electionQuorum;

          // Check if results already exist (election status is 'decrypted')
          if (data.status === 'decrypted') {
            console.log('✅ Results already computed. Loading cached results...');
            
            // Fetch cached results from new endpoint
            try {
              const animatedResultsData = await electionApi.getElectionResults(id);
              console.log('📦 [CACHED RESULTS] Raw data from backend:', {
                success: animatedResultsData.success,
                finalTallies: animatedResultsData.results?.finalTallies,
                totalBallots: animatedResultsData.results?.total_ballots_cast,
                chunksCount: animatedResultsData.results?.chunks?.length
              });
              
              if (animatedResultsData.success && animatedResultsData.results) {
                console.log('✅ Loaded cached results with chunk breakdown');
                setAnimatedResults(animatedResultsData);
                
                // Extract and properly format ballot data from cached results
                if (animatedResultsData.results.allBallots && animatedResultsData.results.allBallots.length > 0) {
                  // Build verification data structure to match expected format
                  const cachedVerificationData = {
                    verification: {
                      ballots: animatedResultsData.results.allBallots
                    },
                    results: {
                      finalTallies: animatedResultsData.results.finalTallies,
                      total_ballots_cast: animatedResultsData.results.total_ballots_cast || animatedResultsData.results.allBallots.length,
                      total_valid_ballots: animatedResultsData.results.total_valid_ballots || animatedResultsData.results.allBallots.length,
                      total_eligible_voters: data.voters?.length || 0
                    }
                  };
                  setRawVerificationData(cachedVerificationData);
                  
                  // Process and set results data for charts and statistics
                  // Pass data directly to avoid stale state issue
                  const processedResults = processElectionResults(cachedVerificationData, data);
                  if (processedResults) {
                    setResultsData(processedResults);
                    console.log('✅ Results processed for charts:', processedResults);
                  }
                }
              }
            } catch (err) {
              console.warn('Failed to load cached results:', err);
            }
          }
          // NOTE: Auto-combine removed - users must manually click "Combine Partial Decryptions" button
        }
      }
    } catch (err) {
      setError('Failed to load election data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [id]); // Removed processElectionResults from dependencies - it's stable and called directly

  // Load election data and optionally create tally
  useEffect(() => {
    if (id) {
      fetchElectionData();
    }
  }, [id, fetchElectionData]);

  // Check decryption status when guardian tab becomes active or on page load
  useEffect(() => {
    const checkGuardianDecryptionStatus = async () => {
      if (activeTab === 'guardian' && electionData?.guardians) {
        try {
          const statusData = await electionApi.getDecryptionStatus(id);
          setGuardianDecryptionStatus(statusData);
          console.log('Guardian decryption status loaded:', statusData.status);
          
          // If status is in_progress or pending, we should show the progress button
          if (statusData.status === 'in_progress' || statusData.status === 'pending') {
            console.log('⚠️ Guardian has ongoing decryption process');
            setCurrentGuardianName(statusData.guardianEmail || statusData.guardianName || 'Guardian');
          }
        } catch (err) {
          console.log('No decryption status found or not a guardian:', err.message);
          setGuardianDecryptionStatus(null);
        }
      }
    };

    checkGuardianDecryptionStatus();
    
    // Poll periodically if guardian tab is active to catch ongoing processes
    let pollInterval;
    if (activeTab === 'guardian') {
      pollInterval = setInterval(checkGuardianDecryptionStatus, 5000); // Check every 5 seconds
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeTab, id, electionData?.guardians]);

  // Initialize bot detection on component mount
  useEffect(() => {
    console.log('🚀 [BOT DETECTION] Initializing bot detection for voting...');

    const initBotDetection = async () => {
      try {
        console.log('📡 [BOT DETECTION] Loading botD library...');
        const botd = await load();
        console.log('✅ [BOT DETECTION] BotD library loaded successfully');

        console.log('🔍 [BOT DETECTION] Running bot detection analysis...');
        const result = await botd.detect();

        console.log('📊 [BOT DETECTION] Detection completed. Full result:', result);
        console.log(`🤖 [BOT DETECTION] Is Bot: ${result.bot}`);
        console.log(`📈 [BOT DETECTION] Request ID: ${result.requestId || 'Not available'}`);

        setBotDetection({
          loading: false,
          isBot: result.bot,
          error: null,
          requestId: result.requestId,
          timestamp: new Date().toISOString()
        });

        if (result.bot) {
          console.warn('🚨 [BOT DETECTION] Bot detected during page load');
        } else {
          console.log('✅ [BOT DETECTION] Human user detected during page load');
        }

      } catch (error) {
        console.error('❌ [BOT DETECTION] Failed to initialize bot detection:', error);
        setBotDetection({
          loading: false,
          isBot: false, // Default to false on error to not block legitimate users
          error: error.message,
          requestId: null,
          timestamp: new Date().toISOString()
        });
      }
    };

    initBotDetection();
  }, []); // Run once on component mount

  // Create tally function
  const createTallyForElection = async (electionId) => {
    try {
      setCreatingTally(true);
      const tallyResponse = await electionApi.createTally(electionId);
      console.log('Tally creation response:', tallyResponse);
      // setTallyCreated(true);  // Commented out as not used currently
    } catch (err) {
      console.error('Failed to create tally:', err);
      // Don't show error to user as this is automatic
    } finally {
      setCreatingTally(false);
    }
  };

  // Check eligibility when switching to voting tab
  useEffect(() => {
    const checkEligibility = async () => {
      if (activeTab === 'voting' && id && !eligibilityData && !checkingEligibility) {
        try {
          setCheckingEligibility(true);
          const response = await electionApi.checkEligibility(id);
          setEligibilityData(response);
        } catch (err) {
          console.error('Error checking eligibility:', err);
          setEligibilityData({
            eligible: false,
            message: 'Error checking eligibility',
            reason: 'Unable to verify eligibility status',
            hasVoted: false,
            isElectionActive: false,
            electionStatus: 'Error'
          });
        } finally {
          setCheckingEligibility(false);
        }
      }
    };

    checkEligibility();
  }, [activeTab, id, eligibilityData, checkingEligibility]);

  // Define functions first
  const getElectionStatus = useCallback(() => {
    if (!electionData) return 'Unknown';

    const now = new Date();
    const startDate = new Date(electionData.startingTime);
    const endDate = new Date(electionData.endingTime);

    if (now < startDate) return 'Upcoming';
    if (now > endDate) return 'Ended';
    return 'Active';
  }, [electionData]);

  const canUserViewResults = useCallback(() => {
    return electionData?.userRoles?.includes('admin') ||
      electionData?.userRoles?.includes('guardian') ||
      getElectionStatus() === 'Ended';
  }, [electionData, getElectionStatus]);

  const processElectionResults = useCallback((apiResponseData = null, electionDataParam = null) => {
    // Use provided electionDataParam or fall back to state electionData
    const currentElectionData = electionDataParam || electionData;
    
    // Use provided data or fall back to existing resultsData
    const dataToProcess = apiResponseData || resultsData;

    // If we have resultsData from combine-decryption, use that as it's more accurate
    // Handle both 'candidates' and 'finalTallies' from backend
    const candidates = dataToProcess?.results?.candidates || dataToProcess?.results?.finalTallies;
    
    console.log('🔍 [processElectionResults] Processing data:', {
      hasCandidates: !!candidates,
      candidatesData: candidates,
      dataStructure: dataToProcess?.results,
      hasCurrentElectionData: !!currentElectionData,
      electionChoices: currentElectionData?.electionChoices?.map(c => ({
        optionTitle: c.optionTitle,
        partyName: c.partyName,
        choiceId: c.choiceId
      }))
    });
    
    if (candidates) {
      // Calculate total votes - handle both simple integers and nested objects
      const totalVotes = Object.values(candidates).reduce((sum, candidate) => {
        if (typeof candidate === 'number') {
          return sum + candidate;
        } else if (typeof candidate === 'object' && candidate.votes) {
          return sum + parseInt(candidate.votes || 0);
        } else if (typeof candidate === 'string') {
          return sum + parseInt(candidate || 0);
        }
        return sum;
      }, 0);
      
      console.log('📊 [processElectionResults] Total votes calculated:', totalVotes);

      // Build chart data - handle both simple integers and nested objects
      const chartData = Object.entries(candidates).map(([name, data]) => {
        let votes = 0;
        let percentage = 0;
        
        if (typeof data === 'number') {
          votes = data;
        } else if (typeof data === 'object' && data.votes !== undefined) {
          votes = parseInt(data.votes || 0);
          percentage = parseFloat(data.percentage || 0);
        } else if (typeof data === 'string') {
          votes = parseInt(data || 0);
        }
        
        // Calculate percentage if not provided
        if (!percentage && totalVotes > 0) {
          percentage = ((votes / totalVotes) * 100).toFixed(1);
        }
        
        // Map candidate name to party name from currentElectionData
        // Use more robust matching: trim whitespace and case-insensitive comparison
        const normalizedName = name.trim().toLowerCase();
        const candidateChoice = currentElectionData?.electionChoices?.find(
          choice => choice.optionTitle.trim().toLowerCase() === normalizedName
        );
        
        console.log(`🔍 [Party Mapping] Candidate "${name}":`, {
          normalizedName,
          found: !!candidateChoice,
          partyName: candidateChoice?.partyName,
          optionTitle: candidateChoice?.optionTitle,
          hasElectionData: !!currentElectionData,
          hasElectionChoices: !!currentElectionData?.electionChoices,
          choicesCount: currentElectionData?.electionChoices?.length,
          availableChoices: currentElectionData?.electionChoices?.map(c => ({ 
            title: c.optionTitle, 
            titleLower: c.optionTitle.trim().toLowerCase(),
            party: c.partyName 
          }))
        });
        
        return {
          name: name,
          votes: votes,
          percentage: parseFloat(percentage),
          party: candidateChoice?.partyName || 'Independent'
        };
      });

      // Count total ballots from verification data or use total votes
      const totalBallots = dataToProcess.verification?.ballots?.length || 
                          dataToProcess.results?.total_valid_ballots || 
                          dataToProcess.results?.total_ballots_cast || 
                          totalVotes;

      // Use total_eligible_voters from API if available, otherwise fall back to currentElectionData
      const totalEligibleVoters = dataToProcess.results?.total_eligible_voters || 
                                  currentElectionData?.voters?.length || 
                                  0;
      
      return {
        totalVotes,
        totalEligibleVoters,
        totalVotedUsers: totalBallots,
        turnoutRate: totalEligibleVoters > 0 ?
          ((totalBallots || 0) / totalEligibleVoters * 100).toFixed(1) : 0,
        chartData,
        choices: chartData,
        // Include verification data
        verification: dataToProcess.verification || null
      };
    }

    // Fallback to currentElectionData if resultsData is not available
    if (!currentElectionData?.electionChoices) return null;

    const totalVotes = currentElectionData.electionChoices.reduce((sum, choice) => sum + (choice.totalVotes || 0), 0);
    const totalEligibleVoters = currentElectionData.voters?.length || 0;
    const totalVotedUsers = currentElectionData.voters?.filter(v => v.hasVoted).length || 0;

    const chartData = currentElectionData.electionChoices.map(choice => ({
      name: choice.optionTitle,
      votes: choice.totalVotes || 0,
      percentage: totalVotes > 0 ? ((choice.totalVotes || 0) / totalVotes * 100).toFixed(1) : 0,
      party: choice.partyName
    }));

    return {
      totalVotes,
      totalEligibleVoters,
      totalVotedUsers,
      turnoutRate: totalEligibleVoters > 0 ? (totalVotedUsers / totalEligibleVoters * 100).toFixed(1) : 0,
      chartData,
      choices: currentElectionData.electionChoices,
      verification: null
    };
  }, [resultsData, electionData]);

  // Process raw verification data when it becomes available
  useEffect(() => {
    if (rawVerificationData && !resultsData) {
      const processedResults = processElectionResults(rawVerificationData);
      if (processedResults) {
        setResultsData(processedResults);
        console.log('✅ Processed election results from auto-combined data');
      }
    }
  }, [rawVerificationData, resultsData, processElectionResults]);

  const combinePartialDecryptions = useCallback(async () => {
    setCombiningDecryptions(true);
    try {
      const response = await electionApi.combinePartialDecryptions(id);
      console.log('Combined partial decryptions');

      // After combining, immediately fetch cached results with full ballot data
      try {
        const animatedResultsData = await electionApi.getElectionResults(id);
        if (animatedResultsData.success && animatedResultsData.results) {
          console.log('✅ Auto-fetched cached results with chunk breakdown after combining');
          setAnimatedResults(animatedResultsData);
          
          // Build verification data structure from newly cached results
          if (animatedResultsData.results.allBallots && animatedResultsData.results.allBallots.length > 0) {
            const cachedVerificationData = {
              verification: {
                ballots: animatedResultsData.results.allBallots
              },
              results: {
                finalTallies: animatedResultsData.results.finalTallies,
                total_ballots_cast: animatedResultsData.results.allBallots.length,
                total_valid_ballots: animatedResultsData.results.allBallots.length,
                total_eligible_voters: electionData?.voters?.length || 0
              }
            };
            setRawVerificationData(cachedVerificationData);
            
            // Process and set the results data for charts and statistics
            // Pass electionData to ensure party names are mapped correctly
            const processedResults = processElectionResults(cachedVerificationData, electionData);
            setResultsData(processedResults);
            
            console.log(`✅ Loaded ${animatedResultsData.results.allBallots.length} ballots after combining`);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch cached results after combining:', err);
      }

      toast.success('🎉 Election results successfully decrypted! The final tallies are now available.', {
        duration: 5000
      });
    } catch (error) {
      console.error('Error combining partial decryptions:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      if (errorMessage.includes('Quorum not met')) {
        toast.error('❌ ' + errorMessage, { duration: 8000 });
      } else {
        toast.error('Failed to combine partial decryptions: ' + errorMessage);
      }
    } finally {
      setCombiningDecryptions(false);
    }
  }, [id, processElectionResults]);

  // Initiate combine partial decryptions (async with progress tracking)
  const handleInitiateCombine = useCallback(async () => {
    try {
      console.log('Initiating combine for election:', id);
      
      // Open modal immediately to show user feedback
      setIsCombineModalOpen(true);
      
      // Then start the backend process
      const response = await electionApi.initiateCombine(id);
      
      if (response.success) {
        toast.success('Combine process started!');
      } else {
        // If initiation failed, close modal and show error
        setIsCombineModalOpen(false);
        toast.error(response.message || 'Failed to initiate combine');
      }
    } catch (error) {
      console.error('Error initiating combine:', error);
      setIsCombineModalOpen(false);
      toast.error('Failed to start combine process: ' + (error.message || 'Unknown error'));
    }
  }, [id]);

  // Check combine status
  const handleCheckCombineStatus = useCallback(async () => {
    try {
      const status = await electionApi.getCombineStatus(id);
      setCombineStatus(status);
      
      if (status.status === 'completed') {
        toast.success('Combine completed! Refreshing results...');
        // Reload results after successful combine
        fetchElectionData();
      } else if (status.status === 'in_progress') {
        toast('Combine in progress. Opening progress modal...', { icon: '🔄' });
        setIsCombineModalOpen(true);
      } else if (status.status === 'failed') {
        toast.error('Combine failed: ' + (status.errorMessage || 'Unknown error'));
      } else if (status.status === 'pending') {
        toast('Combine is pending...', { icon: '⏳' });
      } else {
        toast('Combine status: ' + status.status);
      }
    } catch (error) {
      console.error('Error checking combine status:', error);
      toast.error('Failed to check combine status');
    }
  }, [id, fetchElectionData]);

  // Handle combine completion from modal
  const handleCombineComplete = useCallback(async () => {
    console.log('Combine completed! Refreshing results...');
    
    // Close the modal first to prevent re-opening
    setIsCombineModalOpen(false);
    
    toast.success('🎉 Election results successfully decrypted!', { duration: 5000 });
    
    // Reload election data to get updated results
    await fetchElectionData();
    
    // Try to fetch cached results
    try {
      const animatedResultsData = await electionApi.getElectionResults(id);
      if (animatedResultsData.success && animatedResultsData.results) {
        setAnimatedResults(animatedResultsData);
        
        if (animatedResultsData.results.allBallots && animatedResultsData.results.allBallots.length > 0) {
          const cachedVerificationData = {
            verification: {
              ballots: animatedResultsData.results.allBallots
            },
            results: {
              finalTallies: animatedResultsData.results.finalTallies,
              total_ballots_cast: animatedResultsData.results.allBallots.length,
              total_valid_ballots: animatedResultsData.results.allBallots.length,
              total_eligible_voters: electionData?.voters?.length || 0
            }
          };
          setRawVerificationData(cachedVerificationData);
          const processedResults = processElectionResults(cachedVerificationData, electionData);
          setResultsData(processedResults);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch cached results after combining:', err);
    }
  }, [id, fetchElectionData, processElectionResults]);

  const loadElectionResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      // Simply load the current election data and process it
      // Don't automatically combine decryptions - let users click the button manually
      const processedResults = processElectionResults();
      setResultsData(processedResults);

      // Check if we have stored verification data, if not, try to get it from existing results
      if (!rawVerificationData && electionData?.status === 'decrypted') {
        console.log('Election is decrypted but no verification data cached. User should click "Combine Results" if needed.');
      }
    } catch (err) {
      console.error('Error loading results:', err);
      // Fallback to electionData if processing fails
      const processedResults = processElectionResults();
      setResultsData(processedResults);
    } finally {
      setLoadingResults(false);
    }
  }, [electionData, processElectionResults, rawVerificationData]);

  // Load results when switching to results, ballots, or verify tabs
  useEffect(() => {
    const tabsRequiringResults = ['results', 'ballots', 'verify'];
    if (tabsRequiringResults.includes(activeTab) && canUserViewResults() && !resultsData && !loadingResults) {
      loadElectionResults();
    }
  }, [activeTab, resultsData, loadingResults, loadElectionResults, canUserViewResults]);



  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    
    // Instead of showing confirmation modal, create encrypted ballot
    await handleCreateEncryptedBallot();
  };

  const handleCreateEncryptedBallot = async () => {
    // Clear all previous states when creating a new encrypted ballot
    setEncryptedBallotData(null);
    setShowBallotActions(false);
    setChallengeResult(null);
    setBallotChallenged(false);
    setVoteResult(null);
    setVoteError(null);
    
    setIsSubmitting(true);

    console.log('🔍 [ENCRYPTED BALLOT] Performing fresh bot detection before creating encrypted ballot...');

    // Perform fresh bot detection before creating encrypted ballot
    let freshBotDetection = null;
    try {
      const botd = await load();
      const result = await botd.detect();

      freshBotDetection = {
        isBot: result.bot,
        requestId: result.requestId,
        timestamp: new Date().toISOString()
      };

      console.log('🤖 [ENCRYPTED BALLOT] Fresh bot detection result:', {
        isBot: result.bot,
        requestId: result.requestId
      });

      console.log('✅ [ENCRYPTED BALLOT] Fresh bot check passed');
    } catch (error) {
      console.error('⚠️ [ENCRYPTED BALLOT] Fresh bot detection failed:', error);
      // Continue with creation but without bot detection data
    }

    try {
      const selectedChoice = electionData.electionChoices.find(
        choice => choice.choiceId.toString() === selectedCandidate
      );

      console.log('📤 [ENCRYPTED BALLOT] Creating encrypted ballot...');
      const result = await electionApi.createEncryptedBallot(
        id,
        selectedChoice.choiceId,
        selectedChoice.optionTitle,
        freshBotDetection
      );

      // Store encrypted ballot data
      setEncryptedBallotData(result);
      setShowBallotActions(true);
      setSelectedCandidate(''); // Reset selection

      console.log('✅ [ENCRYPTED BALLOT] Encrypted ballot created successfully');

    } catch (err) {
      console.error('❌ [ENCRYPTED BALLOT] Ballot creation failed:', err);
      setVoteError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to download file content
  const downloadFile = (content, filename, displayName) => {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${displayName} downloaded successfully!`);
    } catch (error) {
      console.error(`Error downloading ${displayName}:`, error);
      toast.error(`Failed to download ${displayName}`);
    }
  };

  // Download ballot info as JSON
  const downloadBallotInfo = () => {
    try {
      const ballotInfo = {
        ballot_hash: encryptedBallotData.ballot_hash,
        ballot_tracking_code: encryptedBallotData.ballot_tracking_code,
        election_id: id,
        candidate: encryptedBallotData.candidate || 'Selected Candidate',
        created_at: new Date().toISOString(),
        file_info: {
          encrypted_ballot: 'encrypted_ballot.txt',
          encrypted_ballot_with_nonce: 'encrypted_ballot_with_nonce.txt'
        }
      };
      
      const content = JSON.stringify(ballotInfo, null, 2);
      downloadFile(content, 'ballot_info.json', 'Ballot Info');
    } catch (error) {
      console.error('Error creating ballot info:', error);
      toast.error('Failed to create ballot info');
    }
  };

  // Handle casting the encrypted ballot
  const handleCastEncryptedBallot = async () => {
    if (!encryptedBallotData || ballotChallenged) return;
    
    setIsCasting(true);
    setVoteError(null);

    try {
      console.log('📤 [CAST ENCRYPTED] Casting encrypted ballot...');
      const result = await electionApi.castEncryptedBallot(
        id,
        encryptedBallotData.encrypted_ballot,
        encryptedBallotData.ballot_hash,
        encryptedBallotData.ballot_tracking_code
      );

      // Store the cast result with encrypted ballot info
      const castResultWithBallot = {
        ...result,
        encryptedBallotData
      };

      setVoteResult(castResultWithBallot);
      setShowBallotActions(false); // Hide ballot actions
      setEncryptedBallotData(null); // Clear encrypted ballot data

      console.log('✅ [CAST ENCRYPTED] Encrypted ballot cast successfully');

      // Update eligibility data to reflect that user has voted
      setEligibilityData(prev => ({
        ...prev,
        eligible: false,
        hasVoted: true,
        message: 'You have already voted in this election',
        reason: 'Already voted'
      }));

      toast.success('Vote cast successfully!');

    } catch (err) {
      console.error('❌ [CAST ENCRYPTED] Casting failed:', err);
      setVoteError(err.message);
      toast.error('Failed to cast vote: ' + err.message);
    } finally {
      setIsCasting(false);
    }
  };

  // Handle Benaloh challenge
  const handleBenalohChallenge = async () => {
    if (!encryptedBallotData || ballotChallenged) return;
    
    // Instead of performing challenge directly, show candidate selection modal
    setShowChallengeModal(true);
  };

  const handleConfirmChallenge = async () => {
    if (!challengeCandidateChoice) return;
    
    setIsChallenging(true);
    setChallengeResult(null);
    setShowChallengeModal(false);

    try {
      console.log('🔍 [BENALOH CHALLENGE] Performing challenge...');
      
      // Find the selected candidate name
      const selectedChoice = electionData.electionChoices.find(
        choice => choice.choiceId.toString() === challengeCandidateChoice
      );
      const candidateName = selectedChoice ? selectedChoice.optionTitle : 'Unknown Candidate';
      
      console.log('🔍 [BENALOH CHALLENGE] Challenge candidate:', candidateName);

      const result = await electionApi.performBenalohChallenge(
        id,
        encryptedBallotData.encrypted_ballot_with_nonce,
        candidateName
      );

      setChallengeResult(result);
      setBallotChallenged(true); // Mark ballot as challenged
      setShowBallotActions(false); // Hide actions after challenge

      console.log('✅ [BENALOH CHALLENGE] Challenge completed:', result);

      if (result.match) {
        toast.success(`✅ Challenge verification passed! The ballot was encrypted for: ${result.verified_candidate}`);
      } else {
        toast.error(`❌ Challenge verification failed! Expected: ${result.expected_candidate}, but found: ${result.verified_candidate}`);
      }

    } catch (err) {
      console.error('❌ [BENALOH CHALLENGE] Challenge failed:', err);
      toast.error('Failed to perform challenge: ' + err.message);
    } finally {
      setIsChallenging(false);
    }
  };

  const handleConfirmVote = async () => {
    setIsSubmitting(true);
    setVoteError(null);

    console.log('🔍 [VOTING] Performing fresh bot detection before vote...');

    // Perform fresh bot detection before voting
    let freshBotDetection = null;
    try {
      const botd = await load();
      const result = await botd.detect();

      freshBotDetection = {
        isBot: result.bot,
        requestId: result.requestId,
        timestamp: new Date().toISOString()
      };

      console.log('🤖 [VOTING] Fresh bot detection result:', {
        isBot: result.bot,
        requestId: result.requestId
      });

      if (result.bot) {
        console.warn('🚨 [VOTING] Bot detected during vote attempt');
        setVoteError('Security check failed. Automated voting is not allowed.');
        setIsSubmitting(false);
        return;
      }

      console.log('✅ [VOTING] Fresh bot check passed');
    } catch (error) {
      console.error('⚠️ [VOTING] Fresh bot detection failed:', error);
      // Continue with voting but without bot detection data
      // This prevents legitimate users from being blocked due to technical issues
    }

    try {
      const selectedChoice = electionData.electionChoices.find(
        choice => choice.choiceId.toString() === selectedCandidate
      );

      console.log('📤 [VOTING] Sending vote request with bot detection data...');
      const result = await electionApi.castBallot(
        id,
        selectedChoice.choiceId,
        selectedChoice.optionTitle,
        freshBotDetection // Pass fresh bot detection data
      );

      // Store the voted candidate information with the result
      const voteResultWithCandidate = {
        ...result,
        votedCandidate: selectedChoice
      };

      setVoteResult(voteResultWithCandidate);
      setSelectedCandidate('');
      setShowConfirmModal(false);

      console.log('✅ [VOTING] Vote cast successfully');

      // Update eligibility data to reflect that user has voted
      setEligibilityData(prev => ({
        ...prev,
        eligible: false,
        hasVoted: true,
        message: 'You have already voted in this election',
        reason: 'Already voted'
      }));
    } catch (err) {
      console.error('❌ [VOTING] Vote casting failed:', err);
      setVoteError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckDecryptionStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const statusData = await electionApi.getDecryptionStatus(id);
      setGuardianDecryptionStatus(statusData);
      setCurrentGuardianName(statusData.guardianEmail || 'Guardian');
      setIsDecryptionModalOpen(true);
    } catch (err) {
      toast.error('Failed to fetch decryption status');
      console.error('Status check error:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleGuardianKeySubmit = async (e) => {
    e.preventDefault();
    if (!guardianKey.trim()) return;

    setIsSubmittingKey(true);
    setKeySubmissionError(null);
    setKeySubmissionResult(null);

    try {
      // Check if decryption is already in progress or completed
      try {
        const statusData = await electionApi.getDecryptionStatus(id);
        setGuardianDecryptionStatus(statusData);
        
        if (statusData.status === 'in_progress' || statusData.status === 'pending') {
          toast.info('⚠️ Decryption is already in progress! Opening progress monitor...');
          setCurrentGuardianName(statusData.guardianEmail || statusData.guardianName || 'Guardian');
          setIsDecryptionModalOpen(true);
          setIsSubmittingKey(false);
          return;
        }
        
        if (statusData.status === 'completed') {
          toast.success('Decryption already completed successfully!');
          setKeySubmissionResult({ success: true, message: 'Your credentials were previously verified and decryption is complete.' });
          setIsSubmittingKey(false);
          return;
        }
        
        // If status is 'failed', allow resubmission by continuing the flow
        if (statusData.status === 'failed') {
          console.log('Previous submission failed, allowing retry...');
          toast.info('⚠️ Previous attempt failed. Retrying with new credentials...');
        }
      } catch (statusErr) {
        // Status doesn't exist yet, proceed with submission
        console.log('No existing status, proceeding with submission');
      }

      // Use new async endpoint
      console.log('Calling initiateDecryption API...');
      const result = await electionApi.initiateDecryption(id, guardianKey);
      console.log('Initiate decryption result:', result);

      if (result.success) {
        // Show immediate acknowledgment
        toast.success('✅ Credentials received! Opening progress monitor...');
        setKeySubmissionResult(result);
        
        // Fetch status immediately to populate modal
        try {
          const statusData = await electionApi.getDecryptionStatus(id);
          setGuardianDecryptionStatus(statusData);
          setCurrentGuardianName(statusData.guardianEmail || result.guardianEmail || 'Guardian');
        } catch (err) {
          console.log('Could not fetch initial status, modal will poll:', err);
          setCurrentGuardianName(result.guardianEmail || 'Guardian');
        }
        
        // Open modal immediately
        console.log('Opening decryption modal');
        setIsDecryptionModalOpen(true);
        
        setGuardianKey('');

        // Refresh election data after a short delay
        setTimeout(async () => {
          try {
            const updatedData = await electionApi.getElectionById(id);
            setElectionData(updatedData);
          } catch (err) {
            console.error('Failed to refresh election data:', err);
          }
        }, 2000);
      } else {
        setKeySubmissionError(result.message || 'Failed to submit guardian credentials');
        toast.error(result.message || 'Failed to submit credentials');
      }
    } catch (err) {
      console.error('Error in handleGuardianKeySubmit:', err);
      setKeySubmissionError(err.message || 'Failed to submit guardian credentials');
      toast.error(err.message || 'Failed to submit credentials');
    } finally {
      setIsSubmittingKey(false);
    }
  };

  const handleDecryptionModalClose = async () => {
    setIsDecryptionModalOpen(false);
    // Refresh election data to update guardian status
    try {
      const updatedData = await electionApi.getElectionById(id);
      setElectionData(updatedData);
    } catch (err) {
      console.error('Failed to refresh election data:', err);
    }
  };

  const handleCredentialFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setGuardianKey('');
      return;
    }

    try {
      const fileContent = await file.text();
      setGuardianKey(fileContent.trim());
    } catch (error) {
      setKeySubmissionError(`Failed to read credential file: ${error.message}`);
      setGuardianKey('');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const saveVoteDetails = (format = 'txt') => {
    if (format === 'txt') {
      // Standard TXT format for vote receipts
      const txtDetails = `
Election: ${electionData.electionTitle}
Vote Hash: ${voteResult.hashCode}
Tracking Code: ${voteResult.trackingCode}
Date: ${timezoneUtils.formatForDisplay(new Date().toISOString())}
Candidate: ${voteResult.votedCandidate?.optionTitle || 'Unknown'}
Party: ${voteResult.votedCandidate?.partyName || 'N/A'}
      `.trim();

      const blob = new Blob([txtDetails], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vote-receipt-${voteResult.trackingCode}.txt`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else if (format === 'json') {
      // JSON format for technical users
      const jsonDetails = {
        election: electionData.electionTitle,
        election_id: electionData.id,
        tracking_code: voteResult.trackingCode,
        hash_code: voteResult.hashCode,
        date: new Date().toISOString(),
        candidate: voteResult.votedCandidate?.optionTitle || 'Unknown',
        party: voteResult.votedCandidate?.partyName || 'N/A'
      };

      const blob = new Blob([JSON.stringify(jsonDetails, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vote-receipt-${voteResult.trackingCode}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const downloadResultsPDF = () => {
    if (!resultsData) return;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Election Results', 20, 30);

    doc.setFontSize(14);
    doc.text(`Election: ${electionData.electionTitle}`, 20, 50);
    doc.text(`Total Votes: ${resultsData.totalVotes}`, 20, 70);
    doc.text(`Turnout: ${resultsData.turnoutRate}%`, 20, 90);

    let yPosition = 120;
    doc.setFontSize(12);
    doc.text('Results:', 20, yPosition);

    resultsData.chartData.forEach((item) => {
      yPosition += 20;
      doc.text(`${item.name}: ${item.votes} votes (${item.percentage}%)`, 30, yPosition);
    });

    doc.save(`election-results-${id}.pdf`);
  };

  const downloadResultsCSV = () => {
    if (!resultsData) return;

    const csvContent = [
      ['Candidate', 'Party', 'Votes', 'Percentage'],
      ...resultsData.chartData.map(item => [
        item.name,
        item.party || 'N/A',
        item.votes,
        item.percentage + '%'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    saveAs(blob, `election-results-${id}.csv`);
  };

  const formatDate = (dateString) => {
    return timezoneUtils.formatForDisplay(dateString);
  };

  const getElectionStatusFromData = (data) => {
    if (!data) return 'Unknown';

    const now = new Date();
    const startDate = new Date(data.startingTime);
    const endDate = new Date(data.endingTime);

    if (now < startDate) return 'Upcoming';
    if (now > endDate) return 'Ended';
    return 'Active';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Upcoming': return 'bg-yellow-100 text-yellow-800';
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Ended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // const canUserVote = () => {
  //   // Check if user can vote based on the new eligibility field
  //   return canUserVoteInElection(electionData) && getElectionStatus() === 'Active' && !hasVoted;
  // };

  // Helper function to determine if user can vote in an election based on eligibility
  const canUserVoteInElection = (election) => {
    if (!election) return false;

    const eligibility = election.eligibility;

    if (eligibility === 'unlisted') {
      // For unlisted elections, anyone can vote (no voter list restriction)
      return true;
    } else if (eligibility === 'listed') {
      // For listed elections, only users with 'voter' role can vote
      return election.userRoles?.includes('voter') || false;
    }

    // Default fallback - if eligibility is not set or unknown, be restrictive
    return false;
  };

  const canUserManageGuardian = () => {
    // Check if user is a guardian by looking at the guardians array
    if (!electionData?.guardians) return false;

    // Find if current user's email matches any guardian's email
    // We look for the guardian marked as current user OR match by email if available
    const currentUserIsGuardian = electionData.guardians.some(guardian =>
      guardian.isCurrentUser === true
    );

    return currentUserIsGuardian;
  };

  const canSubmitGuardianKey = () => {
    if (!canUserManageGuardian()) return { canSubmit: false, reason: 'Not a guardian' };

    const electionStatus = getElectionStatus();
    if (electionStatus !== 'Ended') {
      return { canSubmit: false, reason: 'Election has not ended yet' };
    }

    const currentGuardian = electionData?.guardians?.find(g => g.isCurrentUser);
    if (!currentGuardian) {
      return { canSubmit: false, reason: 'Guardian information not found' };
    }

    if (currentGuardian.decryptedOrNot) {
      return { canSubmit: false, reason: 'Partial decryption already submitted' };
    }

    return { canSubmit: true, reason: 'Ready to submit credentials' };
  };

  const canUserViewVerification = () => {
    // Only show verification after results have been displayed to the user
    return canUserViewResults() && resultsData !== null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading election data...</p>
          {creatingTally && <p className="text-sm text-blue-600">Creating tally...</p>}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <FiAlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!electionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <FiInfo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Data</h2>
          <p className="text-gray-600">No election data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tally Creation Modal */}
      <TallyCreationModal
        isOpen={isTallyModalOpen}
        onClose={() => {
          setIsTallyModalOpen(false);
          // Refresh election data after tally creation
          if (electionData) {
            electionApi.getElectionById(id).then(setElectionData);
          }
        }}
        electionId={id}
        electionApi={electionApi}
      />

      {/* Decryption Progress Modal */}
      <DecryptionProgressModal
        isOpen={isDecryptionModalOpen}
        onClose={handleDecryptionModalClose}
        electionId={id}
        guardianName={currentGuardianName}
      />

      {/* Combine Progress Modal */}
      <CombineProgressModal
        isOpen={isCombineModalOpen}
        onClose={() => setIsCombineModalOpen(false)}
        electionId={id}
        onCombineComplete={handleCombineComplete}
      />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 sm:py-4 gap-3 sm:gap-0">
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">{electionData.electionTitle}</h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Election ID: {electionData.electionId}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap w-full sm:w-auto">
              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(getElectionStatus())}`}>
                {getElectionStatus()}
              </span>
              <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-600">
                <FiUser className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate max-w-[150px] sm:max-w-none">
                  {
                    (() => {
                      const roles = [...(electionData.userRoles || [])];
                      // Add voting eligibility info based on new eligibility field
                      if (canUserVoteInElection(electionData) && !roles.includes('voter')) {
                        if (electionData.eligibility === 'unlisted') {
                          roles.push('voter (open voting)');
                        } else {
                          roles.push('voter');
                        }
                      }
                      return roles.length > 0 ? roles.join(', ') : 'Viewer';
                    })()
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
            <nav className="flex space-x-2 sm:space-x-4 md:space-x-8 pb-px min-w-max">
              {subMenus.map((menu) => {
              const Icon = menu.icon;
              return (
                <button
                  key={menu.key}
                  onClick={() => handleTabClick(menu.key)}
                  className={`flex items-center space-x-1 sm:space-x-2 py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
                    activeTab === menu.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">{menu.name}</span>
                  <span className="inline xs:hidden sm:hidden">{menu.name.split(' ')[0]}</span>
                </button>
              );
            })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Election Info Tab */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* Election Timer */}
            <ElectionTimer
              startTime={electionData.startingTime}
              endTime={electionData.endingTime}
              status={getElectionStatus()}
            />

            {/* Election Details Card */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
                <FiInfo className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Election Details
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Title:</span> {electionData.electionTitle}</p>
                    <p><span className="font-medium">Description:</span> {electionData.electionDescription || 'No description provided'}</p>
                    <p><span className="font-medium">Status:</span> {electionData.status}</p>
                    <p><span className="font-medium">Privacy:</span> {electionData.isPublic ? 'Public' : 'Private'}</p>
                    <p><span className="font-medium">Voting Eligibility:</span> {electionData.eligibility === 'listed' ? 'Listed voters only' : 'Open to anyone'}</p>
                    <p><span className="font-medium">Admin:</span> {electionData.adminName ? `${electionData.adminName} (${electionData.adminEmail})` : electionData.adminEmail}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center"><FiCalendar className="h-4 w-4 mr-2" /><span className="font-medium">Starts:</span> {formatDate(electionData.startingTime)}</p>
                    <p className="flex items-center"><FiCalendar className="h-4 w-4 mr-2" /><span className="font-medium">Ends:</span> {formatDate(electionData.endingTime)}</p>
                    <p className="flex items-center"><FiClock className="h-4 w-4 mr-2" /><span className="font-medium">Created:</span> {formatDate(electionData.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Election Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <FiUsers className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Voters</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{electionData.voters?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <FiShield className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Guardians</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{electionData.guardians?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <FiCheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Candidates</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{electionData.electionChoices?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Candidates */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Candidates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {electionData.electionChoices?.map((choice) => (
                  <div key={choice.choiceId} className="border rounded-lg p-3 sm:p-4">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      {choice.candidatePic && (
                        <img src={choice.candidatePic} alt={choice.optionTitle} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">{choice.optionTitle}</h4>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{choice.partyName}</p>
                        <p className="text-xs sm:text-sm text-gray-500 line-clamp-2">{choice.optionDescription}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Voting Booth Tab */}
        {activeTab === 'voting' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
              <FiCheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Voting Booth
            </h3>

            {/* Eligibility Loading */}
            {checkingEligibility && (
              <div className="text-center py-8">
                <FiLoader className="h-8 w-8 text-blue-500 mx-auto mb-4 animate-spin" />
                <p className="text-gray-600">Checking your eligibility to vote...</p>
              </div>
            )}

            {/* Eligibility Status Display */}
            {!checkingEligibility && eligibilityData && (
              <div className={`border rounded-lg p-4 mb-6 ${eligibilityData.eligible
                  ? 'bg-green-50 border-green-200'
                  : eligibilityData.hasVoted
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-center">
                  {eligibilityData.eligible ? (
                    <FiCheckCircle className="h-6 w-6 text-green-500 mr-3" />
                  ) : eligibilityData.hasVoted ? (
                    <FiCheckCircle className="h-6 w-6 text-blue-500 mr-3" />
                  ) : (
                    <FiAlertCircle className="h-6 w-6 text-red-500 mr-3" />
                  )}
                  <div>
                    <h4 className={`font-semibold ${eligibilityData.eligible
                        ? 'text-green-900'
                        : eligibilityData.hasVoted
                          ? 'text-blue-900'
                          : 'text-red-900'
                      }`}>
                      {eligibilityData.message}
                    </h4>
                    <p className={`text-sm ${eligibilityData.eligible
                        ? 'text-green-800'
                        : eligibilityData.hasVoted
                          ? 'text-blue-800'
                          : 'text-red-800'
                      }`}>
                      Status: {eligibilityData.electionStatus} |
                      Reason: {eligibilityData.reason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bot Detection Status */}
            {activeTab === 'voting' && (
              <div className={`border rounded-lg p-4 mb-6 ${botDetection.loading
                  ? 'bg-gray-50 border-gray-200'
                  : botDetection.error
                    ? 'bg-yellow-50 border-yellow-200'
                    : botDetection.isBot
                      ? 'bg-red-50 border-red-200'
                      : 'bg-green-50 border-green-200'
                }`}>
                <div className="flex items-center">
                  {botDetection.loading ? (
                    <FiLoader className="h-5 w-5 text-gray-500 mr-3 animate-spin" />
                  ) : botDetection.error ? (
                    <FiAlertCircle className="h-5 w-5 text-yellow-500 mr-3" />
                  ) : botDetection.isBot ? (
                    <FiX className="h-5 w-5 text-red-500 mr-3" />
                  ) : (
                    <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  )}
                  <div>
                    <h4 className={`font-medium ${botDetection.loading
                        ? 'text-gray-900'
                        : botDetection.error
                          ? 'text-yellow-900'
                          : botDetection.isBot
                            ? 'text-red-900'
                            : 'text-green-900'
                      }`}>
                      {botDetection.loading
                        ? 'Running Security Check...'
                        : botDetection.error
                          ? 'Security Check Warning'
                          : botDetection.isBot
                            ? 'Security Check Failed'
                            : 'Security Check Passed'
                      }
                    </h4>
                    <p className={`text-xs ${botDetection.loading
                        ? 'text-gray-600'
                        : botDetection.error
                          ? 'text-yellow-800'
                          : botDetection.isBot
                            ? 'text-red-800'
                            : 'text-green-800'
                      }`}>
                      {botDetection.loading
                        ? 'Verifying that you are not a bot...'
                        : botDetection.error
                          ? `Security check encountered an issue: ${botDetection.error}`
                          : botDetection.isBot
                            ? 'Automated access detected. Human verification required.'
                            : 'Human user verified. You may proceed with voting.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Vote Success Result */}
            {voteResult && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <div className="text-center">
                  <FiCheckCircle className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-blue-900 mb-2">Vote Cast Successfully!</h4>
                  <p className="text-blue-800 mb-4">Your vote has been securely recorded and encrypted.</p>

                  <div className="bg-white rounded-lg p-4 mb-4">
                    <h5 className="font-medium text-gray-900 mb-3">Important: Save Your Vote Details</h5>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">Vote Hash:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs">{voteResult.hashCode}</span>
                          <button
                            onClick={() => copyToClipboard(voteResult.hashCode)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <FiCopy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">Tracking Code:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs">{voteResult.trackingCode}</span>
                          <button
                            onClick={() => copyToClipboard(voteResult.trackingCode)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <FiCopy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex space-x-3">
                      <button
                        onClick={() => saveVoteDetails('txt')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                      >
                        <FiSave className="h-4 w-4" />
                        <span>Save as TXT</span>
                      </button>
                      <button
                        onClick={() => saveVoteDetails('json')}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
                      >
                        <FiFileText className="h-4 w-4" />
                        <span>Save as JSON</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-blue-700 bg-blue-100 p-3 rounded">
                    <p className="font-medium mb-1">⚠️ Important Notice:</p>
                    <p>Please save your vote hash and tracking code. You can use these to verify your vote was counted correctly when results are published.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Vote Error */}
            {voteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <FiAlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <div>
                    <h4 className="font-medium text-red-900">Vote Submission Failed</h4>
                    <p className="text-sm text-red-800 mt-1">{voteError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* All Available Choices (Always Shown) */}
            {!checkingEligibility && electionData?.electionChoices && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Election Candidates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {electionData.electionChoices.map((choice) => (
                    <div
                      key={choice.choiceId}
                      className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        {choice.candidatePic && (
                          <img
                            src={choice.candidatePic}
                            alt={choice.optionTitle}
                            className="h-16 w-16 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900 text-lg">{choice.optionTitle}</h5>
                          {choice.partyName && (
                            <p className="text-gray-600 font-medium">{choice.partyName}</p>
                          )}
                          {choice.optionDescription && (
                            <p className="text-sm text-gray-500 mt-1">{choice.optionDescription}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Voting Form - Only Enabled if Eligible and Bot Check Passed */}
            {!checkingEligibility && eligibilityData?.eligible && !voteResult && (
              <div className="max-w-2xl">
                {/* Show warning if bot detection is still loading or failed */}
                {(botDetection.loading || botDetection.isBot) && (
                  <div className={`border rounded-lg p-4 mb-6 ${botDetection.loading
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center">
                      {botDetection.loading ? (
                        <FiLoader className="h-5 w-5 text-blue-500 mr-3 animate-spin" />
                      ) : (
                        <FiAlertCircle className="h-5 w-5 text-red-500 mr-3" />
                      )}
                      <div>
                        <h4 className={`font-medium ${botDetection.loading ? 'text-blue-900' : 'text-red-900'
                          }`}>
                          {botDetection.loading
                            ? 'Please Wait - Security Check in Progress'
                            : 'Voting Blocked - Security Check Failed'
                          }
                        </h4>
                        <p className={`text-sm ${botDetection.loading ? 'text-blue-800' : 'text-red-800'
                          }`}>
                          {botDetection.loading
                            ? 'Voting will be enabled once the security check completes.'
                            : 'Automated access detected. Please refresh the page and try again.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <FiInfo className="h-5 w-5 text-yellow-600 mr-2" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Voting Instructions</h4>
                      <p className="text-sm text-yellow-800 mt-1">
                        Select one candidate from the list below and click "Create Encrypted Ballot" to generate your encrypted ballot files.
                        You can only vote once in this election.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleVoteSubmit}>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select your candidate:
                    </label>
                    <div className="space-y-3">
                      {electionData.electionChoices?.map((choice) => (
                        <div key={choice.choiceId} className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedCandidate === choice.choiceId.toString()
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}>
                          <input
                            type="radio"
                            id={choice.choiceId}
                            name="candidate"
                            value={choice.choiceId}
                            checked={selectedCandidate === choice.choiceId.toString()}
                            onChange={(e) => setSelectedCandidate(e.target.value)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <label htmlFor={choice.choiceId} className="ml-4 flex-1 cursor-pointer">
                            <div className="flex items-center space-x-4">
                              {choice.candidatePic && (
                                <img
                                  src={choice.candidatePic}
                                  alt={choice.optionTitle}
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              )}
                              <div>
                                <p className="font-medium text-gray-900 text-lg">{choice.optionTitle}</p>
                                {choice.partyName && (
                                  <p className="text-sm text-gray-600">{choice.partyName}</p>
                                )}
                                {choice.optionDescription && (
                                  <p className="text-sm text-gray-500 mt-1">{choice.optionDescription}</p>
                                )}
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="submit"
                      disabled={!selectedCandidate || isSubmitting || botDetection.loading || botDetection.isBot}
                      className={`px-8 py-3 rounded-lg font-medium text-white transition-colors ${!selectedCandidate || isSubmitting || botDetection.loading || botDetection.isBot
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                        }`}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center space-x-2">
                          <FiLoader className="h-4 w-4 animate-spin" />
                          <span>Creating Ballot...</span>
                        </div>
                      ) : botDetection.loading ? (
                        <div className="flex items-center space-x-2">
                          <FiLoader className="h-4 w-4 animate-spin" />
                          <span>Security Check...</span>
                        </div>
                      ) : botDetection.isBot ? (
                        <div className="flex items-center space-x-2">
                          <FiX className="h-4 w-4" />
                          <span>Voting Blocked</span>
                        </div>
                      ) : (
                        'Create Encrypted Ballot'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Encrypted Ballot Actions - Show after encrypted ballot is created */}
            {showBallotActions && encryptedBallotData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <div className="text-center mb-6">
                  <FiCheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-700 mb-2">
                    Encrypted Ballot Created Successfully!
                  </h3>
                  <p className="text-green-600 mb-4">
                    Your vote has been encrypted and is ready. You can now download the ballot files and choose to either cast your vote or challenge it for verification.
                  </p>
                </div>

                {/* Download Files Section */}
                <div className="bg-white rounded-lg p-4 mb-6 border">
                  <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                    <FiDownload className="mr-2" />
                    Download Ballot Files
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Encrypted Ballot */}
                    <button
                      onClick={() => downloadFile(encryptedBallotData.encrypted_ballot, 'encrypted_ballot.txt', 'Encrypted Ballot')}
                      className="flex items-center justify-center p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <FiFileText className="mr-2 text-blue-600" />
                      <span className="text-blue-700 font-medium">Encrypted Ballot</span>
                    </button>

                    {/* Encrypted Ballot with Nonce */}
                    <button
                      onClick={() => downloadFile(encryptedBallotData.encrypted_ballot_with_nonce, 'encrypted_ballot_with_nonce.txt', 'Encrypted Ballot with Nonce')}
                      className="flex items-center justify-center p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <FiKey className="mr-2 text-purple-600" />
                      <span className="text-purple-700 font-medium">Ballot with Nonce</span>
                    </button>

                    {/* Ballot Info */}
                    <button
                      onClick={() => downloadBallotInfo()}
                      className="flex items-center justify-center p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <FiInfo className="mr-2 text-gray-600" />
                      <span className="text-gray-700 font-medium">Ballot Info</span>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => handleCastEncryptedBallot()}
                    disabled={isCasting || ballotChallenged}
                    className={`flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors ${
                      ballotChallenged 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isCasting
                          ? 'bg-blue-400 text-white cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCasting ? (
                      <>
                        <FiLoader className="mr-2 h-4 w-4 animate-spin" />
                        Casting Vote...
                      </>
                    ) : (
                      <>
                        <FiCheck className="mr-2 h-4 w-4" />
                        Cast Vote
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleBenalohChallenge()}
                    disabled={isChallenging || ballotChallenged}
                    className={`flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors ${
                      ballotChallenged
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isChallenging
                          ? 'bg-orange-400 text-white cursor-not-allowed'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    {isChallenging ? (
                      <>
                        <FiLoader className="mr-2 h-4 w-4 animate-spin" />
                        Challenging...
                      </>
                    ) : (
                      <>
                        <FiShield className="mr-2 h-4 w-4" />
                        Challenge Vote
                      </>
                    )}
                  </button>
                </div>

                {ballotChallenged && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-700 text-sm text-center">
                      <FiAlertCircle className="inline mr-1" />
                      This ballot has been challenged and cannot be cast. Please create a new ballot to vote.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Challenge Result Display */}
            {challengeResult && (
              <div className={`border rounded-lg p-6 mb-6 ${
                challengeResult.match ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                    challengeResult.match ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {challengeResult.match ? (
                      <FiCheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <FiX className="w-8 h-8 text-red-600" />
                    )}
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${
                    challengeResult.match ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {challengeResult.match ? 'Challenge Verification Passed!' : 'Challenge Verification Failed!'}
                  </h3>
                  <p className={`mb-4 ${
                    challengeResult.match ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {challengeResult.message}
                  </p>
                  {challengeResult.detailed_message && (
                    <div className="text-sm text-gray-600 bg-white rounded-lg p-3 border">
                      {challengeResult.detailed_message}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Voting Not Available - Show when not eligible and not already voted */}
            {!checkingEligibility && eligibilityData && !eligibilityData.eligible && !eligibilityData.hasVoted && (
              <div className="text-center py-8">
                <FiAlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Voting Not Available</h4>
                <p className="text-gray-600 mb-4">{eligibilityData.message}</p>
                {eligibilityData.reason === 'Election not active' && eligibilityData.electionStatus === 'Not Started' && (
                  <p className="text-sm text-gray-500">
                    Voting starts: {formatDate(electionData.startingTime)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Vote Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Confirm Your Vote</h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              <div className="mb-4 sm:mb-6">
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                  You are about to cast your vote for:
                </p>
                {(() => {
                  const selectedChoice = electionData.electionChoices.find(
                    choice => choice.choiceId.toString() === selectedCandidate
                  );
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        {selectedChoice?.candidatePic && (
                          <img
                            src={selectedChoice.candidatePic}
                            alt={selectedChoice.optionTitle}
                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-blue-900 text-sm sm:text-base">{selectedChoice?.optionTitle}</p>
                          {selectedChoice?.partyName && (
                            <p className="text-xs sm:text-sm text-blue-700">{selectedChoice.partyName}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-3 sm:mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-yellow-800">
                    <strong>Warning:</strong> This action cannot be undone. You will not be able to change your vote after submission.
                  </p>
                </div>
              </div>

              <div className="flex space-x-2 sm:space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-3 sm:px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmVote}
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm sm:text-base"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FiLoader className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    'Confirm Vote'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Benaloh Challenge Modal */}
        {showChallengeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
                <FiShield className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Challenge Ballot Verification
              </h3>
              
              <div className="mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                  Select the candidate you want to verify against your encrypted ballot. 
                  This will check if your ballot was encrypted with the correct choice.
                </p>
                
                <div className="space-y-2 sm:space-y-3">
                  {electionData && electionData.electionChoices && electionData.electionChoices.map((choice) => (
                    <div 
                      key={choice.choiceId} 
                      className={`flex items-center p-2 sm:p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        challengeCandidateChoice === choice.choiceId.toString()
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setChallengeCandidateChoice(choice.choiceId.toString())}
                    >
                      <input
                        type="radio"
                        name="challengeCandidate"
                        value={choice.choiceId.toString()}
                        checked={challengeCandidateChoice === choice.choiceId.toString()}
                        onChange={(e) => setChallengeCandidateChoice(e.target.value)}
                        className="mr-2 sm:mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{choice.optionTitle}</div>
                        <div className="text-xs sm:text-sm text-gray-500 truncate">{choice.partyName}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <FiAlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-xs sm:text-sm text-yellow-800">
                      <strong>Important:</strong> After challenging your ballot, it cannot be cast. 
                      Challenge is only for verification purposes.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 sm:space-x-3">
                <button
                  onClick={() => {
                    setShowChallengeModal(false);
                    setChallengeCandidateChoice('');
                  }}
                  disabled={isChallenging}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-3 sm:px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmChallenge}
                  disabled={!challengeCandidateChoice || isChallenging}
                  className={`flex-1 py-2 px-3 sm:px-4 rounded-lg font-medium text-white transition-colors text-sm sm:text-base ${
                    !challengeCandidateChoice || isChallenging
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {isChallenging ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FiLoader className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                      <span>Challenging...</span>
                    </div>
                  ) : (
                    'Challenge Ballot'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guardian Keys Tab */}
        {activeTab === 'guardian' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
              <FiShield className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Guardian Credential Submission
            </h3>
            {!canUserManageGuardian() ? (
              <div className="text-center py-8">
                <FiShield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Guardian Access Required</h4>
                <p className="text-gray-600">You need guardian privileges to access this section.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Tally Creation Section - Only show if election has ended */}
                {electionData && new Date(electionData.endingTime) < new Date() && (
                  <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-blue-900 mb-2">Step 1: Create Encrypted Tally</h4>
                        <p className="text-sm text-blue-800">
                          Before guardians can submit their keys, the encrypted tally must be created from all cast ballots.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsTallyModalOpen(true)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <FiRefreshCw className="h-5 w-5" />
                      <span>Create/Check Tally Status</span>
                    </button>
                  </div>
                )}

                {/* Guardian Key Submission Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Election Information</h4>
                    <p className="text-sm text-blue-800">
                      Status: {getElectionStatus()} |
                      Required Guardians: {electionData.numberOfGuardians} |
                      Quorum: {electionData.electionQuorum}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Step 2: Decryption Status</h4>
                    <p className="text-sm text-green-800">
                      {electionData.guardiansSubmitted || 0} of {electionData.totalGuardians || 0} guardians have submitted keys
                    </p>
                  </div>
                </div>

                {/* Active Decryption Process Banner */}
                {guardianDecryptionStatus && 
                 (guardianDecryptionStatus.status === 'in_progress' || guardianDecryptionStatus.status === 'pending') && (
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-4 shadow-lg animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <div>
                          <p className="font-bold text-lg">🔄 Your Decryption is in Progress</p>
                          <p className="text-sm text-blue-100">
                            Processing your guardian credentials... Click below to view real-time progress
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsDecryptionModalOpen(true)}
                        className="px-6 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-all shadow-md flex items-center space-x-2"
                      >
                        <FiEye className="h-5 w-5" />
                        <span>View Progress</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Key Submission Form */}
                {(() => {
                  const submitStatus = canSubmitGuardianKey();

                  if (submitStatus.canSubmit) {
                    return (
                      <div className="border border-green-200 rounded-lg p-6">
                        <h4 className="font-medium text-green-900 mb-4 flex items-center">
                          <FiKey className="h-5 w-5 mr-2" />
                          Submit Your Guardian Credentials
                        </h4>

                        {/* Check Status Button - Always visible if guardian has any decryption status */}
                        {(() => {
                          // Show if guardian has any status
                          const hasStatus = guardianDecryptionStatus && 
                            (guardianDecryptionStatus.status === 'in_progress' || 
                             guardianDecryptionStatus.status === 'pending' ||
                             guardianDecryptionStatus.status === 'completed' ||
                             guardianDecryptionStatus.status === 'failed');
                          
                          if (hasStatus) {
                            const statusText = guardianDecryptionStatus?.status === 'completed' 
                              ? 'Your decryption has been completed successfully!'
                              : guardianDecryptionStatus?.status === 'in_progress'
                              ? 'Your credentials are being processed...'
                              : guardianDecryptionStatus?.status === 'pending'
                              ? 'Your decryption is pending...'
                              : guardianDecryptionStatus?.status === 'failed'
                              ? '❌ Decryption failed. Click to view details and retry with correct credentials.'
                              : 'Click below to check your decryption progress.';
                            
                            const bgColor = guardianDecryptionStatus?.status === 'failed'
                              ? 'bg-red-50 border-red-200'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'bg-green-50 border-green-200'
                              : 'bg-blue-50 border-blue-200';
                            
                            const titleColor = guardianDecryptionStatus?.status === 'failed'
                              ? 'text-red-900'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'text-green-900'
                              : 'text-blue-900';
                            
                            const textColor = guardianDecryptionStatus?.status === 'failed'
                              ? 'text-red-800'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'text-green-800'
                              : 'text-blue-800';
                            
                            const buttonColor = guardianDecryptionStatus?.status === 'failed'
                              ? 'bg-red-600 hover:bg-red-700'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-blue-600 hover:bg-blue-700';
                            
                            const icon = guardianDecryptionStatus?.status === 'failed'
                              ? <FiAlertCircle className="h-5 w-5 text-red-500 mr-2" />
                              : guardianDecryptionStatus?.status === 'completed'
                              ? <FiCheckCircle className="h-5 w-5 text-green-500 mr-2" />
                              : <FiRefreshCw className="h-5 w-5 text-blue-500 mr-2" />;
                            
                            const title = guardianDecryptionStatus?.status === 'failed'
                              ? 'Decryption Failed - Action Required'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'Decryption Completed'
                              : 'Decryption In Progress';
                            
                            return (
                              <div className={`${bgColor} border rounded-lg p-4 mb-4`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center flex-1">
                                    {icon}
                                    <div>
                                      <h5 className={`font-medium ${titleColor}`}>{title}</h5>
                                      <p className={`text-sm ${textColor} mt-1`}>
                                        {statusText}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={handleCheckDecryptionStatus}
                                    disabled={isCheckingStatus}
                                    className={`px-4 py-2 ${buttonColor} text-white rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:bg-gray-400 ml-4`}
                                  >
                                    {isCheckingStatus ? (
                                      <>
                                        <FiLoader className="h-4 w-4 animate-spin" />
                                        <span>Loading...</span>
                                      </>
                                    ) : (
                                      <>
                                        <FiEye className="h-4 w-4" />
                                        <span>
                                          {guardianDecryptionStatus?.status === 'failed' 
                                            ? 'View Error & Retry'
                                            : guardianDecryptionStatus?.status === 'completed'
                                            ? 'View Details'
                                            : 'Check Progress'}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {keySubmissionResult && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center">
                              <FiCheckCircle className="h-5 w-5 text-green-500 mr-2" />
                              <div>
                                <h5 className="font-medium text-green-900">Credentials Received!</h5>
                                <p className="text-sm text-green-800 mt-1">
                                  {keySubmissionResult.message || "Your credentials have been received. Decryption processing has started. Use the 'Check Progress' button above to monitor status."}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {keySubmissionError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center">
                              <FiAlertCircle className="h-5 w-5 text-red-500 mr-2" />
                              <div>
                                <h5 className="font-medium text-red-900">Credential Submission Failed</h5>
                                <p className="text-sm text-red-800 mt-1">{keySubmissionError}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <form onSubmit={handleGuardianKeySubmit} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Guardian Credential File
                            </label>
                            <input
                              type="file"
                              accept=".txt"
                              onChange={handleCredentialFileChange}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                              required
                            />
                            <p className="text-sm text-gray-600 mt-1">
                              Upload the credentials.txt file that was sent to you via email after guardian assignment.
                            </p>
                            {guardianKey && (
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                                <p className="text-sm text-green-800">✓ Credential file loaded successfully</p>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-center">
                            {(() => {
                              const isCompleted = guardianDecryptionStatus?.status === 'completed';
                              const isInProgress = guardianDecryptionStatus?.status === 'in_progress' || guardianDecryptionStatus?.status === 'pending';
                              const isFailed = guardianDecryptionStatus?.status === 'failed';
                              const isDisabled = !guardianKey.trim() || isSubmittingKey || isCompleted || isInProgress;
                              
                              return (
                                <button
                                  type="submit"
                                  disabled={isDisabled}
                                  className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                                    isCompleted
                                      ? 'bg-green-500 cursor-not-allowed'
                                      : isInProgress
                                      ? 'bg-blue-500 cursor-not-allowed'
                                      : isFailed
                                      ? 'bg-orange-600 hover:bg-orange-700'
                                      : isDisabled
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-green-600 hover:bg-green-700'
                                  }`}
                                >
                                  {isCompleted ? (
                                    <div className="flex items-center space-x-2">
                                      <FiCheckCircle className="h-4 w-4" />
                                      <span>✅ Decryption Completed</span>
                                    </div>
                                  ) : isInProgress ? (
                                    <div className="flex items-center space-x-2">
                                      <FiLoader className="h-4 w-4 animate-spin" />
                                      <span>Processing... Check Progress Above</span>
                                    </div>
                                  ) : isSubmittingKey ? (
                                    <div className="flex items-center space-x-2">
                                      <FiLoader className="h-4 w-4 animate-spin" />
                                      <span>Validating Credentials...</span>
                                    </div>
                                  ) : isFailed ? (
                                    <div className="flex items-center space-x-2">
                                      <FiRefreshCw className="h-4 w-4" />
                                      <span>🔄 Retry with Correct Credentials</span>
                                    </div>
                                  ) : (
                                    'Submit Guardian Credentials'
                                  )}
                                </button>
                              );
                            })()}
                          </div>
                        </form>
                      </div>
                    );
                  } else {
                    return (
                      <div className="border border-yellow-200 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <FiAlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                          <h4 className="font-medium text-yellow-900">Key Submission Not Available</h4>
                        </div>
                        <p className="text-yellow-800 mb-4">{submitStatus.reason}</p>

                        {submitStatus.reason === 'Election has not ended yet' && (
                          <p className="text-sm text-yellow-700">
                            You will be able to submit your guardian key after the election ends on {formatDate(electionData.endingTime)}.
                          </p>
                        )}

                        {submitStatus.reason === 'Partial decryption already submitted' && (
                          <div className="bg-green-50 border border-green-200 rounded p-3">
                            <p className="text-sm text-green-800">
                              ✅ Your partial decryption has already been successfully submitted.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }
                })()}

                {/* Guardian List */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Guardian Status</h4>

                  {/* Guardian Progress Summary */}
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Partial Decryption Progress:</span>
                      <span className="font-medium text-gray-900">
                        {electionData.guardiansSubmitted || 0} of {electionData.totalGuardians || 0} guardians submitted
                      </span>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${electionData.totalGuardians > 0 ? ((electionData.guardiansSubmitted || 0) / electionData.totalGuardians) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                    {(() => {
                      const guardiansSubmitted = electionData.guardiansSubmitted || 0;
                      const totalGuardians = electionData.totalGuardians || 0;
                      const electionQuorum = electionData.electionQuorum || totalGuardians || 0;
                      const quorumMet = guardiansSubmitted >= electionQuorum;
                      const allGuardiansSubmitted = guardiansSubmitted >= totalGuardians && totalGuardians > 0;

                      if (allGuardiansSubmitted) {
                        return (
                          <div className="mt-2 flex items-center text-green-600">
                            <FiCheck className="h-4 w-4 mr-1" />
                            <span className="text-sm font-medium">All guardians have submitted their keys ({guardiansSubmitted}/{totalGuardians})</span>
                          </div>
                        );
                      } else if (quorumMet) {
                        return (
                          <div className="mt-2 flex items-center text-blue-600">
                            <FiCheck className="h-4 w-4 mr-1" />
                            <span className="text-sm font-medium">Quorum met! Ready to decrypt ({guardiansSubmitted}/{electionQuorum} required)</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="space-y-2">
                    {electionData.guardians?.map((guardian) => (
                      <div key={guardian.userEmail} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FiUser className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{guardian.userName}</p>
                            <p className="text-sm text-gray-600">{guardian.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-600">Order: {guardian.sequenceOrder}</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${guardian.decryptedOrNot ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {guardian.decryptedOrNot ? 'Key Submitted' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
              <FiTrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Election Results
            </h3>
            {!canUserViewResults() ? (
              <div className="text-center py-8">
                <FiTrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Results Not Available</h4>
                <p className="text-gray-600">
                  Results will be available after the election ends or if you have administrative privileges.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {loadingResults && (
                  <div className="text-center py-8">
                    <FiLoader className="h-8 w-8 text-blue-500 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-600">Loading election results...</p>
                  </div>
                )}

                {combiningDecryptions && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <FiLoader className="h-5 w-5 text-blue-500 mr-2 animate-spin" />
                      <div>
                        <h4 className="font-medium text-blue-900">Combining Partial Decryptions</h4>
                        <p className="text-sm text-blue-800">Processing guardian keys to decrypt final results...</p>
                      </div>
                    </div>
                  </div>
                )}

                {(() => {
                  // Use resultsData if available, otherwise process from rawVerificationData
                  const processedResults = resultsData || processElectionResults();
                  
                  console.log('📊 [Results Tab] Rendering with data:', {
                    hasResultsData: !!resultsData,
                    hasRawVerificationData: !!rawVerificationData,
                    processedResults,
                    animatedResults: animatedResults?.results?.finalTallies
                  });
                  
                  if (!processedResults) {
                    console.warn('⚠️ [Results Tab] No processed results available');
                    return null;
                  }

                  const totalBallots = processedResults.totalVotedUsers;
                  const totalVotesInChoices = processedResults.totalVotes;
                  const needsDecryption = totalVotesInChoices !== totalBallots && totalBallots > 0;

                  // ✅ Fixed: Check if quorum is met instead of requiring all guardians
                  const guardiansSubmitted = electionData.guardiansSubmitted || 0;
                  const electionQuorum = electionData.electionQuorum || electionData.totalGuardians || 0;
                  const quorumMet = guardiansSubmitted >= electionQuorum;

                  return (
                    <>
                      {needsDecryption && !quorumMet && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                          <div className="flex items-center">
                            <FiAlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                            <div>
                              <h4 className="font-medium text-yellow-900">Waiting for Guardian Keys</h4>
                              <p className="text-sm text-yellow-800">
                                Final results are not yet available. Need at least {electionQuorum} guardians to submit their partial decryption keys.
                                ({guardiansSubmitted} of {electionQuorum} required submitted)
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {needsDecryption && quorumMet && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                          <div className="text-center">
                            <FiKey className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                            <h4 className="font-medium text-blue-900 mb-2">Ready to Combine Decryptions</h4>
                            <p className="text-sm text-blue-800 mb-4">
                              ✅ Quorum met! {guardiansSubmitted} of {electionQuorum} required guardians have submitted their keys.
                              Click below to combine and decrypt final results.
                            </p>
                            <div className="space-x-4">
                              <button
                                onClick={handleInitiateCombine}
                                disabled={combiningDecryptions}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                              >
                                {combiningDecryptions ? 'Combining...' : 'Combine Partial Decryptions'}
                              </button>
                              <button
                                onClick={handleCheckCombineStatus}
                                disabled={combiningDecryptions}
                                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
                              >
                                <FiRefreshCw className="inline h-4 w-4 mr-2" />
                                Check Status
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Animated Results Component */}
                      {animatedResults && (
                        <div className="mb-6">
                          <AnimatedResults electionResults={animatedResults} />
                        </div>
                      )}

                      {/* Results Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6">
                        <div className="p-3 sm:p-4 bg-blue-50 rounded-lg text-center">
                          <h4 className="font-medium text-blue-900 mb-1 sm:mb-2 text-xs sm:text-sm">Total Votes Cast</h4>
                          <p className="text-xl sm:text-2xl font-bold text-blue-800">{processedResults.totalVotes}</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-green-50 rounded-lg text-center">
                          <h4 className="font-medium text-green-900 mb-1 sm:mb-2 text-xs sm:text-sm">Eligible Voters</h4>
                          <p className="text-xl sm:text-2xl font-bold text-green-800">{processedResults.totalEligibleVoters}</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-purple-50 rounded-lg text-center">
                          <h4 className="font-medium text-purple-900 mb-1 sm:mb-2 text-xs sm:text-sm">Voter Turnout</h4>
                          <p className="text-xl sm:text-2xl font-bold text-purple-800">{processedResults.turnoutRate}%</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-orange-50 rounded-lg text-center">
                          <h4 className="font-medium text-orange-900 mb-1 sm:mb-2 text-xs sm:text-sm">Total Candidates</h4>
                          <p className="text-xl sm:text-2xl font-bold text-orange-800">{processedResults.choices.length}</p>
                        </div>
                      </div>

                      {/* Download Options */}
                      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6">
                        <button
                          onClick={downloadResultsPDF}
                          className="flex items-center space-x-1 sm:space-x-2 bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 text-xs sm:text-sm"
                        >
                          <FiDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={downloadResultsCSV}
                          className="flex items-center space-x-1 sm:space-x-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 text-xs sm:text-sm"
                        >
                          <FiDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>CSV</span>
                        </button>
                      </div>

                      {/* Charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-6">
                        {/* Bar Chart */}
                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                          <h4 className="font-medium text-gray-900 mb-3 sm:mb-4 flex items-center text-sm sm:text-base">
                            <FiBarChart className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Vote Distribution
                          </h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={processedResults.chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="votes" fill="#3B82F6" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Pie Chart */}
                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                          <h4 className="font-medium text-gray-900 mb-3 sm:mb-4 flex items-center text-sm sm:text-base">
                            <FiPieChart className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Vote Share
                          </h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={processedResults.chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percentage }) => `${name}: ${percentage}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="votes"
                              >
                                {processedResults.chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Detailed Results Table */}
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                        <h4 className="font-medium text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Detailed Results</h4>
                        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                          <table className="w-full border-collapse min-w-[500px]">
                            <thead>
                              <tr className="border-b-2 border-gray-300">
                                <th className="text-left p-3 font-medium text-gray-900">Rank</th>
                                <th className="text-left p-3 font-medium text-gray-900">Candidate</th>
                                <th className="text-left p-3 font-medium text-gray-900">Party</th>
                                <th className="text-left p-3 font-medium text-gray-900">Votes</th>
                                <th className="text-left p-3 font-medium text-gray-900">Percentage</th>
                                <th className="text-left p-3 font-medium text-gray-900">Visual</th>
                              </tr>
                            </thead>
                            <tbody>
                              {processedResults.chartData
                                .sort((a, b) => b.votes - a.votes)
                                .map((candidate, index) => (
                                  <tr key={candidate.name} className="border-b border-gray-200 hover:bg-gray-100">
                                    <td className="p-3">
                                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${index === 0 ? 'bg-gold-100 text-gold-800' :
                                          index === 1 ? 'bg-silver-100 text-gray-700' :
                                            index === 2 ? 'bg-bronze-100 text-orange-700' :
                                              'bg-gray-100 text-gray-600'
                                        }`}>
                                        #{index + 1}
                                      </span>
                                    </td>
                                    <td className="p-3 font-medium text-gray-900">{candidate.name}</td>
                                    <td className="p-3 text-gray-600">{candidate.party || 'Independent'}</td>
                                    <td className="p-3 font-semibold text-gray-900">{candidate.votes}</td>
                                    <td className="p-3 text-gray-900">{candidate.percentage}%</td>
                                    <td className="p-3">
                                      <div className="w-20 bg-gray-200 rounded-full h-2">
                                        <div
                                          className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                                          style={{ width: `${candidate.percentage}%` }}
                                        ></div>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Chunk Breakdown Section - Modern UI */}
                      {animatedResults && animatedResults.results && animatedResults.results.chunks && animatedResults.results.chunks.length > 0 && (
                        <div className="mt-8">
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                            <div className="flex items-center justify-between mb-6">
                              <div>
                                <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                  Processing Chunk Breakdown
                                </h4>
                                <p className="text-sm text-gray-600 mt-1">
                                  Detailed view of vote distribution across {animatedResults.results.chunks.length} processing chunks
                                </p>
                              </div>
                              <span className="px-4 py-2 bg-white rounded-full text-sm font-semibold text-purple-600 shadow-sm">
                                {animatedResults.results.chunks.length} Chunks
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {animatedResults.results.chunks.map((chunk, index) => (
                                <div 
                                  key={chunk.electionCenterId}
                                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-200"
                                >
                                  {/* Chunk Header */}
                                  <div className="bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="font-bold text-white text-lg">
                                        Chunk #{chunk.chunkIndex}
                                      </h5>
                                      <span className="px-2 py-1 bg-white bg-opacity-20 rounded-full text-xs font-medium text-white">
                                        ID: {chunk.electionCenterId}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Chunk Body */}
                                  <div className="p-4">
                                    {/* Ballot Count */}
                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <span className="text-sm font-medium text-gray-700">
                                        {chunk.ballotCount || 0} Ballots Processed
                                      </span>
                                    </div>

                                    {/* Vote Distribution */}
                                    <div className="space-y-3">
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vote Distribution</p>
                                      {Object.entries(chunk.candidateVotes || {}).map(([candidate, voteData]) => {
                                        let votes = 0;
                                        if (typeof voteData === 'number') {
                                          votes = voteData;
                                        } else if (typeof voteData === 'object' && voteData.votes) {
                                          votes = typeof voteData.votes === 'string' ? parseInt(voteData.votes) : voteData.votes;
                                        } else if (typeof voteData === 'string') {
                                          votes = parseInt(voteData);
                                        }

                                        const maxVotesInChunk = Math.max(...Object.values(chunk.candidateVotes || {}).map(v => {
                                          if (typeof v === 'number') return v;
                                          if (typeof v === 'object' && v.votes) return typeof v.votes === 'string' ? parseInt(v.votes) : v.votes;
                                          if (typeof v === 'string') return parseInt(v);
                                          return 0;
                                        }));
                                        const percentage = maxVotesInChunk > 0 ? (votes / maxVotesInChunk) * 100 : 0;

                                        return (
                                          <div key={candidate} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                              <span className="font-medium text-gray-700 truncate">{candidate}</span>
                                              <span className="font-bold text-blue-600 ml-2">{votes}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                              <div
                                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                              ></div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Chunk Footer */}
                                  <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 text-center">
                                      Chunk {index + 1} of {animatedResults.results.chunks.length}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

              </div>
            )}
          </div>
        )}

        {/* Ballots in Tally Tab */}
        {activeTab === 'ballots' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            {!canUserViewVerification() ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiDatabase className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Ballots Not Available</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  Ballot information will be available after the election results have been computed.
                </p>
              </div>
            ) : loadingResults || combiningDecryptions ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiLoader className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  {combiningDecryptions ? '🔄 Combining Decryptions' : 'Loading Ballot Data'}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  {combiningDecryptions
                    ? 'Combining guardian keys to retrieve ballot hashes and tracking codes...'
                    : 'Retrieving ballot information from the election results...'
                  }
                </p>
              </div>
            ) : (() => {
              const ballots = rawVerificationData?.verification?.ballots || [];
              const guardiansSubmitted = electionData.guardiansSubmitted || 0;
              const electionQuorum = electionData.electionQuorum || electionData.totalGuardians || 0;
              const quorumMet = guardiansSubmitted >= electionQuorum;

              if (ballots.length === 0 && !quorumMet) {
                return (
                  <div className="text-center py-12">
                    <FiShield className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">⏳ Waiting for Guardians</h3>
                    <p className="text-gray-600 mb-4">
                      Not enough guardians have submitted their decryption keys yet.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 inline-block">
                      <p className="text-sm text-yellow-800">
                        <strong>Status:</strong> {guardiansSubmitted} of {electionQuorum} required guardians have submitted keys.
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  {/* Render the ballots in tally section */}
                  <ErrorBoundary
                    title="Error loading ballot tally"
                    message="There was a problem displaying the ballots. Please try refreshing the page."
                    showDetails={true}
                    onRetry={() => window.location.reload()}
                  >
                    <BallotsInTallySection
                      resultsData={rawVerificationData}
                      id={id}
                    />
                  </ErrorBoundary>
                </>
              );
            })()}
          </div>
        )}

        {/* Verify Your Vote Tab */}
        {activeTab === 'verify' && (
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            {!canUserViewVerification() ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiHash className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Vote Verification Not Available</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  Vote verification will be available after the election results have been computed.
                </p>
              </div>
            ) : combiningDecryptions ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiLoader className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-2">🔄 Combining Decryptions</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  Combining guardian keys to enable vote verification...
                </p>
              </div>
            ) : (() => {
              const ballots = rawVerificationData?.verification?.ballots || [];
              const guardiansSubmitted = electionData.guardiansSubmitted || 0;
              const electionQuorum = electionData.electionQuorum || electionData.totalGuardians || 0;
              const quorumMet = guardiansSubmitted >= electionQuorum;

              if (ballots.length === 0 && !quorumMet) {
                return (
                  <div className="text-center py-12">
                    <FiShield className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">⏳ Waiting for Guardians</h3>
                    <p className="text-gray-600 mb-4">
                      Vote verification requires ballot hashes, but not enough guardians have submitted their decryption keys yet.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 inline-block">
                      <p className="text-sm text-yellow-800">
                        <strong>Status:</strong> {guardiansSubmitted} of {electionQuorum} required guardians have submitted keys.
                      </p>
                    </div>
                  </div>
                );
              }

              return <VerifyVoteSection electionId={id} resultsData={rawVerificationData} />;
            })()}
          </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <VerificationTabContent 
            canUserViewVerification={canUserViewVerification}
            id={id}
            electionData={electionData}
            animatedResults={animatedResults}
          />
        )}

      </div>
    </div>
  );
}
