import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { electionApi } from '../utils/electionApi';
import { timezoneUtils } from '../utils/timezoneUtils';
import toast from 'react-hot-toast';
import VoterListEditor from '../components/VoterListEditor';
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
  FiChevronDown,
  FiActivity,
  FiChevronUp,
  FiSearch,
  FiMail,
  FiPlus
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
import { saveAs } from 'file-saver';
import { downloadJsonArtifact, decodeArtifactForDownload } from '../utils/artifactDownload';
import { generateElectionResultsPdf, truncateChartLabel } from '../utils/electionResultsPdf';
import { prepareElectionResultsCsvContent, escapeCsvField } from '../utils/electionResultsCsv';
import ErrorBoundary from '../components/ErrorBoundary';
import GuardianDataDisplay from '../components/GuardianDataDisplay';
import CompensatedDecryptionDisplay from '../components/CompensatedDecryptionDisplay';
import AnimatedResults from '../components/AnimatedResults';
import CandidateIdentity from '../components/CandidateIdentity';
import TruncatedCandidateName from '../components/TruncatedCandidateName';
import {
  buildCompetitionRankings,
  formatOrdinal,
  getCandidateDescription,
  getCandidatePic,
  isWinnerByRank,
} from '../utils/electionRankings';

const findChoiceByName = (choices, name) =>
  choices?.find((c) => c.optionTitle === name) || null;
import { getVoterFriendlyError, getGuardianKeyFriendlyError } from '../utils/voterMessages';
import { getAuthorizedUsersAccess } from '../utils/api';
import TallyCreationModal from '../components/TallyCreationModal';
import DecryptionProgressModal from '../components/DecryptionProgressModal';
import CombineProgressModal from '../components/CombineProgressModal';
import ElectionTimeline from '../components/ElectionTimeline';
import WorkerProceedings from '../components/WorkerProceedings';
import VoterStatusSlot from '../components/VoterStatusSlot';
import BallotWorkflowModal from '../components/BallotWorkflowModal';
import ModalOverlay, { ModalPanel } from '../components/ModalOverlay';
import GuardianQuorumViz from '../components/GuardianQuorumViz';
import VerifyVoteSection from '../components/VerifyVoteSection';
import GuardianProgressPanel from '../components/GuardianProgressPanel';
import ProcessProgressPanel from '../components/ProcessProgressPanel';
import ProcessControlPanel from '../components/ProcessControlPanel';
import ScheduledEmailTab from '../components/ScheduledEmailTab';
import KeyVerificationTab from '../components/KeyVerificationTab';
import ElectionTabNav from '../components/ElectionTabNav';
import useElectionProgressStream from '../hooks/useElectionProgressStream';
import {
  getSnapshotFromEvent,
  pickCombine,
  pickMyDecryption,
  pickTally,
} from '../utils/progressSnapshot';

const getTotalVoters = (data) => {
  if (!data) return 0;
  if (data.totalVoters != null) return data.totalVoters;
  return data.voters?.length || 0;
};

const getVotedCount = (data) => {
  if (!data) return 0;
  if (data.votedCount != null) return data.votedCount;
  return (data.voters || []).filter((v) => v.hasVoted).length;
};

const getWinnerCount = (electionData) => {
  if (!electionData) return 1;
  return electionData.winnerNo || electionData.maxChoices || 1;
};

const buildSummaryPayloadFromCachedResults = (animatedResultsData, electionData) => ({
  results: {
    finalTallies: animatedResultsData.results?.finalTallies,
    candidates: animatedResultsData.results?.finalTallies,
    chunks: animatedResultsData.results?.chunks,
    total_ballots_cast: animatedResultsData.results?.total_ballots_cast,
    total_valid_ballots: animatedResultsData.results?.total_valid_ballots,
    total_eligible_voters: getTotalVoters(electionData),
  },
});

const sortVotersVotedFirst = (voters) => {
  return [...(voters || [])].sort((a, b) => {
    if (a.hasVoted === b.hasVoted) {
      return (a.userEmail || '').localeCompare(b.userEmail || '');
    }
    return a.hasVoted ? -1 : 1;
  });
};

const subMenus = [
  { name: 'Election Info', shortName: 'Info', key: 'info', path: '', icon: FiInfo, hint: 'Schedule, candidates, and election details' },
  { name: 'Voting Booth', shortName: 'Vote', key: 'voting', path: 'voting-booth', icon: FiCheckCircle, hint: 'Cast your encrypted ballot' },
  { name: 'Guardian', shortName: 'Guardian', key: 'guardian', path: 'guardian', icon: FiShield, hint: 'Key ceremony, decryption, and combination' },
  { name: 'Key Verification', shortName: 'Keys', key: 'key-verification', path: 'key-verification', icon: FiKey, guardianOnly: true, hint: 'Verify your guardian credentials' },
  { name: 'Results', shortName: 'Results', key: 'results', path: 'results', icon: FiTrendingUp, hint: 'Tallied outcomes (available after combination)' },
  { name: 'Ballots in Tally', shortName: 'Ballots', key: 'ballots', path: 'ballots-in-tally', icon: FiDatabase, hint: 'Ballots included in the tally' },
  { name: 'Verify Your Vote', shortName: 'Verify', key: 'verify', path: 'verify-vote', icon: FiHash, hint: 'Confirm your ballot was recorded' },
  { name: 'Audit', shortName: 'Audit', key: 'verification', path: 'verification', icon: FiEye, hint: 'Public audit trail and proofs' },
  { name: 'Send Email', shortName: 'Email', key: 'send-email', path: 'send-email', icon: FiMail, adminOnly: true, hint: 'Notify voters and guardians' },
  { name: 'Worker Proceedings', shortName: 'Workers', key: 'worker-proceedings', path: 'worker-proceedings', icon: FiActivity, hint: 'Open processing telemetry for everyone' },
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
      if (!startTime || !endTime) {
        setTimeInfo({
          timeLeft: 'Election schedule not set yet',
          progress: 0,
          phase: 'upcoming'
        });
        return;
      }

      const now = new Date();
      const start = new Date(startTime);
      const end = new Date(endTime);
      const totalDuration = end - start;

      if (now < start) {
        const timeUntilStart = start - now;
        const days = Math.floor(timeUntilStart / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilStart % (1000 * 60)) / 1000);

        setTimeInfo({
          timeLeft: `${days}d ${hours}h ${minutes}m ${seconds}s until start`,
          progress: 0,
          phase: 'scheduled'
        });
      } else if (now > end) {
        setTimeInfo({
          timeLeft: 'Election has finished',
          progress: 100,
          phase: 'finished'
        });
      } else {
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
          phase: 'ongoing'
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
      case 'scheduled': return '#3b82f6';
      case 'ongoing': return '#10b981';
      case 'finished': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="surface-card p-5 sm:p-6">
      <h3 className="process-panel-title">
        <FiClock className="h-5 w-5 text-brand" />
        Election Timeline
      </h3>
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 shrink-0">
          <CircularProgressbar
            value={timeInfo.progress}
            text={`${Math.round(timeInfo.progress)}%`}
            styles={buildStyles({
              textColor: getProgressColor(),
              pathColor: getProgressColor(),
              trailColor: '#e2e8f0',
            })}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-xl sm:text-2xl font-bold text-deep">{timeInfo.timeLeft}</p>
          <p className="text-sm text-dusk capitalize">Status: {timeInfo.phase}</p>
          <div className="w-full bg-ink/10 rounded-full h-2 mt-2">
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

// Download-only row for verification artifacts (no inline preview)
const ArtifactDownloadRow = ({ title, data, downloadFilename }) => {
  const [downloading, setDownloading] = useState(false);
  const isAvailable = Boolean(
    data != null &&
    data !== 'Not available' &&
    data !== 'Error loading encrypted tally' &&
    (typeof data !== 'string' || data.trim() !== '')
  );

  const handleDownload = async () => {
    if (!isAvailable || downloading) return;
    const filename = downloadFilename || `${title.toLowerCase().replace(/\s+/g, '_')}.json`;
    setDownloading(true);
    try {
      await downloadJsonArtifact(filename, data);
    } catch {
      toast.error('Failed to prepare artifact download');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 border border-ink/10 rounded-lg p-4 bg-paper">
      <div className="min-w-0">
        <h4 className="font-medium text-deep">{title}</h4>
        <p className="text-sm text-dusk mt-1">
          {isAvailable ? 'Download to inspect this artifact locally' : 'Not available'}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!isAvailable || downloading}
        className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-paper bg-brand-dark hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {downloading ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <FiDownload className="h-4 w-4" />
        )}
        {downloading ? 'Preparing...' : 'Download'}
      </button>
    </div>
  );
};

// Constants for chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Modern Verification Tab Content Component
const VerificationTabContent = ({ canUserViewVerification, id, electionData }) => {
  const [verificationSubTab, setVerificationSubTab] = useState('overview');
  const [chunkCount, setChunkCount] = useState(0);

  useEffect(() => {
    if (!id || !canUserViewVerification()) return;

    electionApi.getElectionResults(id, { includeBallots: false, includeChunkCiphertext: false })
      .then((data) => {
        if (data?.success && data.results) {
          setChunkCount(data.results.totalChunks || data.results.chunks?.length || 0);
        }
      })
      .catch(() => {});
  }, [id, canUserViewVerification]);
  
  if (!canUserViewVerification()) {
    return (
      <div className="surface-card p-6">
        <div className="text-center py-12">
          <FiEye className="h-16 w-16 text-dusk-soft mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-deep mb-2">Verification Not Available</h3>
          <p className="text-dusk mb-4">
            Election verification will be available after the results have been displayed.
          </p>
          <div className="bg-glacier border border-brand/20 rounded-lg p-4 inline-block">
            <p className="text-sm text-ink">
              <strong>Why?</strong> Verification artifacts are only generated after the election results have been computed and displayed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const verificationTabs = [
    { id: 'overview', name: 'Overview', icon: FiEye },
    { id: 'timeline', name: 'Timeline', icon: FiClock },
    { id: 'guardians', name: 'Guardians', icon: FiShield },
    { id: 'chunks', name: 'Chunks & Tallies', icon: FiLayers },
    { id: 'compensated', name: 'Compensated Decryptions', icon: FiRefreshCw },
  ];

  return (
    <div className="surface-card">
      {/* Header with Stats */}
      <div className="border-b border-ink/10 bg-gradient-to-r from-glacier to-frost p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-deep flex items-center">
              <FiEye className="h-7 w-7 mr-3 text-brand" />
              Election Audit
            </h3>
            <p className="text-sm text-dusk mt-1">
              Cryptographic artifacts and public audit trail
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-paper rounded-lg p-3 shadow-sm border border-ink/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dusk uppercase tracking-wide">Guardians</p>
                <p className="text-2xl font-bold text-brand">{electionData.numberOfGuardians || electionData.guardians?.length || 0}</p>
              </div>
              <FiShield className="h-8 w-8 text-brand" />
            </div>
          </div>
          <div className="bg-paper rounded-lg p-3 shadow-sm border border-ink/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dusk uppercase tracking-wide">Chunks</p>
                <p className="text-2xl font-bold text-sage">
                  {chunkCount}
                </p>
              </div>
              <FiLayers className="h-8 w-8 text-aurora" />
            </div>
          </div>
          <div className="bg-paper rounded-lg p-3 shadow-sm border border-ink/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dusk uppercase tracking-wide">Artifacts</p>
                <p className="text-2xl font-bold text-brand-dark">
                  {[
                    electionData.jointPublicKey,
                    electionData.baseHash,
                    electionData.manifestHash
                  ].filter(Boolean).length}
                </p>
              </div>
              <FiKey className="h-8 w-8 text-brand-light" />
            </div>
          </div>
          <div className="bg-paper rounded-lg p-3 shadow-sm border border-ink/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dusk uppercase tracking-wide">Verification</p>
                <p className="text-2xl font-bold text-brand-dark">Ready</p>
              </div>
              <FiShield className="h-8 w-8 text-brand-light" />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-b border-ink/10 bg-frost">
        <div className="px-6 py-2">
          <div className="border border-ink/10 rounded-lg bg-paper overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
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
                    ? 'border-brand text-brand bg-paper'
                    : 'border-transparent text-dusk hover:text-deep hover:border-ink/10'
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
          <OverviewTabContent electionData={electionData} id={id} />
        )}

        {/* Timeline Tab */}
        {verificationSubTab === 'timeline' && (
          <ElectionTimeline electionId={id} electionData={electionData} />
        )}

        {/* Guardians Tab */}
        {verificationSubTab === 'guardians' && (
          <GuardianDataDisplay electionId={id} />
        )}

        {/* Chunks Tab */}
        {verificationSubTab === 'chunks' && (
          <ChunksTabContent electionId={id} />
        )}

        {/* Compensated Decryptions Tab */}
        {verificationSubTab === 'compensated' && (
          <CompensatedDecryptionDisplay electionId={id} />
        )}

      </div>
    </div>
  );
};

// Overview Tab Content
const OverviewTabContent = ({ electionData, id }) => {
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-glacier border border-brand/20 rounded-lg p-4">
        <div className="flex items-start">
          <FiInfo className="h-5 w-5 text-brand mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-deep mb-1">Cryptographic Verification</h4>
            <p className="text-sm text-ink">
              Download cryptographic artifacts below to independently verify the integrity of this election
              using ElectionGuard verification tools.
            </p>
          </div>
        </div>
      </div>

      {/* Core Cryptographic Artifacts */}
      <div className="bg-paper border border-ink/10 rounded-lg">
        <div className="border-b border-ink/10 bg-frost px-4 py-3">
          <h4 className="font-semibold text-deep flex items-center">
            <FiKey className="h-5 w-5 mr-2 text-brand" />
            Core Cryptographic Artifacts
          </h4>
        </div>
        <div className="p-4 space-y-4">
          <ArtifactDownloadRow
            title="Joint Public Key"
            data={electionData.jointPublicKey || "Not available"}
            downloadFilename={`joint_public_key_election_${id}.json`}
          />

          <ArtifactDownloadRow
            title="Commitment Hash"
            data={electionData.baseHash || "Not available"}
            downloadFilename={`commitment_hash_election_${id}.json`}
          />

          <ArtifactDownloadRow
            title="Election Manifest"
            data={electionData.manifestHash || "Not available"}
            downloadFilename={`election_manifest_election_${id}.json`}
          />

          {electionData.sampleEncryptedBallots && (
            <ArtifactDownloadRow
              title="Sample Encrypted Ballots"
              data={electionData.sampleEncryptedBallots}
              downloadFilename={`sample_encrypted_ballots_election_${id}.json`}
            />
          )}

          {electionData.cryptographicProofs && (
            <ArtifactDownloadRow
              title="Cryptographic Proofs"
              data={electionData.cryptographicProofs}
              downloadFilename={`cryptographic_proofs_election_${id}.json`}
            />
          )}
        </div>
      </div>

      {/* Verification Instructions */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-ink/10 rounded-lg p-5">
        <h4 className="font-semibold text-deep mb-3 flex items-center">
          <FiInfo className="h-5 w-5 mr-2 text-dusk" />
          Verification Instructions
        </h4>
        <div className="space-y-3">
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-glacier flex items-center justify-center mr-3 mt-0.5">
              <span className="text-brand text-xs font-bold">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-deep">Joint Public Key</p>
              <p className="text-sm text-dusk">Used to encrypt all ballots in this election</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-glacier flex items-center justify-center mr-3 mt-0.5">
              <span className="text-brand text-xs font-bold">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-deep">Commitment Hash</p>
              <p className="text-sm text-dusk">Cryptographic commitment to the election parameters</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-glacier flex items-center justify-center mr-3 mt-0.5">
              <span className="text-brand text-xs font-bold">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-deep">Guardian Keys</p>
              <p className="text-sm text-dusk">Public keys and polynomials used in the threshold cryptography</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-glacier flex items-center justify-center mr-3 mt-0.5">
              <span className="text-brand text-xs font-bold">4</span>
            </div>
            <div>
              <p className="text-sm font-medium text-deep">Encrypted Tally</p>
              <p className="text-sm text-dusk">The encrypted sum of all valid ballots</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-glacier flex items-center justify-center mr-3 mt-0.5">
              <span className="text-brand text-xs font-bold">5</span>
            </div>
            <div>
              <p className="text-sm font-medium text-deep">Proofs</p>
              <p className="text-sm text-dusk">Zero-knowledge proofs that the tallying was performed correctly</p>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-ceremonial-soft border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <FiAlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-ink">
              <strong>Independent Verification:</strong> You can use these artifacts with ElectionGuard verification tools to independently verify that your vote was counted correctly and that the election results are mathematically sound.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Chunks Tab Content
const ChunksTabContent = ({ electionId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [downloadingTallies, setDownloadingTallies] = useState({});

  useEffect(() => {
    if (!electionId) return;

    setLoading(true);
    setLoadError(null);
    electionApi.getElectionResults(electionId, { includeBallots: false, includeChunkCiphertext: false })
      .then((data) => {
        if (data?.success && data.results?.chunks) {
          setChunks(data.results.chunks);
        } else {
          setChunks([]);
        }
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load chunk data');
        setChunks([]);
      })
      .finally(() => setLoading(false));
  }, [electionId]);

  const downloadEncryptedTally = async (chunk) => {
    const chunkId = chunk.electionCenterId;
    if (downloadingTallies[chunkId]) return;

    setDownloadingTallies((prev) => ({ ...prev, [chunkId]: true }));
    try {
      const response = await electionApi.getChunkEncryptedTally(electionId, chunkId);
      const encryptedTally = response?.encryptedTally;
      if (!response?.success || !encryptedTally) {
        toast.error('Encrypted tally is not available for this chunk');
        return;
      }

      await downloadJsonArtifact(
        `chunk_${chunk.chunkIndex}_encrypted_tally_election_${electionId}.json`,
        encryptedTally
      );
    } catch {
      toast.error('Failed to download encrypted tally');
    } finally {
      setDownloadingTallies((prev) => ({ ...prev, [chunkId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <FiLoader className="h-12 w-12 text-brand mx-auto mb-4 animate-spin" />
        <p className="text-dusk">Loading chunk summaries...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-12">
        <FiAlertCircle className="h-12 w-12 text-ember mx-auto mb-4" />
        <p className="text-ink">{loadError}</p>
      </div>
    );
  }

  if (!chunks.length) {
    return (
      <div className="text-center py-12">
        <FiLayers className="h-16 w-16 text-dusk-soft mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-deep mb-2">No Chunk Data Available</h3>
        <p className="text-dusk">
          Chunk tallies and decryptions will appear here once available.
        </p>
      </div>
    );
  }

  const filteredChunks = chunks.filter(chunk =>
    chunk.electionCenterId?.toString().includes(searchTerm) ||
    chunk.chunkIndex?.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-deep text-lg">Per-Chunk Tallies and Decryptions</h4>
          <p className="text-sm text-dusk mt-1">
            Per-chunk vote counts are shown below. Download encrypted tally ciphertext when needed for verification.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search chunks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-ink/10 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
            />
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dusk" />
          </div>
          <span className="text-sm text-dusk">
            {filteredChunks.length} of {chunks.length} chunks
          </span>
        </div>
      </div>

      {/* Chunks List */}
      <div className="space-y-3">
        {filteredChunks.map((chunk) => {
          const isDownloading = downloadingTallies[chunk.electionCenterId];
          return (
            <div key={chunk.electionCenterId} className="bg-paper border border-ink/10 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-glacier flex items-center justify-center">
                      <FiLayers className="h-5 w-5 text-brand" />
                    </div>
                  </div>
                  <div>
                    <h5 className="font-semibold text-deep">
                      Chunk {chunk.chunkIndex}
                    </h5>
                    <p className="text-sm text-dusk">
                      Election Center ID: {chunk.electionCenterId} • {chunk.ballotCount} ballots
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-sage-soft text-aurora-muted rounded-full text-sm font-medium">
                    Processed
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadEncryptedTally(chunk)}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-paper bg-brand-dark hover:bg-brand disabled:opacity-50 transition-colors"
                  >
                    {isDownloading ? (
                      <FiLoader className="h-4 w-4 animate-spin" />
                    ) : (
                      <FiDownload className="h-4 w-4" />
                    )}
                    <span>{isDownloading ? 'Preparing...' : 'Download Encrypted Tally'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-frost border-t border-ink/10">
                <div className="mb-4">
                  <h6 className="text-sm font-semibold text-ink mb-3 flex items-center">
                    <FiBarChart className="h-4 w-4 mr-2 text-brand" />
                    Tally Results for this Chunk
                  </h6>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(chunk.candidateVotes || {}).map(([candidate, votes]) => (
                      <div key={candidate} className="bg-paper rounded-lg px-4 py-3 border border-ink/10 shadow-sm">
                        <CandidateIdentity
                          name={candidate}
                          image={getCandidatePic(electionData?.electionChoices, candidate)}
                          description={getCandidateDescription(electionData?.electionChoices, candidate)}
                          partyName={findChoiceByName(electionData?.electionChoices, candidate)?.partyName}
                          size="sm"
                          enableProfile
                          nameClassName="font-semibold text-deep text-sm"
                        />
                        <p className="text-2xl font-bold text-brand mt-2">{votes}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-glacier border border-brand/20 rounded-lg p-3">
                  <div className="flex items-start">
                    <FiInfo className="h-5 w-5 text-brand mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-ink">
                      <strong>Threshold Cryptography:</strong> Each guardian submitted a partial decryption for this chunk.
                      The partial decryptions were combined using threshold cryptography to compute the tally shown above.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredChunks.length === 0 && (
        <div className="text-center py-8">
          <FiSearch className="h-12 w-12 text-dusk-soft mx-auto mb-3" />
          <p className="text-dusk">No chunks match your search</p>
        </div>
      )}
    </div>
  );
};

const BallotsInTallySection = ({ electionId, pageSize = 30 }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ballots, setBallots] = useState([]);
  const [totalBallots, setTotalBallots] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [sortBy, setSortBy] = useState('ballot_id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchBallots = useCallback(async ({ pageToLoad = 0, append = false } = {}) => {
    if (!electionId) return;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setHasError(false);
      setErrorMessage('');

      const response = await electionApi.getElectionBallots(electionId, {
        page: pageToLoad,
        size: pageSize,
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      if (!response?.success) {
        setBallots([]);
        setTotalBallots(0);
        setStatusCounts({});
        return;
      }

      const nextBallots = response.ballots || [];
      setBallots((prev) => (append ? [...prev, ...nextBallots] : nextBallots));
      setTotalBallots(response.total ?? nextBallots.length);
      setStatusCounts(response.statusCounts || {});
      setPage(pageToLoad);
    } catch (error) {
      console.error('Error loading ballots:', error);
      setHasError(true);
      setErrorMessage('Error loading ballot data: ' + error.message);
      if (!append) {
        setBallots([]);
        setTotalBallots(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [electionId, pageSize, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchBallots({ pageToLoad: 0, append: false });
  }, [fetchBallots]);

  const hasMore = ballots.length < totalBallots;

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchBallots({ pageToLoad: page + 1, append: true });
  };

  const downloadBallotInfo = async (ballot) => {
    try {
      const ballotDetailsResponse = await electionApi.getBallotDetails(electionId, ballot.ballot_id);

      let ballotData;
      if (ballotDetailsResponse && ballotDetailsResponse.success && ballotDetailsResponse.ballot) {
        // Include cipher text from backend
        ballotData = {
          tracking_code: ballot.ballot_id,
          hash_code: ballot.initial_hash,
          decrypted_hash: ballot.decrypted_hash,
          cipher_text: ballotDetailsResponse.ballot.cipher_text,
          status: ballot.status,
          verification: ballot.verification,
          timestamp: new Date().toISOString(),
          election_id: electionId || 'unknown',
        };
      } else {
        // Fallback to original data without cipher text
        ballotData = {
          tracking_code: ballot.ballot_id,
          hash_code: ballot.initial_hash,
          decrypted_hash: ballot.decrypted_hash,
          cipher_text: "Not available",
          status: ballot.status,
          verification: ballot.verification,
          timestamp: new Date().toISOString(),
          election_id: electionId || 'unknown',
        };
        console.warn('Could not fetch cipher text for ballot:', ballot.ballot_id);
      }

      const decodedCipherText = ballotData.cipher_text && ballotData.cipher_text !== 'Not available'
        ? await decodeArtifactForDownload(ballotData.cipher_text)
        : ballotData.cipher_text;
      const downloadPayload = { ...ballotData, cipher_text: decodedCipherText };

      const blob = new Blob([JSON.stringify(downloadPayload, null, 2)], { type: 'application/json' });
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
        election_id: electionId || 'unknown',
      };

      const blob = new Blob([JSON.stringify(ballotData, null, 2)], { type: 'application/json' });
      saveAs(blob, `ballot_${ballot.ballot_id}_verification.json`);
    }
  };

  const downloadAllBallotsCSV = async () => {
    try {
      setDownloadingCsv(true);
      const response = await electionApi.getAllElectionBallots(electionId, {
        sortBy,
        sortOrder,
      });
      const allBallots = response.ballots || [];

      if (allBallots.length === 0) {
        toast.error('No ballots available to export');
        return;
      }

      const csvHeaders = ['Chunk #', 'Tracking Code', 'Hash Code', 'Decrypted Hash', 'Status', 'Verification'];
      const csvRows = allBallots.map((ballot) => [
        ballot.chunkIndex ?? 'N/A',
        ballot.ballot_id ?? '',
        ballot.initial_hash ?? 'N/A',
        ballot.decrypted_hash ?? 'N/A',
        ballot.status ?? '',
        ballot.verification ?? '',
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map((row) => row.map((field) => escapeCsvField(field)).join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, `all_ballots_verification_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success(`Downloaded ${allBallots.length} ballots as CSV`);
    } catch (error) {
      console.error('Error downloading ballots CSV:', error);
      toast.error('Failed to download ballots CSV');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const getVerificationStatus = (ballot) => {
    const status = ballot.verification;
    switch (status) {
      case 'success':
        return { text: 'Verified', color: 'green', icon: FiCheck, bgColor: 'bg-sage-soft', textColor: 'text-aurora-muted', borderColor: 'border-aurora/30' };
      case 'failed':
        return { text: 'Failed', color: 'red', icon: FiX, bgColor: 'bg-ember-soft', textColor: 'text-ember', borderColor: 'border-ember/30' };
      case 'no_initial_hash':
        return { text: 'No Hash', color: 'yellow', icon: FiAlertCircle, bgColor: 'bg-ceremonial-soft', textColor: 'text-ink', borderColor: 'border-yellow-200' };
      default:
        return { text: 'Unknown', color: 'gray', icon: FiInfo, bgColor: 'bg-frost-muted', textColor: 'text-ink', borderColor: 'border-ink/10' };
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center">
          <FiDatabase className="h-5 w-5 mr-2" />
          Ballots in Tally ({totalBallots} total)
        </h3>

        <button
          onClick={downloadAllBallotsCSV}
          className="flex items-center space-x-2 bg-aurora-muted text-paper px-4 py-2 rounded-lg hover:bg-aurora transition-colors disabled:opacity-50"
          disabled={totalBallots === 0 || downloadingCsv}
        >
          {downloadingCsv ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiDownload className="h-4 w-4" />}
          <span>{downloadingCsv ? 'Preparing CSV...' : 'Download All CSV'}</span>
        </button>
      </div>

      {loading && ballots.length === 0 ? (
        <div className="text-center py-12">
          <FiLoader className="h-12 w-12 text-brand mx-auto mb-4 animate-spin" />
          <p className="text-dusk">Loading ballot data...</p>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-sage-soft border border-aurora/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-aurora-muted">{statusCounts.success || 0}</div>
          <div className="text-sm text-sage">Verified</div>
        </div>
        <div className="bg-ember-soft border border-ember/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-ember">{statusCounts.failed || 0}</div>
          <div className="text-sm text-ember">Failed</div>
        </div>
        <div className="bg-glacier border border-brand/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-ink">{statusCounts.cast || 0}</div>
          <div className="text-sm text-brand">Cast</div>
        </div>
        <div className="bg-ceremonial-soft border border-ceremonial/40 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-ink">{statusCounts.spoiled || 0}</div>
          <div className="text-sm text-ink">Spoiled</div>
        </div>
        <div className="bg-glacier border border-brand/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-ink">{totalBallots}</div>
          <div className="text-sm text-brand-dark">Total</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by tracking code, hash code, or verification status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-ink/10 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
          />
          <FiHash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dusk h-4 w-4" />
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-ink/10 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
          >
            <option value="ballot_id">Sort by Tracking Code</option>
            <option value="status">Sort by Status</option>
            <option value="verification">Sort by Verification</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-ink/10 rounded-lg hover:bg-frost transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <p className="text-xs text-dusk mb-4">
        Showing {ballots.length} of {totalBallots} ballots.
        {debouncedSearch
          ? ' Search scans the entire tally on the server — not just the rows currently visible.'
          : ' Only tracking codes and hashes are loaded initially; encrypted ballot ciphertext is fetched when you download a card.'}
      </p>

      {debouncedSearch && (
        <div className="mb-4 text-sm text-dusk">
          {totalBallots === 0
            ? 'No ballots match your search.'
            : `Found ${totalBallots} matching ballot${totalBallots === 1 ? '' : 's'}.`}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ballots.map((ballot) => {
          const statusInfo = getVerificationStatus(ballot);
          const StatusIcon = statusInfo.icon;

          return (
            <div
              key={ballot.ballot_id}
              className={`bg-paper border-2 ${statusInfo.borderColor} rounded-lg p-4 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div className={`${statusInfo.bgColor} rounded-full p-2 mr-3`}>
                    <FiFileText className={`h-4 w-4 ${statusInfo.textColor}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center ${statusInfo.textColor}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      <span className="text-xs font-medium">{statusInfo.text}</span>
                    </div>
                    {ballot.chunkIndex && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-glacier text-ink text-xs font-bold">
                        Chunk {ballot.chunkIndex}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => downloadBallotInfo(ballot)}
                  className="text-dusk hover:text-brand transition-colors p-1 rounded hover:bg-glacier"
                  title="Download encrypted ballot and verification details"
                >
                  <FiDownload className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-dusk font-medium">Tracking Code:</span>
                  <div className="font-mono text-deep bg-frost px-2 py-1 rounded mt-1 break-all text-xs border">
                    {ballot.ballot_id}
                  </div>
                </div>
                <div>
                  <span className="text-dusk font-medium">Initial Hash:</span>
                  <div className="font-mono text-deep bg-frost px-2 py-1 rounded mt-1 break-all text-xs border">
                    {ballot.initial_hash || 'N/A'}
                  </div>
                </div>
                {ballot.decrypted_hash && ballot.decrypted_hash !== ballot.initial_hash && (
                  <div>
                    <span className="text-dusk font-medium">Decrypted Hash:</span>
                    <div className="font-mono text-deep bg-frost px-2 py-1 rounded mt-1 break-all text-xs border">
                      {ballot.decrypted_hash}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-ink/10">
                  <div>
                    <span className="text-dusk font-medium">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${ballot.status === 'cast' ? 'bg-glacier text-ink' : 'bg-ceremonial-soft text-ink'
                      }`}>
                      {ballot.status}
                    </span>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                    {statusInfo.text}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-ink/10 text-sm font-medium text-ink hover:bg-frost disabled:opacity-50"
          >
            {loadingMore ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiChevronDown className="h-4 w-4" />}
            <span>{loadingMore ? 'Loading...' : `Load more (${ballots.length} of ${totalBallots})`}</span>
          </button>
        </div>
      )}

      {ballots.length === 0 && searchTerm && !loading && (
        <div className="text-center py-12">
          <FiHash className="h-16 w-16 text-dusk-soft mx-auto mb-4" />
          <h3 className="text-lg font-medium text-deep mb-2">No Ballots Found</h3>
          <p className="text-dusk">No ballots match your search criteria. Try a different search term.</p>
        </div>
      )}

      {ballots.length === 0 && !searchTerm && !hasError && !loading && (
        <div className="text-center py-12">
          <FiDatabase className="h-16 w-16 text-dusk-soft mx-auto mb-4" />
          <h3 className="text-lg font-medium text-deep mb-2">No Ballots Available</h3>
          <p className="text-dusk">Ballot verification data will be available after the election results are computed.</p>
        </div>
      )}

      {hasError && (
        <div className="text-center py-12">
          <FiAlertCircle className="h-16 w-16 text-ember mx-auto mb-4" />
          <h3 className="text-lg font-medium text-ember mb-2">Error Loading Ballots</h3>
          <p className="text-ink">{errorMessage}</p>
          <p className="text-dusk mt-4">Please refresh the page or contact support if this issue persists.</p>
        </div>
      )}
        </>
      )}
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

  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [electionData, setElectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Voting-related state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resultsExportRef = useRef(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [voteResult, setVoteResult] = useState(null);
  const [voteError, setVoteError] = useState(null);
  const [createBallotError, setCreateBallotError] = useState(null);
  const [castBallotError, setCastBallotError] = useState(null);
  const [challengeError, setChallengeError] = useState(null);

  // Encrypted ballot workflow state
  const [encryptedBallotData, setEncryptedBallotData] = useState(null);
  const [ballotModalOpen, setBallotModalOpen] = useState(false);
  const [ballotModalPhase, setBallotModalPhase] = useState('creating');
  const [challengeResult, setChallengeResult] = useState(null);
  const [ballotChallenged, setBallotChallenged] = useState(false);
  const [challengeCandidateChoices, setChallengeCandidateChoices] = useState([]);

  // Bot detection state
  const [botDetection, setBotDetection] = useState({
    loading: false,
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
  const [voterListSaving, setVoterListSaving] = useState(false);
  const [showVoterEditor, setShowVoterEditor] = useState(false);
  const [showVoterList, setShowVoterList] = useState(false);
  const [votersLoading, setVotersLoading] = useState(false);
  const [isAppAdminOrOwner, setIsAppAdminOrOwner] = useState(false);

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

  // Key ceremony progress state (shown in Guardian tab)
  const [guardianKeyCeremonyContext, setGuardianKeyCeremonyContext] = useState(null);
  const [adminKeyCeremonyStatus, setAdminKeyCeremonyStatus] = useState(null);
  const [activationSchedule, setActivationSchedule] = useState({
    startingTime: '',
    endingTime: '',
  });
  const [activatingElection, setActivatingElection] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingVotingRules, setEditingVotingRules] = useState(false);
  const [maxChoicesDraft, setMaxChoicesDraft] = useState('1');
  const [winnerNoDraft, setWinnerNoDraft] = useState('1');
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState({ startingTime: '', endingTime: '' });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [keyCeremonyUiMessage, setKeyCeremonyUiMessage] = useState('');
  const [keyCeremonyUiError, setKeyCeremonyUiError] = useState('');
  const [guardianCeremonyForm, setGuardianCeremonyForm] = useState({
    privateKey: '',
    publicKey: '',
    polynomial: '',
    localEncryptionPassword: '',
    keyBackup: '',
  });
  const [backupCeremonyForm, setBackupCeremonyForm] = useState({
    credentialContent: '',
    credentialFileName: '',
    generatedGuardianData: '',
  });
  const [keyCeremonyBusy, setKeyCeremonyBusy] = useState({
    generatingCredentials: false,
    submittingRound1: false,
    generatingBackup: false,
    submittingBackup: false,
  });

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
        setShowVoterList(false);
        // Check if user has already voted - this info is now handled through eligibilityData

        // Auto-check combine status if election has ended (results loaded lazily per tab)
        const electionStatus = getElectionStatusFromData(data);
        if (electionStatus === 'finished') {
          const guardiansSubmitted = data.guardiansSubmitted || 0;
          const electionQuorum = data.electionQuorum || data.totalGuardians || 0;
          const quorumMet = guardiansSubmitted >= electionQuorum;

          console.log('🔍 [Election Status Check] Election status:', data.status, 'Quorum met:', quorumMet);
          
          if (quorumMet) {
            console.log('✅ Quorum met. Checking combine status (results deferred until tab open)...');
            
            try {
              const combineStatusData = await electionApi.getCombineStatus(id);
              console.log('🔍 Combine status:', combineStatusData);
              setCombineStatus(combineStatusData);

              if (combineStatusData?.status === 'in_progress' || combineStatusData?.status === 'pending') {
                console.log('🧹 Clearing stale results data to prevent displaying partial results');
                setAnimatedResults(null);
                setResultsData(null);
                setRawVerificationData(null);
              }
            } catch (err) {
              console.warn('No combine status found:', err);
            }
          }
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

  useEffect(() => {
    let isMounted = true;
    const loadAppAccess = async () => {
      try {
        const access = await getAuthorizedUsersAccess();
        if (!isMounted) return;
        const userType = access?.userType;
        setIsAppAdminOrOwner(userType === 'admin' || userType === 'owner' || !!access?.canDeleteAnyElection);
      } catch {
        if (isMounted) {
          setIsAppAdminOrOwner(false);
        }
      }
    };
    loadAppAccess();
    return () => {
      isMounted = false;
    };
  }, []);

  // Guardian tab decryption status — initial + live updates via SSE snapshots (no polling)
  useElectionProgressStream(id, {
    enabled: Boolean(id) && (activeTab === 'guardian' || activeTab === 'info' || activeTab === 'results'),
    onEvent: (event) => {
      if (!event) return;
      const snapshot = getSnapshotFromEvent(event);
      if (!snapshot) return;

      const myDecryption = pickMyDecryption(snapshot);
      if (myDecryption && activeTab === 'guardian') {
        setGuardianDecryptionStatus(myDecryption);
        if (myDecryption.status === 'in_progress' || myDecryption.status === 'pending') {
          setCurrentGuardianName(myDecryption.guardianEmail || myDecryption.guardianName || 'Guardian');
        }
      }

      const combine = pickCombine(snapshot);
      if (combine && combine.status) {
        setCombineStatus(combine);
      }

      const tally = pickTally(snapshot);
      if (tally && tally.status) {
        setTallyStatus(tally);
      }
    },
  });

  useEffect(() => {
    if (!id || !electionData?.endingTime) return;
    if (new Date(electionData.endingTime) >= new Date()) return;
    if (!['guardian', 'info', 'results', 'verification'].includes(activeTab)) return;

    electionApi.getTallyStatus(id)
      .then((data) => {
        if (data?.status) setTallyStatus(data);
      })
      .catch(() => {});
  }, [id, electionData?.endingTime, activeTab]);

  const loadKeyCeremonyProgress = useCallback(async () => {
    if (activeTab !== 'guardian' || !electionData) {
      setGuardianKeyCeremonyContext(null);
      setAdminKeyCeremonyStatus(null);
      return;
    }

    if (electionData.status !== 'key_ceremony_pending') {
      setGuardianKeyCeremonyContext(null);
      setAdminKeyCeremonyStatus(null);
      return;
    }

    const isGuardian = electionData?.userRoles?.includes('guardian');

    if (isGuardian) {
      try {
        const pendingResp = await electionApi.getPendingKeyCeremonies();
        const pendingItems = pendingResp?.elections || [];
        const current = pendingItems.find((item) => Number(item.electionId) === Number(id));
        setGuardianKeyCeremonyContext(current || null);
      } catch {
        setGuardianKeyCeremonyContext(null);
      }
    } else {
      setGuardianKeyCeremonyContext(null);
    }

    try {
      const statusResp = await electionApi.getKeyCeremonyStatus(id);
      setAdminKeyCeremonyStatus(statusResp?.status || null);
    } catch {
      setAdminKeyCeremonyStatus(null);
    }
  }, [activeTab, electionData, id]);

  // Load key ceremony progress (guardian + admin) for Guardian tab
  useEffect(() => {
    loadKeyCeremonyProgress();
  }, [loadKeyCeremonyProgress]);

  // Poll key ceremony progress so all guardians see live updates
  useEffect(() => {
    if (activeTab !== 'guardian' || electionData?.status !== 'key_ceremony_pending') {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadKeyCeremonyProgress();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeTab, electionData?.status, loadKeyCeremonyProgress]);

  // Initialize bot detection when opening the voting booth (not on every tab)
  useEffect(() => {
    if (activeTab !== 'voting') return;
    if (botDetection.timestamp) return;

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
  }, [activeTab, botDetection.timestamp]); // Run when voting tab is opened

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
    if (!electionData) return 'unknown';
    return timezoneUtils.getElectionStatus(electionData.startingTime, electionData.endingTime);
  }, [electionData]);

  const isElectionFinished = useCallback(() => getElectionStatus() === 'finished', [getElectionStatus]);
  const isKeyCeremonyPending = electionData?.status === 'key_ceremony_pending';
  const isTallyComplete = tallyStatus?.status === 'completed';
  const isCombineComplete = combineStatus?.status === 'completed' || Boolean(resultsData);
  const combineNavigatedRef = useRef(false);
  const isElectionAdminUser = () => electionData?.userRoles?.includes('admin');

  useEffect(() => {
    if (combineStatus?.status === 'completed' && !combineNavigatedRef.current) {
      combineNavigatedRef.current = true;
      handleTabClick('results');
    }
    if (combineStatus?.status !== 'completed') {
      combineNavigatedRef.current = false;
    }
  }, [combineStatus?.status]);

  const canUserViewResults = useCallback(() => {
    return isCombineComplete;
  }, [isCombineComplete]);

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
        
        return {
          name: name,
          votes: votes,
          percentage: parseFloat(percentage)
        };
      });

      // Count total ballots from verification data or use total votes
      const totalBallots = dataToProcess.verification?.ballots?.length || 
                          dataToProcess.results?.total_valid_ballots || 
                          dataToProcess.results?.total_ballots_cast || 
                          totalVotes;

      // Use total_eligible_voters from API if available, otherwise fall back to currentElectionData
      const totalEligibleVoters = dataToProcess.results?.total_eligible_voters ||
                                  getTotalVoters(currentElectionData) ||
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
    const totalEligibleVoters = getTotalVoters(currentElectionData);
    const totalVotedUsers = getVotedCount(currentElectionData);

    const chartData = currentElectionData.electionChoices.map(choice => ({
      name: choice.optionTitle,
      votes: choice.totalVotes || 0,
      percentage: totalVotes > 0 ? ((choice.totalVotes || 0) / totalVotes * 100).toFixed(1) : 0
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

      // After combining, fetch summary results (ballots loaded lazily on Ballots tab)
      try {
        const animatedResultsData = await electionApi.getElectionResults(id, { includeBallots: false });
        if (animatedResultsData.success && animatedResultsData.results) {
          console.log('✅ Auto-fetched cached results summary after combining');
          setAnimatedResults(animatedResultsData);

          const summaryPayload = buildSummaryPayloadFromCachedResults(animatedResultsData, electionData);
          const processedResults = processElectionResults(summaryPayload, electionData);
          if (processedResults) {
            setResultsData(processedResults);
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
  }, [id, processElectionResults, electionData]);

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
        toast.success('Combine completed! Opening results...');
        await fetchElectionData();
        handleTabClick('results');
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
    
    // Try to fetch cached results summary
    try {
      const animatedResultsData = await electionApi.getElectionResults(id, { includeBallots: false });
      if (animatedResultsData.success && animatedResultsData.results) {
        setAnimatedResults(animatedResultsData);

        const summaryPayload = buildSummaryPayloadFromCachedResults(animatedResultsData, electionData);
        const processedResults = processElectionResults(summaryPayload, electionData);
        if (processedResults) {
          setResultsData(processedResults);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch cached results after combining:', err);
    }

    handleTabClick('results');
  }, [id, fetchElectionData, processElectionResults, electionData]);

  const loadElectionResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      if (!animatedResults) {
        const animatedResultsData = await electionApi.getElectionResults(id, { includeBallots: false });
        if (animatedResultsData?.success && animatedResultsData.results) {
          setAnimatedResults(animatedResultsData);
          const summaryPayload = buildSummaryPayloadFromCachedResults(animatedResultsData, electionData);
          const processedResults = processElectionResults(summaryPayload, electionData);
          if (processedResults) {
            setResultsData(processedResults);
          }
          return;
        }
      }

      const processedResults = processElectionResults();
      if (processedResults) {
        setResultsData(processedResults);
      }
    } catch (err) {
      console.error('Error loading results:', err);
      const processedResults = processElectionResults();
      if (processedResults) {
        setResultsData(processedResults);
      }
    } finally {
      setLoadingResults(false);
    }
  }, [id, animatedResults, electionData, processElectionResults]);

  // Load results when switching to results or verification tabs
  useEffect(() => {
    const tabsRequiringResults = ['results', 'verification'];
    if (tabsRequiringResults.includes(activeTab) && canUserViewResults() && !resultsData && !loadingResults) {
      loadElectionResults();
    }
  }, [activeTab, resultsData, loadingResults, loadElectionResults, canUserViewResults]);



  const resetBallotWorkflow = useCallback(() => {
    setEncryptedBallotData(null);
    setBallotModalOpen(false);
    setBallotModalPhase('creating');
    setChallengeResult(null);
    setBallotChallenged(false);
    setChallengeCandidateChoices([]);
    setCreateBallotError(null);
    setCastBallotError(null);
    setChallengeError(null);
  }, []);

  const handleBallotModalClose = useCallback(() => {
    if (ballotModalPhase === 'cast-success') {
      setBallotModalOpen(false);
      setBallotModalPhase('creating');
      setEncryptedBallotData(null);
      return;
    }
    resetBallotWorkflow();
  }, [ballotModalPhase, resetBallotWorkflow]);

  const handleChallengeCandidateToggle = useCallback((choiceIdStr) => {
    const maxChoices = electionData?.maxChoices || 1;
    setChallengeCandidateChoices((prev) => {
      if (prev.includes(choiceIdStr)) {
        return prev.filter((id) => id !== choiceIdStr);
      }
      if (maxChoices === 1) {
        return [choiceIdStr];
      }
      if (prev.length >= maxChoices) {
        return prev;
      }
      return [...prev, choiceIdStr];
    });
  }, [electionData?.maxChoices]);

  const handleCandidateToggle = useCallback((choiceIdStr) => {
    const maxChoices = electionData?.maxChoices || 1;
    setSelectedCandidates((prev) => {
      if (prev.includes(choiceIdStr)) {
        return prev.filter((id) => id !== choiceIdStr);
      }
      if (maxChoices === 1) {
        return [choiceIdStr];
      }
      if (prev.length >= maxChoices) {
        return prev;
      }
      return [...prev, choiceIdStr];
    });
  }, [electionData?.maxChoices]);

  const handleOpenConfirmModal = (canCreateBallot) => {
    if (!canCreateBallot || !selectedCandidates.length || ballotModalOpen) return;
    setShowConfirmModal(true);
  };

  const handleCreateEncryptedBallot = async () => {
    setEncryptedBallotData(null);
    setChallengeResult(null);
    setBallotChallenged(false);
    setVoteResult(null);
    setVoteError(null);
    setCreateBallotError(null);
    setCastBallotError(null);
    setChallengeError(null);
    setChallengeCandidateChoices([]);
    setBallotModalOpen(true);
    setBallotModalPhase('creating');

    if (botDetection.isBot) {
      setCreateBallotError('Security check failed. Automated ballot creation is not allowed.');
      setBallotModalPhase('create-error');
      return;
    }

    console.log('🔍 [ENCRYPTED BALLOT] Performing fresh bot detection before creating encrypted ballot...');

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

      if (result.bot) {
        console.warn('🚨 [ENCRYPTED BALLOT] Bot detected during ballot creation');
        setCreateBallotError('Security check failed. Automated ballot creation is not allowed.');
        setBallotModalPhase('create-error');
        return;
      }

      console.log('✅ [ENCRYPTED BALLOT] Fresh bot check passed');
    } catch (error) {
      console.error('⚠️ [ENCRYPTED BALLOT] Fresh bot detection failed:', error);
      setCreateBallotError('Security check could not be completed. Please refresh and try again.');
      setBallotModalPhase('create-error');
      return;
    }

    try {
      const selectedChoices = electionData.electionChoices.filter(
        choice => selectedCandidates.includes(choice.choiceId.toString())
      );
      const optionTitles = selectedChoices.map(c => c.optionTitle);
      const selectedChoiceIds = selectedChoices.map(c => c.choiceId);

      console.log('📤 [ENCRYPTED BALLOT] Creating encrypted ballot...');
      const result = await electionApi.createEncryptedBallot(
        id,
        selectedChoiceIds,
        optionTitles,
        freshBotDetection,
        electionData.maxChoices || 1
      );

      setEncryptedBallotData(result);
      setBallotModalPhase('actions');
      setSelectedCandidates([]);

      console.log('✅ [ENCRYPTED BALLOT] Encrypted ballot created successfully');

    } catch (err) {
      console.error('❌ [ENCRYPTED BALLOT] Ballot creation failed:', err);
      setCreateBallotError(getVoterFriendlyError(err));
      setBallotModalPhase('create-error');
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

    setBallotModalPhase('casting');
    setCastBallotError(null);

    try {
      console.log('📤 [CAST ENCRYPTED] Casting encrypted ballot...');
      const result = await electionApi.castEncryptedBallot(
        id,
        encryptedBallotData.encrypted_ballot,
        encryptedBallotData.ballot_hash,
        encryptedBallotData.ballot_tracking_code
      );

      const castResultWithBallot = {
        ...result,
        encryptedBallotData
      };

      setVoteResult(castResultWithBallot);
      setBallotModalPhase('cast-success');

      console.log('✅ [CAST ENCRYPTED] Encrypted ballot cast successfully');

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
      const friendlyMessage = getVoterFriendlyError(err);
      setCastBallotError(friendlyMessage);
      setBallotModalPhase('actions');
      toast.error(friendlyMessage);
    }
  };

  const handleStartChallenge = () => {
    if (!encryptedBallotData || ballotChallenged) return;
    setChallengeCandidateChoices([]);
    setBallotModalPhase('challenge-pick');
  };

  const handleConfirmChallenge = async () => {
    if (!challengeCandidateChoices.length) return;

    setBallotModalPhase('challenging');
    setChallengeResult(null);
    setChallengeError(null);

    try {
      console.log('🔍 [BENALOH CHALLENGE] Performing challenge...');

      const selectedChoices = electionData.electionChoices.filter(
        choice => challengeCandidateChoices.includes(choice.choiceId.toString())
      );
      const candidateNames = selectedChoices.map(c => c.optionTitle);

      console.log('🔍 [BENALOH CHALLENGE] Challenge candidates:', candidateNames);

      const result = await electionApi.performBenalohChallenge(
        id,
        encryptedBallotData.encrypted_ballot_with_nonce,
        candidateNames
      );

      setChallengeResult(result);
      setBallotChallenged(true);
      setBallotModalPhase('challenge-result');

      console.log('✅ [BENALOH CHALLENGE] Challenge completed:', result);

      if (result.match) {
        const verifiedList = result.verified_candidates ? result.verified_candidates.join(', ') : result.verified_candidate;
        toast.success(`Challenge verification passed! The ballot was encrypted for: ${verifiedList}`);
      } else {
        toast.error('Challenge verification failed! Ballot did not match the expected candidates.');
      }

    } catch (err) {
      console.error('❌ [BENALOH CHALLENGE] Challenge failed:', err);
      const friendlyMessage = getVoterFriendlyError(err);
      setChallengeError(friendlyMessage);
      setBallotModalPhase('challenge-result');
      toast.error(friendlyMessage);
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
        choice => choice.choiceId.toString() === (selectedCandidates[0] || '')
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
      setSelectedCandidates([]);
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
      setVoteError(getVoterFriendlyError(err));
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
        const friendly = getGuardianKeyFriendlyError({ message: result.message });
        setKeySubmissionError(friendly);
        toast.error(friendly);
      }
    } catch (err) {
      console.error('Error in handleGuardianKeySubmit:', err);
      const friendly = getGuardianKeyFriendlyError(err);
      setKeySubmissionError(friendly);
      toast.error(friendly);
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
      setKeySubmissionError(getGuardianKeyFriendlyError({ message: `Failed to read credential file: ${error.message}` }));
      setGuardianKey('');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const saveVoteDetails = (format = 'txt') => {
    const normalizedTitle = String(electionData?.electionTitle || 'election')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) || 'election';

    if (format === 'txt') {
      // Standard TXT format for vote receipts
      const txtDetails = `
Election: ${electionData.electionTitle}
Vote Hash: ${voteResult.hashCode}
Tracking Code: ${voteResult.trackingCode}
Date: ${timezoneUtils.formatForDisplay(new Date().toISOString())}
Candidate: ${voteResult.votedCandidate?.optionTitle || 'Unknown'}
      `.trim();

      const blob = new Blob([txtDetails], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vote_receipt_${normalizedTitle}_election_${electionData?.id || id}_${voteResult.trackingCode}.txt`;
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
        candidate: voteResult.votedCandidate?.optionTitle || 'Unknown'
      };

      const blob = new Blob([JSON.stringify(jsonDetails, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vote_receipt_${normalizedTitle}_election_${electionData?.id || id}_${voteResult.trackingCode}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const downloadResultsPDF = async () => {
    if (!resultsData && !processElectionResults()) return;

    const processedResults = resultsData || processElectionResults();
    if (!processedResults) return;

    setDownloadingPdf(true);
    try {
      const winnerCount = getWinnerCount(electionData);
      const ranked = buildCompetitionRankings(
        processedResults.chartData.map((item) => ({
          name: item.name,
          votes: item.votes,
          percentage: item.percentage,
        }))
      );

      await generateElectionResultsPdf({
        electionData,
        electionId: id,
        processedResults,
        ranked,
        winnerCount,
        formatGeneratedAt: timezoneUtils.formatForDisplay(new Date().toISOString()),
        formatStartTime: electionData?.startingTime
          ? timezoneUtils.formatForDisplay(electionData.startingTime)
          : null,
        formatEndTime: electionData?.endingTime
          ? timezoneUtils.formatForDisplay(electionData.endingTime)
          : null,
        statusLabel: timezoneUtils.getElectionStatusLabel(
          electionData?.status,
          electionData?.startingTime,
          electionData?.endingTime,
        ),
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadResultsCSV = () => {
    const processedResults = resultsData || processElectionResults();
    if (!processedResults) return;

    try {
      const { content, filename } = prepareElectionResultsCsvContent({
        electionData,
        electionId: id,
        processedResults,
        winnerCount: getWinnerCount(electionData),
      });

      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, filename);
    } catch (err) {
      console.error('CSV export failed:', err);
      toast.error('Failed to generate CSV. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled yet';
    return timezoneUtils.formatForDisplay(dateString);
  };

  const getElectionStatusFromData = (data) => {
    if (!data) return 'unknown';
    return timezoneUtils.getElectionStatus(data.startingTime, data.endingTime);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'bg-ceremonial-soft text-ink';
      case 'scheduled': return 'bg-glacier text-ink';
      case 'ongoing': return 'bg-sage-soft text-aurora-muted';
      case 'finished': return 'bg-ember-soft text-ember';
      default: return 'bg-frost-muted text-ink';
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

  const canViewVoterList = () =>
    electionData?.userRoles?.includes('admin') || isAppAdminOrOwner;

  const canEditVoterList = () => {
    if (!electionData || electionData.eligibility !== 'listed') return false;
    if (isElectionFinished()) return false;
    return !!electionData.userRoles?.includes('admin');
  };

  const canRemoveVoters = () => {
    if (!canEditVoterList()) return false;
    if (!electionData.startingTime) return true;
    return new Date(electionData.startingTime) > new Date();
  };

  const voterEmails = useMemo(
    () => (electionData?.voters || []).map((voter) => voter.userEmail),
    [electionData?.voters]
  );

  const updateVotersFromResponse = (voters) => {
    setElectionData((prev) => (prev ? {
      ...prev,
      voters,
      totalVoters: voters.length,
      votedCount: voters.filter((v) => v.hasVoted).length,
    } : prev));
  };

  const loadElectionVoters = useCallback(async () => {
    if (votersLoading) return electionData?.voters || [];

    if (electionData?.voters?.length) {
      setShowVoterList(true);
      return electionData.voters;
    }

    try {
      setVotersLoading(true);
      const response = await electionApi.getElectionVoters(id);
      const voters = response?.voters || [];
      setElectionData((prev) => (prev ? {
        ...prev,
        voters,
        totalVoters: response?.totalVoters ?? voters.length,
        votedCount: response?.votedCount ?? voters.filter((v) => v.hasVoted).length,
      } : prev));
      setShowVoterList(true);
      return voters;
    } catch (err) {
      toast.error(err.message || 'Failed to load voters');
      return [];
    } finally {
      setVotersLoading(false);
    }
  }, [electionData?.voters, id, votersLoading]);

  const handleToggleVoterEditor = async () => {
    const next = !showVoterEditor;
    setShowVoterEditor(next);
    if (next && !electionData?.voters?.length) {
      await loadElectionVoters();
    }
  };

  const handleToggleVoterList = async () => {
    if (showVoterList) {
      setShowVoterList(false);
      return;
    }
    await loadElectionVoters();
  };

  const handleVoterListChange = async (nextEmails) => {
    const currentEmails = voterEmails;
    const addedEmails = nextEmails.filter((email) => !currentEmails.includes(email));
    if (!addedEmails.length) return;

    try {
      setVoterListSaving(true);
      const response = await electionApi.addVotersToElection(id, addedEmails);
      updateVotersFromResponse(response.voters || []);
      toast.success(`Added ${addedEmails.length} voter${addedEmails.length === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error(err.message || 'Failed to add voters');
    } finally {
      setVoterListSaving(false);
    }
  };

  const handleRemoveVoter = async (email) => {
    if (!canRemoveVoters()) {
      toast.error('Voters cannot be removed after the election has started');
      return;
    }

    try {
      setVoterListSaving(true);
      const response = await electionApi.removeVoterFromElection(id, email);
      updateVotersFromResponse(response.voters || []);
      toast.success('Voter removed.');
    } catch (err) {
      toast.error(err.message || 'Failed to remove voter');
    } finally {
      setVoterListSaving(false);
    }
  };

  const handleRemoveAllVoters = async () => {
    if (!canRemoveVoters()) {
      toast.error('Voters cannot be removed after the election has started');
      return;
    }
    if (!voterEmails.length) return;
    if (!window.confirm('Remove all voters from this election?')) return;

    try {
      setVoterListSaving(true);
      const response = await electionApi.removeAllVotersFromElection(id);
      updateVotersFromResponse(response.voters || []);
      toast.success('All voters removed.');
    } catch (err) {
      toast.error(err.message || 'Failed to remove voters');
    } finally {
      setVoterListSaving(false);
    }
  };

  const canSubmitGuardianKey = () => {
    if (!canUserManageGuardian()) return { canSubmit: false, reason: 'Not a guardian' };

    const electionStatus = getElectionStatus();
    if (electionStatus !== 'finished') {
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
    // Available once combine is complete; does not require full results/ballots preloaded in the client
    return canUserViewResults();
  };

  const getKeyCeremonyProgressMessage = () => {
    const round = guardianKeyCeremonyContext?.currentRound || adminKeyCeremonyStatus?.currentRound;
    const submittedRound1 = guardianKeyCeremonyContext?.submittedGuardians
      ?? adminKeyCeremonyStatus?.submittedGuardians
      ?? 0;
    const submittedRound2 = guardianKeyCeremonyContext?.submittedBackupGuardians
      ?? adminKeyCeremonyStatus?.submittedBackupGuardians
      ?? 0;
    const totalGuardians = guardianKeyCeremonyContext?.numberOfGuardians
      ?? adminKeyCeremonyStatus?.totalGuardians
      ?? electionData?.numberOfGuardians
      ?? 0;

    switch (round) {
      case 'keypair_generation':
        return `Round 1 in progress: ${submittedRound1}/${totalGuardians} guardian(s) generated key pairs.`;
      case 'waiting_for_all_keypairs':
        return `Round 1 waiting: ${submittedRound1}/${totalGuardians} guardian(s) submitted key pairs.`;
      case 'backup_key_sharing':
        return `Round 2 in progress: ${submittedRound2}/${totalGuardians} guardian(s) shared encrypted backup shares.`;
      case 'backup_submitted_waiting_others':
        return `Round 2 waiting: ${submittedRound2}/${totalGuardians} guardian(s) shared encrypted backup shares.`;
      default:
        return 'Key ceremony is in progress.';
    }
  };

  const getKeyCeremonyStep = () => {
    const round = guardianKeyCeremonyContext?.currentRound || adminKeyCeremonyStatus?.currentRound;
    if (round === 'keypair_generation' || round === 'waiting_for_all_keypairs') return 1;
    if (round === 'backup_key_sharing' || round === 'backup_submitted_waiting_others') return 2;
    return 0;
  };

  const getRound1Progress = () => {
    const submitted = guardianKeyCeremonyContext?.submittedGuardians
      ?? adminKeyCeremonyStatus?.submittedGuardians
      ?? 0;
    const total = guardianKeyCeremonyContext?.numberOfGuardians
      ?? adminKeyCeremonyStatus?.totalGuardians
      ?? electionData?.numberOfGuardians
      ?? 0;

    return total > 0 ? Math.round((submitted / total) * 100) : 0;
  };

  const getRound2Progress = () => {
    const submitted = guardianKeyCeremonyContext?.submittedBackupGuardians
      ?? adminKeyCeremonyStatus?.submittedBackupGuardians
      ?? 0;
    const total = guardianKeyCeremonyContext?.numberOfGuardians
      ?? adminKeyCeremonyStatus?.totalGuardians
      ?? electionData?.numberOfGuardians
      ?? 0;

    return total > 0 ? Math.round((submitted / total) * 100) : 0;
  };

  const triggerAutoCredentialDownload = ({ electionId, encryptedCredential }) => {
    const normalizedTitle = String(electionData?.electionTitle || 'election')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) || 'election';

    const blob = new Blob([String(encryptedCredential || '').trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guardian_credentials_${normalizedTitle}_election_${electionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateLocalPassword = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}';
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  };

  const handleGenerateLocalPassword = () => {
    const generated = generateLocalPassword();
    setGuardianCeremonyForm((prev) => ({ ...prev, localEncryptionPassword: generated }));
    setKeyCeremonyUiError('');
    setKeyCeremonyUiMessage('Local AES-256 password generated.');
  };

  const handleGenerateKeyCeremonyCredentials = async () => {
    try {
      setKeyCeremonyUiError('');
      setKeyCeremonyUiMessage('');
      setKeyCeremonyBusy((prev) => ({ ...prev, generatingCredentials: true }));
      const generated = await electionApi.generateGuardianKeyCeremonyCredentials(id);

      setGuardianCeremonyForm((prev) => ({
        ...prev,
        privateKey: generated?.guardianPrivateKey || '',
        publicKey: generated?.guardianPublicKey || '',
        polynomial: generated?.guardianPolynomial || '',
        keyBackup: generated?.guardianKeyBackup || '',
      }));
      setKeyCeremonyUiMessage('Credentials generated. Review and submit Round 1.');
    } catch (err) {
      setKeyCeremonyUiError(err.message || 'Failed to generate credentials');
    } finally {
      setKeyCeremonyBusy((prev) => ({ ...prev, generatingCredentials: false }));
    }
  };

  const handleSubmitKeyCeremonyRound1 = async () => {
    if (!guardianCeremonyForm.publicKey?.trim()) {
      setKeyCeremonyUiError('Guardian public key is required');
      return;
    }
    if (!guardianCeremonyForm.privateKey?.trim()) {
      setKeyCeremonyUiError('Guardian private key is required');
      return;
    }
    if (!guardianCeremonyForm.polynomial?.trim()) {
      setKeyCeremonyUiError('Guardian polynomial is required');
      return;
    }
    if (!guardianCeremonyForm.localEncryptionPassword?.trim()) {
      setKeyCeremonyUiError('Local encryption password is required');
      return;
    }

    try {
      setKeyCeremonyUiError('');
      setKeyCeremonyUiMessage('');
      setKeyCeremonyBusy((prev) => ({ ...prev, submittingRound1: true }));
      const response = await electionApi.submitGuardianKeyCeremony(
        id,
        guardianCeremonyForm.privateKey,
        guardianCeremonyForm.publicKey,
        guardianCeremonyForm.polynomial,
        guardianCeremonyForm.localEncryptionPassword,
        guardianCeremonyForm.keyBackup
      );

      if (response?.encryptedCredential) {
        triggerAutoCredentialDownload({ electionId: id, encryptedCredential: response.encryptedCredential });
      }

      setKeyCeremonyUiMessage('Round 1 submitted successfully. Guardian credential file downloaded.');
      await fetchElectionData();
      await loadKeyCeremonyProgress();
    } catch (err) {
      setKeyCeremonyUiError(err.message || 'Failed to submit Round 1');
    } finally {
      setKeyCeremonyBusy((prev) => ({ ...prev, submittingRound1: false }));
    }
  };

  const handleBackupCredentialFileLoad = async (file) => {
    if (!file) return;
    try {
      const content = await file.text();
      setBackupCeremonyForm((prev) => ({
        ...prev,
        credentialContent: content,
        credentialFileName: file.name,
      }));
      setKeyCeremonyUiError('');
      setKeyCeremonyUiMessage('Credential file loaded.');
    } catch (err) {
      setKeyCeremonyUiError(err.message || 'Failed to read credential file');
    }
  };

  const handleGenerateBackupShares = async () => {
    if (!backupCeremonyForm.credentialContent?.trim()) {
      setKeyCeremonyUiError('Upload your guardian credential file first');
      return;
    }

    try {
      setKeyCeremonyUiError('');
      setKeyCeremonyUiMessage('');
      setKeyCeremonyBusy((prev) => ({ ...prev, generatingBackup: true }));
      const generated = await electionApi.generateGuardianBackupShares(id, backupCeremonyForm.credentialContent.trim());
      setBackupCeremonyForm((prev) => ({
        ...prev,
        generatedGuardianData: JSON.stringify(generated?.guardianData || {}, null, 2),
      }));
      setKeyCeremonyUiMessage(`Backup shares generated for ${generated?.backupCount || 0} guardian(s).`);
    } catch (err) {
      setKeyCeremonyUiError(err.message || 'Failed to generate backup shares');
    } finally {
      setKeyCeremonyBusy((prev) => ({ ...prev, generatingBackup: false }));
    }
  };

  const handleSubmitBackupShares = async () => {
    if (!backupCeremonyForm.generatedGuardianData?.trim()) {
      setKeyCeremonyUiError('Generate backup shares before submitting');
      return;
    }

    try {
      setKeyCeremonyUiError('');
      setKeyCeremonyUiMessage('');
      setKeyCeremonyBusy((prev) => ({ ...prev, submittingBackup: true }));
      await electionApi.submitGuardianBackupShares(id, backupCeremonyForm.generatedGuardianData.trim());
      setKeyCeremonyUiMessage('Round 2 backup shares submitted successfully.');
      await fetchElectionData();
      await loadKeyCeremonyProgress();
    } catch (err) {
      setKeyCeremonyUiError(err.message || 'Failed to submit backup shares');
    } finally {
      setKeyCeremonyBusy((prev) => ({ ...prev, submittingBackup: false }));
    }
  };

  const canManageElectionPrivacy = () =>
    electionData?.userRoles?.includes('admin') || electionData?.userRoles?.includes('guardian');

  const canManageBallotReceiptSetting = () =>
    electionData?.userRoles?.includes('admin');

  const canEditElectionDescription = () =>
    electionData?.userRoles?.includes('admin') &&
    (!electionData?.startingTime || new Date(electionData.startingTime) > new Date());

  const canEditVotingRules = () => canEditElectionDescription();

  const canEditElectionSchedule = () =>
    canEditElectionDescription() &&
    electionData?.startingTime &&
    electionData?.endingTime;

  const candidateCountForElection = () =>
    electionData?.electionChoices?.length || electionData?.noOfCandidates || 0;

  const handleSaveVotingRules = async () => {
    const candidateCount = candidateCountForElection();
    const maxChoicesVal = parseInt(maxChoicesDraft, 10);
    const winnerNoVal = parseInt(winnerNoDraft, 10);

    if (Number.isNaN(maxChoicesVal) || maxChoicesVal < 1) {
      toast.error('Max choices must be at least 1');
      return;
    }
    if (maxChoicesVal > candidateCount) {
      toast.error(`Max choices cannot exceed ${candidateCount} candidates`);
      return;
    }
    if (Number.isNaN(winnerNoVal) || winnerNoVal < 1) {
      toast.error('Number of winners must be at least 1');
      return;
    }
    if (winnerNoVal > candidateCount) {
      toast.error(`Number of winners cannot exceed ${candidateCount} candidates`);
      return;
    }

    try {
      setSettingsSaving(true);
      const response = await electionApi.updateElectionSettings(id, {
        maxChoices: maxChoicesVal,
        winnerNo: winnerNoVal,
      });
      if (response?.election) {
        setElectionData(response.election);
      }
      setEditingVotingRules(false);
      toast.success('Voting rules updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update voting rules');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    try {
      setSettingsSaving(true);
      const response = await electionApi.updateElectionSettings(id, {
        electionDescription: descriptionDraft,
      });
      if (response?.election) {
        setElectionData(response.election);
      }
      setEditingDescription(false);
      toast.success('Election description updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update description');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleDraft.startingTime || !scheduleDraft.endingTime) {
      toast.error('Start and end time are both required');
      return;
    }

    const startingTime = timezoneUtils.fromLocalInputValue(scheduleDraft.startingTime);
    const endingTime = timezoneUtils.fromLocalInputValue(scheduleDraft.endingTime);
    if (!startingTime || !endingTime) {
      toast.error('Invalid start or end time');
      return;
    }
    if (new Date(endingTime) <= new Date(startingTime)) {
      toast.error('End time must be after start time');
      return;
    }
    if (new Date(startingTime) <= new Date()) {
      toast.error('Start time must be in the future');
      return;
    }

    try {
      setSettingsSaving(true);
      const response = await electionApi.updateElectionSettings(id, {
        startingTime,
        endingTime,
      });
      if (response?.election) {
        setElectionData(response.election);
      }
      setEditingSchedule(false);
      toast.success('Election schedule updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update election schedule');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleUpdateElectionSettings = async (settings) => {
    try {
      setSettingsSaving(true);
      const response = await electionApi.updateElectionSettings(id, settings);
      if (response?.election) {
        setElectionData(response.election);
      }
      toast.success('Election settings updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update election settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleActivateElectionFromGuardianTab = async () => {
    if (!activationSchedule.startingTime || !activationSchedule.endingTime) {
      toast.error('Start and end time are required to activate election');
      return;
    }

    try {
      setActivatingElection(true);
      await electionApi.activateElectionAfterCeremony(
        id,
        new Date(activationSchedule.startingTime).toISOString(),
        new Date(activationSchedule.endingTime).toISOString()
      );
      toast.success('Election activated successfully');
      setActivationSchedule({ startingTime: '', endingTime: '' });
      await fetchElectionData();
    } catch (err) {
      toast.error(err.message || 'Failed to activate election');
    } finally {
      setActivatingElection(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-frost-mesh flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
          <p className="mt-4 text-dusk">Loading election data...</p>
          {creatingTally && <p className="text-sm text-brand">Creating tally...</p>}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-frost-mesh flex items-center justify-center">
        <div className="text-center p-8 glass-panel max-w-md">
          <FiAlertCircle className="h-12 w-12 text-ember mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-ink mb-2">Access Denied</h2>
          <p className="text-dusk">{error}</p>
        </div>
      </div>
    );
  }

  if (!electionData) {
    return (
      <div className="min-h-screen bg-frost-mesh flex items-center justify-center">
        <div className="text-center p-8 glass-panel max-w-md">
          <FiInfo className="h-12 w-12 text-dusk mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-ink mb-2">No Data</h2>
          <p className="text-dusk">No election data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-frost-mesh">
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
        onStatusChange={setTallyStatus}
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

      <BallotWorkflowModal
        isOpen={ballotModalOpen}
        phase={ballotModalPhase}
        onClose={handleBallotModalClose}
        encryptedBallotData={encryptedBallotData}
        voteResult={voteResult}
        challengeResult={challengeResult}
        createBallotError={createBallotError}
        castBallotError={castBallotError}
        challengeError={challengeError}
        electionData={electionData}
        selectedCandidates={selectedCandidates}
        challengeCandidateChoices={challengeCandidateChoices}
        onChallengeCandidateToggle={handleChallengeCandidateToggle}
        onCastVote={handleCastEncryptedBallot}
        onStartChallenge={handleStartChallenge}
        onConfirmChallenge={handleConfirmChallenge}
        onDiscard={resetBallotWorkflow}
        onDownloadFile={downloadFile}
        onDownloadBallotInfo={downloadBallotInfo}
        onCopyToClipboard={copyToClipboard}
        onSaveVoteDetails={saveVoteDetails}
      />
      
      {/* Header */}
      <header className="border-b border-ink/10 bg-paper/90 backdrop-blur-md shadow-soft">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-3 sm:gap-4">
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <p className="section-kicker mb-1">Election</p>
              <h1 className="font-display text-xl sm:text-2xl md:text-[1.65rem] font-bold text-deep truncate">{electionData.electionTitle}</h1>
              <p className="mt-0.5 text-xs sm:text-sm text-dusk font-mono truncate">ID {electionData.electionId}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dusk">
                <span className="inline-flex items-center gap-1">
                  <FiMail className="h-3 w-3 shrink-0 text-brand" />
                  <span className="font-medium text-dusk">Admin</span>
                  <span className="truncate">{electionData.adminEmail}</span>
                </span>
                {electionData.coAdminEmails?.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <FiUsers className="h-3 w-3 shrink-0 text-brand" />
                    <span className="font-medium text-dusk">Co-Admins</span>
                    <span className="truncate">{electionData.coAdminEmails.join(', ')}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
              <span className={`status-chip capitalize ${
                getElectionStatus() === 'ongoing' || getElectionStatus() === 'active'
                  ? 'status-chip-active'
                  : getElectionStatus() === 'upcoming' || getElectionStatus() === 'scheduled' || getElectionStatus() === 'key_ceremony_pending'
                    ? 'status-chip-pending'
                    : 'status-chip-ended'
              }`}>
                {getElectionStatus()?.replace(/_/g, ' ')}
              </span>
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-frost px-2.5 py-1.5 text-xs sm:text-sm text-dusk">
                <FiUser className="h-3.5 w-3.5 text-brand" />
                <span className="truncate max-w-[160px] sm:max-w-none">
                  {
                    (() => {
                      const roles = [...(electionData.userRoles || [])];
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
      <ElectionTabNav
        tabs={subMenus.filter((menu) => {
          // Role-gated tools stay restricted; process/audit tabs stay visible for everyone.
          if (menu.adminOnly && !electionData?.userRoles?.includes('admin')) {
            return false;
          }
          if (menu.guardianOnly && !canUserManageGuardian()) {
            return false;
          }
          return true;
        })}
        activeKey={activeTab}
        onSelect={handleTabClick}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 page-enter">
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
            <div className="surface-card p-4 sm:p-6">
              <h3 className="font-display text-base sm:text-lg font-semibold text-deep mb-3 sm:mb-4 flex items-center">
                <FiInfo className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-brand" />
                Election Details
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h4 className="font-medium text-deep mb-2">Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Title:</span> {electionData.electionTitle}</p>
                    <div>
                      <span className="font-medium">Description:</span>{' '}
                      {canEditElectionDescription() && editingDescription ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={descriptionDraft}
                            onChange={(e) => setDescriptionDraft(e.target.value)}
                            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={settingsSaving}
                              onClick={handleSaveDescription}
                              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-paper hover:bg-brand-dark disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDescription(false);
                                setDescriptionDraft(electionData.electionDescription || '');
                              }}
                              className="rounded-md border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink hover:bg-frost"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span>
                          {electionData.electionDescription || 'No description provided'}
                          {canEditElectionDescription() && (
                            <button
                              type="button"
                              onClick={() => {
                                setDescriptionDraft(electionData.electionDescription || '');
                                setEditingDescription(true);
                              }}
                              className="ml-2 text-xs font-medium text-brand hover:underline"
                            >
                              Edit
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    <p><span className="font-medium">Status:</span> {timezoneUtils.getElectionStatusLabel(electionData.status, electionData.startingTime, electionData.endingTime)}</p>
                    <div>
                      <span className="font-medium">Privacy:</span>{' '}
                      {canManageElectionPrivacy() ? (
                        <span className="inline-flex flex-wrap items-center gap-3 ml-1">
                          <label className="inline-flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name="electionPrivacy"
                              checked={electionData.isPublic}
                              disabled={settingsSaving}
                              onChange={() => handleUpdateElectionSettings({ privacy: 'public' })}
                            />
                            Public
                          </label>
                          <label className="inline-flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name="electionPrivacy"
                              checked={!electionData.isPublic}
                              disabled={settingsSaving}
                              onChange={() => handleUpdateElectionSettings({ privacy: 'private' })}
                            />
                            Private
                          </label>
                        </span>
                      ) : (
                        electionData.isPublic ? 'Public' : 'Private'
                      )}
                    </div>
                    <p><span className="font-medium">Voting Eligibility:</span> {electionData.eligibility === 'listed' ? 'Listed voters only' : 'Open to anyone'}</p>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Voting rules:</span>
                        {canEditVotingRules() && !editingVotingRules && (
                          <button
                            type="button"
                            onClick={() => {
                              setMaxChoicesDraft(String(electionData.maxChoices || 1));
                              setWinnerNoDraft(String(getWinnerCount(electionData)));
                              setEditingVotingRules(true);
                            }}
                            className="text-xs font-medium text-brand hover:underline"
                          >
                            Edit
                          </button>
                        )}
                        {canEditVotingRules() && editingVotingRules && (
                          <span className="inline-flex gap-2">
                            <button
                              type="button"
                              disabled={settingsSaving}
                              onClick={handleSaveVotingRules}
                              className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingVotingRules(false)}
                              className="text-xs font-medium text-dusk hover:underline"
                            >
                              Cancel
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-1 text-sm">
                        <p>
                          <span className="text-dusk">Max choices per voter:</span>{' '}
                          {canEditVotingRules() && editingVotingRules ? (
                            <input
                              type="number"
                              min={1}
                              max={candidateCountForElection()}
                              value={maxChoicesDraft}
                              onChange={(e) => setMaxChoicesDraft(e.target.value)}
                              className="w-20 rounded-md border border-ink/10 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-glacier text-ink">
                              {electionData.maxChoices || 1} {electionData.maxChoices === 1 ? 'choice' : 'choices'}
                            </span>
                          )}
                        </p>
                        <p>
                          <span className="text-dusk">Number of winners:</span>{' '}
                          {canEditVotingRules() && editingVotingRules ? (
                            <input
                              type="number"
                              min={1}
                              max={candidateCountForElection()}
                              value={winnerNoDraft}
                              onChange={(e) => setWinnerNoDraft(e.target.value)}
                              className="w-20 rounded-md border border-ink/10 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-ceremonial-soft text-ink">
                              Top {getWinnerCount(electionData)} candidate{getWinnerCount(electionData) === 1 ? '' : 's'}
                            </span>
                          )}
                        </p>
                        {canEditVotingRules() && (
                          <p className="text-xs text-dusk">Editable until the election begins.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Ballot receipt emails:</span>{' '}
                      {canManageBallotReceiptSetting() ? (
                        <label className="inline-flex items-center gap-2 ml-1 text-sm">
                          <input
                            type="checkbox"
                            checked={!!electionData.sendBallotReceipt}
                            disabled={settingsSaving}
                            onChange={(e) =>
                              handleUpdateElectionSettings({ sendBallotReceipt: e.target.checked })
                            }
                          />
                          Send receipt by email after voting
                        </label>
                      ) : (
                        electionData.sendBallotReceipt ? 'Enabled' : 'Disabled'
                      )}
                    </div>
                    <p><span className="font-medium">Admin:</span> {electionData.adminName ? `${electionData.adminName} (${electionData.adminEmail})` : electionData.adminEmail}</p>
                    {electionData.coAdminEmails?.length > 0 && (
                      <p>
                        <span className="font-medium">Co-Admins:</span>{' '}
                        {electionData.coAdminEmails.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-deep mb-2">Timeline</h4>
                  <div className="space-y-2 text-sm">
                    {canEditElectionSchedule() && editingSchedule ? (
                      <div className="space-y-3 rounded-lg border border-glacier bg-glacier/50 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-dusk">Election Start</span>
                            <input
                              type="datetime-local"
                              value={scheduleDraft.startingTime}
                              onChange={(e) => setScheduleDraft((prev) => ({ ...prev, startingTime: e.target.value }))}
                              className="w-full px-3 py-2 border border-ink/10 rounded-md focus:border-brand outline-none bg-paper"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-dusk">Election End</span>
                            <input
                              type="datetime-local"
                              value={scheduleDraft.endingTime}
                              onChange={(e) => setScheduleDraft((prev) => ({ ...prev, endingTime: e.target.value }))}
                              className="w-full px-3 py-2 border border-ink/10 rounded-md focus:border-brand outline-none bg-paper"
                            />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={settingsSaving}
                            onClick={handleSaveSchedule}
                            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-paper hover:bg-brand-dark disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSchedule(false)}
                            className="rounded-md border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink hover:bg-frost"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="flex items-center flex-wrap gap-1">
                          <FiCalendar className="h-4 w-4 mr-1" />
                          <span className="font-medium">Starts:</span> {formatDate(electionData.startingTime)}
                          {canEditElectionSchedule() && (
                            <button
                              type="button"
                              onClick={() => {
                                setScheduleDraft({
                                  startingTime: timezoneUtils.toLocalInputValue(electionData.startingTime),
                                  endingTime: timezoneUtils.toLocalInputValue(electionData.endingTime),
                                });
                                setEditingSchedule(true);
                              }}
                              className="ml-2 text-xs font-medium text-brand hover:underline"
                            >
                              Edit
                            </button>
                          )}
                        </p>
                        <p className="flex items-center flex-wrap gap-1"><FiCalendar className="h-4 w-4 mr-1" /><span className="font-medium">Ends:</span> {formatDate(electionData.endingTime)}</p>
                      </>
                    )}
                    <p className="flex items-center flex-wrap gap-1"><FiClock className="h-4 w-4 mr-1" /><span className="font-medium">Created:</span> {formatDate(electionData.createdAt)}</p>
                    <p className="text-xs text-dusk">Times shown in your timezone: {timezoneUtils.getTimezoneLabel()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-ink/10 pt-4">
                <h4 className="font-medium text-deep mb-3">Guardian Configuration</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg border border-green-100 bg-sage-soft p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sage">Guardian Number</p>
                    <p className="mt-1 text-lg font-semibold text-green-900">
                      {electionData.totalGuardians || electionData.guardians?.length || 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-ceremonial-soft p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">Quorum Number</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{electionData.electionQuorum || 0}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-ink mb-2">Guardians (Emails)</p>
                  {electionData.guardians && electionData.guardians.length > 0 ? (
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-ink/10 bg-frost p-2">
                      <div className="space-y-2">
                        {electionData.guardians.map((guardian, index) => (
                          <div
                            key={guardian.userEmail || `${guardian.userName || 'guardian'}-${index}`}
                            className="flex items-center justify-between rounded-md border border-ink/10 bg-paper px-3 py-2"
                          >
                            <span className="text-sm text-deep">{guardian.userName || `Guardian ${index + 1}`}</span>
                            <span className="text-xs text-dusk break-all ml-3">{guardian.userEmail || 'No email available'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-ink/10 bg-frost p-3 text-sm text-dusk">
                      No guardian emails available.
                    </div>
                  )}
                </div>
              </div>

              {isElectionFinished() && isTallyComplete && (
                <div className="mt-6">
                  <GuardianProgressPanel
                    electionId={Number(id)}
                    guardians={electionData?.guardians || []}
                    onElectionRefresh={fetchElectionData}
                  />
                </div>
              )}
            </div>

            {/* Election Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="surface-card p-4 sm:p-6">
                <div className="flex items-center">
                  <FiUsers className="h-6 w-6 sm:h-8 sm:w-8 text-brand" />
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-dusk">Total Voters</p>
                    <p className="text-xl sm:text-2xl font-semibold text-deep">{getTotalVoters(electionData)}</p>
                  </div>
                </div>
              </div>
              <div className="surface-card p-4 sm:p-6">
                <div className="flex items-center">
                  <FiShield className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-dusk">Guardians</p>
                    <p className="text-xl sm:text-2xl font-semibold text-deep">{electionData.guardians?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="surface-card p-4 sm:p-6">
                <div className="flex items-center">
                  <FiKey className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" />
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-dusk">Quorum</p>
                    <p className="text-xl sm:text-2xl font-semibold text-deep">{electionData.electionQuorum || 0}</p>
                  </div>
                </div>
              </div>
              <div className="surface-card p-4 sm:p-6">
                <div className="flex items-center">
                  <FiCheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-brand" />
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-dusk">Candidates</p>
                    <p className="text-xl sm:text-2xl font-semibold text-deep">{electionData.electionChoices?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Candidates */}
            <div className="surface-card p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Candidates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {electionData.electionChoices?.map((choice) => (
                  <div key={choice.choiceId} className="rounded-xl border border-ink/10 bg-frost/50 p-3 sm:p-4">
                    <CandidateIdentity
                      name={choice.optionTitle}
                      image={choice.candidatePic}
                      description={choice.optionDescription}
                      partyName={choice.partyName}
                      size="xl"
                      enableProfile
                      showInlineDescription
                      nameClassName="font-display text-sm sm:text-base font-semibold text-deep"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Voter summary — counts visible to all; full email list only for authorized roles */}
            {(canEditVoterList() || getTotalVoters(electionData) > 0 || getVotedCount(electionData) > 0) && (
              <div className="surface-card p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-base sm:text-lg font-semibold flex items-center">
                    <FiUsers className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-brand" />
                    {electionData.eligibility === 'listed' ? 'Eligible Voters' : 'Voters Who Participated'}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {electionData.eligibility === 'listed' ? (
                      <>
                        <span className="px-2.5 py-1 text-xs font-semibold bg-glacier text-brand-dark rounded-full">
                          {getTotalVoters(electionData)} eligible
                        </span>
                        <span className="px-2.5 py-1 text-xs font-semibold bg-sage-soft text-sage rounded-full">
                          {getVotedCount(electionData)} voted
                        </span>
                      </>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-semibold bg-sage-soft text-sage rounded-full">
                        {getVotedCount(electionData)} participated
                      </span>
                    )}
                    {canEditVoterList() && (
                      <button
                        type="button"
                        onClick={handleToggleVoterEditor}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-dark text-paper hover:bg-ink transition-colors"
                      >
                        {showVoterEditor ? 'Hide Editor' : 'Edit Voter List'}
                      </button>
                    )}
                    {canViewVoterList() && !showVoterEditor && (getTotalVoters(electionData) > 0 || getVotedCount(electionData) > 0) && (
                      <button
                        type="button"
                        onClick={handleToggleVoterList}
                        disabled={votersLoading}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-dark text-paper hover:bg-brand-dark transition-colors disabled:opacity-60"
                      >
                        {votersLoading ? (
                          <>
                            <FiLoader className="h-3.5 w-3.5 animate-spin" />
                            Loading...
                          </>
                        ) : showVoterList ? (
                          'Hide Voters'
                        ) : (
                          'Show Voters'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {canEditVoterList() && showVoterEditor && (
                  <div className="mb-6 rounded-xl border border-brand/25 bg-gradient-to-br from-glacier/70 via-white to-sky-50 p-4 sm:p-5">
                    {votersLoading && !electionData.voters?.length ? (
                      <div className="flex items-center justify-center py-8 text-sm text-ink">
                        <FiLoader className="mr-2 h-4 w-4 animate-spin" />
                        Loading voter list...
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-deep">
                            {canRemoveVoters()
                              ? 'Manage eligible voters'
                              : 'Add voters to this election'}
                          </h4>
                          <p className="text-xs text-ink mt-1">
                            {canRemoveVoters()
                              ? 'Add voters individually or import CSV/TXT files. Imports append to the existing list without removing current voters.'
                              : 'The election has started, so voters can only be added — existing emails cannot be removed.'}
                          </p>
                        </div>
                        <VoterListEditor
                          emails={voterEmails}
                          onChange={handleVoterListChange}
                          onRemove={handleRemoveVoter}
                          onRemoveAll={handleRemoveAllVoters}
                          allowRemove={canRemoveVoters()}
                          disabled={voterListSaving}
                          maxHeightClass="max-h-96"
                          emptyMessage="No voters added yet. Start building your voter list."
                        />
                      </>
                    )}
                  </div>
                )}

                {electionData.eligibility === 'listed' && getTotalVoters(electionData) > 0 && (
                  <div className="mb-4 p-3 bg-glacier rounded-lg border border-glacier">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-brand-dark font-medium">Participation</span>
                      <span className="text-ink font-bold">
                        {getVotedCount(electionData)} / {getTotalVoters(electionData)}
                        {' '}({getTotalVoters(electionData) > 0
                          ? ((getVotedCount(electionData) / getTotalVoters(electionData)) * 100).toFixed(1)
                          : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-paper rounded-full h-2 border border-brand/20">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-brand to-brand-dark transition-all duration-700"
                        style={{ width: `${getTotalVoters(electionData) > 0 ? (getVotedCount(electionData) / getTotalVoters(electionData)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {canViewVoterList() && !showVoterEditor && !showVoterList && (getTotalVoters(electionData) > 0 || getVotedCount(electionData) > 0) && (
                  <p className="text-sm text-dusk">
                    {getTotalVoters(electionData) > 0
                      ? `This election has ${getTotalVoters(electionData).toLocaleString()} registered voter${getTotalVoters(electionData) === 1 ? '' : 's'}. Click "Show Voters" to load the full list.`
                      : `${getVotedCount(electionData).toLocaleString()} voter${getVotedCount(electionData) === 1 ? ' has' : 's have'} participated. Click "Show Voters" to load the list.`}
                  </p>
                )}

                {canViewVoterList() && !showVoterEditor && showVoterList && (electionData.voters || []).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
                    {sortVotersVotedFirst(
                      electionData.eligibility === 'listed'
                        ? electionData.voters
                        : electionData.voters.filter(v => v.hasVoted)
                    ).map((voter, index) => (
                      <div
                        key={voter.userEmail || index}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                          voter.hasVoted || electionData.eligibility !== 'listed'
                            ? 'bg-sage-soft border-aurora/30 hover:border-green-300'
                            : 'bg-frost border-ink/10 hover:border-ink/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            voter.hasVoted || electionData.eligibility !== 'listed' ? 'bg-aurora' : 'bg-ink/20'
                          }`}>
                            <FiUser className="h-3.5 w-3.5 text-paper" />
                          </div>
                          <span className="text-xs sm:text-sm text-ink truncate font-medium">{voter.userEmail}</span>
                        </div>
                        {electionData.eligibility === 'listed' ? (
                          voter.hasVoted ? (
                            <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-sage-soft text-sage rounded-full border border-aurora/30">
                              <FiCheckCircle className="h-3 w-3" /> Voted
                            </span>
                          ) : (
                            <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-frost-muted text-dusk rounded-full">
                              <FiClock className="h-3 w-3" /> Pending
                            </span>
                          )
                        ) : (
                          <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-sage-soft text-sage rounded-full border border-aurora/30">
                            <FiCheckCircle className="h-3 w-3" /> Voted
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Voting Booth Tab */}
        {activeTab === 'voting' && (
          <div className="surface-card p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <p className="section-kicker">Ballot</p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-deep flex items-center gap-2">
                <FiCheckCircle className="h-5 w-5 text-brand" />
                Voting Booth
              </h3>
              <p className="mt-1 text-sm text-dusk">
                Select candidates, encrypt your ballot, then cast or challenge it.
              </p>
            </div>

            {/* Eligibility Loading */}
            {checkingEligibility && (
              <div className="text-center py-8">
                <FiLoader className="h-8 w-8 text-brand mx-auto mb-4 animate-spin" />
                <p className="text-dusk">Checking your eligibility to vote...</p>
              </div>
            )}

            {/* Eligibility Status Display */}
            {!checkingEligibility && eligibilityData && (
              <div className={`border rounded-lg p-4 mb-6 ${eligibilityData.eligible
                  ? 'bg-sage-soft border-aurora/30'
                  : eligibilityData.hasVoted
                    ? 'bg-glacier border-brand/20'
                    : 'bg-ember-soft border-ember/30'
                }`}>
                <div className="flex items-center">
                  {eligibilityData.eligible ? (
                    <FiCheckCircle className="h-6 w-6 text-green-500 mr-3" />
                  ) : eligibilityData.hasVoted ? (
                    <FiCheckCircle className="h-6 w-6 text-brand mr-3" />
                  ) : (
                    <FiAlertCircle className="h-6 w-6 text-ember mr-3" />
                  )}
                  <div>
                    <h4 className={`font-semibold ${eligibilityData.eligible
                        ? 'text-green-900'
                        : eligibilityData.hasVoted
                          ? 'text-deep'
                          : 'text-red-900'
                      }`}>
                      {eligibilityData.message}
                    </h4>
                    <p className={`text-sm ${eligibilityData.eligible
                        ? 'text-aurora-muted'
                        : eligibilityData.hasVoted
                          ? 'text-ink'
                          : 'text-ember'
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
                  ? 'bg-frost border-ink/10'
                  : botDetection.error
                    ? 'bg-ceremonial-soft border-yellow-200'
                    : botDetection.isBot
                      ? 'bg-ember-soft border-ember/30'
                      : 'bg-sage-soft border-aurora/30'
                }`}>
                <div className="flex items-center">
                  {botDetection.loading ? (
                    <FiLoader className="h-5 w-5 text-dusk mr-3 animate-spin" />
                  ) : botDetection.error ? (
                    <FiAlertCircle className="h-5 w-5 text-yellow-500 mr-3" />
                  ) : botDetection.isBot ? (
                    <FiX className="h-5 w-5 text-ember mr-3" />
                  ) : (
                    <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  )}
                  <div>
                    <h4 className={`font-medium ${botDetection.loading
                        ? 'text-deep'
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
                        ? 'text-dusk'
                        : botDetection.error
                          ? 'text-ink'
                          : botDetection.isBot
                            ? 'text-ember'
                            : 'text-aurora-muted'
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

            {voteError && (
              <VoterStatusSlot
                variant="error"
                title="Vote Submission Unavailable"
                message={voteError}
              />
            )}

            {/* Candidate selection — always visible; ballot action blurred when voting is unavailable */}
            {!checkingEligibility && electionData?.electionChoices && (
              <div className="mb-6">
                {(() => {
                  const maxChoices = electionData.maxChoices || 1;
                  const electionOngoing = getElectionStatus() === 'ongoing';
                  const canCreateBallot = !!eligibilityData?.eligible
                    && !voteResult
                    && electionOngoing
                    && !botDetection.loading
                    && !botDetection.isBot;

                  return (
                    <>
                      <div className="bg-ceremonial-soft border border-yellow-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center">
                          <FiInfo className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" />
                          <div>
                            <h4 className="font-medium text-yellow-900">Voting Instructions</h4>
                            <p className="text-sm text-ink mt-1">
                              {maxChoices > 1
                                ? `Select up to ${maxChoices} candidates, then create your encrypted ballot.`
                                : 'Select one candidate, then create your encrypted ballot.'}
                              {' '}You may vote only once in this election.
                            </p>
                            <p className="text-xs text-yellow-700 mt-2 font-medium">
                              Max choices allowed: {maxChoices} · Winners declared: top {getWinnerCount(electionData)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="max-w-2xl">
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-ink mb-3">
                            {maxChoices > 1
                              ? `Select up to ${maxChoices} candidate(s): (${selectedCandidates.length}/${maxChoices} selected)`
                              : 'Select your candidate:'}
                          </label>
                          <div className="space-y-2">
                            {electionData.electionChoices?.map((choice) => {
                              const isSelected = selectedCandidates.includes(choice.choiceId.toString());
                              const isDisabled = !isSelected && selectedCandidates.length >= maxChoices;
                              const choiceIdStr = choice.choiceId.toString();
                              return (
                                <div
                                  key={choice.choiceId}
                                  role="button"
                                  tabIndex={isDisabled ? -1 : 0}
                                  onClick={() => {
                                    if (isDisabled) return;
                                    handleCandidateToggle(choiceIdStr);
                                  }}
                                  onKeyDown={(event) => {
                                    if (isDisabled) return;
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      handleCandidateToggle(choiceIdStr);
                                    }
                                  }}
                                  className={`flex items-center gap-3 py-3 px-3.5 rounded-xl border transition-all ${
                                    isDisabled
                                      ? 'opacity-50 cursor-not-allowed border-ink/10'
                                      : isSelected
                                        ? 'cursor-pointer selected-ballot'
                                        : 'cursor-pointer border-ink/10 hover:border-brand/40 hover:bg-glacier/40'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                    tabIndex={-1}
                                    aria-hidden
                                    className="pointer-events-none h-4 w-4 text-brand border-ink/10 rounded flex-shrink-0"
                                  />
                                  <div
                                    className="min-w-0 flex-1"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <CandidateIdentity
                                      name={choice.optionTitle}
                                      image={choice.candidatePic}
                                      description={choice.optionDescription}
                                      partyName={choice.partyName}
                                      size="md"
                                      enableProfile
                                      nameClassName="text-sm sm:text-base text-deep leading-snug"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-3">
                          {!canCreateBallot && (
                            <p className="text-sm text-dusk text-center max-w-md">
                              {!electionOngoing
                                ? (getElectionStatus() === 'finished'
                                  ? 'Voting has ended for this election.'
                                  : `Voting opens on ${formatDate(electionData.startingTime)}.`)
                                : eligibilityData?.hasVoted
                                  ? 'You have already voted in this election.'
                                  : eligibilityData?.message || 'You are not eligible to vote in this election.'}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenConfirmModal(canCreateBallot)}
                            disabled={!canCreateBallot || !selectedCandidates.length || ballotModalOpen}
                            className={`px-8 py-3 rounded-lg font-medium text-paper transition-colors ${
                              !canCreateBallot || !selectedCandidates.length || ballotModalOpen
                                ? 'bg-ink/30 cursor-not-allowed'
                                : 'bg-brand-dark hover:bg-brand active:bg-ink'
                            }`}
                          >
                            {botDetection.loading ? (
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
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Legacy voting-not-available block removed — status shown inline above */}
          </div>
        )}

        {/* Encrypted Ballot Confirmation Modal */}
        {showConfirmModal && (
          <ModalOverlay onClose={() => setShowConfirmModal(false)} dismissible>
            <ModalPanel size="md" className="shadow-lift">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ballot-confirm-title"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="shrink-0 border-b border-ink/10 px-5 py-4 sm:px-6 sm:py-5">
                <p className="section-kicker">Before encryption</p>
                <h3 id="ballot-confirm-title" className="mt-1 font-display text-xl font-bold text-deep sm:text-2xl">
                  Create encrypted ballot?
                </h3>
                <p className="mt-1.5 text-sm text-dusk">
                  Confirm these are the choice{selectedCandidates.length === 1 ? "" : "s"} you want encrypted.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-dusk">
                  Your selection{selectedCandidates.length === 1 ? "" : "s"}
                </p>
                <ul className="space-y-2">
                  {electionData.electionChoices
                    ?.filter((choice) => selectedCandidates.includes(String(choice.choiceId)))
                    .map((choice) => (
                      <li
                        key={choice.choiceId}
                        className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-glacier/60 px-3.5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <CandidateIdentity
                            name={choice.optionTitle}
                            image={choice.candidatePic}
                            description={choice.optionDescription}
                            partyName={choice.partyName}
                            size="md"
                            enableProfile
                            nameClassName="font-display text-sm font-semibold text-deep sm:text-base"
                          />
                        </div>
                        <FiCheckCircle className="h-5 w-5 shrink-0 text-brand" />
                      </li>
                    ))}
                </ul>
                {(!electionData.electionChoices ||
                  electionData.electionChoices.filter((c) =>
                    selectedCandidates.includes(String(c.choiceId))
                  ).length === 0) && (
                  <p className="rounded-xl border border-ceremonial/40 bg-ceremonial-soft px-3 py-2 text-sm text-ink">
                    No choices detected. Go back and select again.
                  </p>
                )}

                <div className="mt-4 rounded-xl border border-ceremonial/40 bg-ceremonial-soft/70 px-3.5 py-3 text-sm text-ink">
                  After you confirm, AmarVote encrypts this ballot. You can cast it or challenge it next.
                </div>
              </div>

              <div className="shrink-0 flex flex-col-reverse gap-2 border-t border-ink/10 bg-paper/90 px-5 py-4 sm:flex-row sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="btn-ghost flex-1"
                >
                  Go back
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowConfirmModal(false);
                    await handleCreateEncryptedBallot();
                  }}
                  disabled={
                    isSubmitting ||
                    !electionData.electionChoices?.some((c) =>
                      selectedCandidates.includes(String(c.choiceId))
                    )
                  }
                  className="btn-brand flex-1"
                >
                  Confirm & encrypt
                </button>
              </div>
            </div>
            </ModalPanel>
          </ModalOverlay>
        )}

        {/* Guardian Keys Tab */}
        {activeTab === 'guardian' && (
          <div className="surface-card p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <p className="section-kicker">Guardians</p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-deep flex items-center gap-2">
                <FiShield className="h-5 w-5 text-brand" />
                Guardian Workflow
              </h3>
              <p className="mt-1 text-sm text-dusk">
                Key ceremony, partial decryption, and threshold combination for this election.
              </p>
            </div>
            <div className="space-y-6">
                {electionData?.status === 'key_ceremony_pending' && (
                  <div className="observatory-panel p-5 sm:p-6">
                    <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark">Authority</p>
                        <h4 className="mt-1 font-display text-lg font-semibold text-ink">Key ceremony</h4>
                        <p className="mt-1 text-sm text-dusk">{getKeyCeremonyProgressMessage()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                          Guardians: {electionData.numberOfGuardians}
                        </span>
                        <span className="inline-flex items-center rounded-lg border border-threshold/35 bg-threshold/10 px-2.5 py-1 text-xs font-semibold text-threshold">
                          Threshold: {electionData.electionQuorum} of {electionData.numberOfGuardians}
                        </span>
                      </div>
                    </div>

                    {isKeyCeremonyPending && (
                      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <GuardianQuorumViz
                          mode={getKeyCeremonyStep() >= 2 ? 'ceremony-r2' : 'ceremony'}
                          title={getKeyCeremonyStep() >= 2 ? 'Backup share exchange' : 'Keypair assembly'}
                          total={adminKeyCeremonyStatus?.totalGuardians ?? electionData?.numberOfGuardians ?? 0}
                          threshold={electionData.electionQuorum || electionData.numberOfGuardians || 0}
                          filled={
                            getKeyCeremonyStep() >= 2
                              ? (adminKeyCeremonyStatus?.submittedBackupGuardians ?? 0)
                              : (adminKeyCeremonyStatus?.submittedGuardians ?? 0)
                          }
                          guardians={(electionData.guardians || []).map((g) => ({
                            id: g.userEmail,
                            label: g.userName || g.userEmail,
                            filled: getKeyCeremonyStep() >= 2 ? !!g.backupSharesSubmitted : !!g.guardianKeySubmitted,
                            secondaryFilled: !!g.backupSharesSubmitted,
                          }))}
                          combined={!!(guardianKeyCeremonyContext?.readyForActivation || adminKeyCeremonyStatus?.readyForActivation)}
                        />
                        <div className="space-y-3">
                          <div className="rounded-xl border border-brand/20 bg-paper p-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="font-display text-sm font-semibold text-ink">Step 1 — Key pairs</p>
                              <span className="font-mono text-xs text-brand-dark">{getRound1Progress()}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-brand-soft">
                              <div className="h-2 rounded-full bg-brand" style={{ width: `${getRound1Progress()}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-dusk">
                              {(adminKeyCeremonyStatus?.submittedGuardians ?? 0)} / {(adminKeyCeremonyStatus?.totalGuardians ?? electionData?.numberOfGuardians ?? 0)} guardians submitted credentials
                            </p>
                          </div>
                          <div className="rounded-xl border border-brand/20 bg-paper p-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="font-display text-sm font-semibold text-ink">Step 2 — Backup shares</p>
                              <span className="font-mono text-xs text-brand-dark">{getRound2Progress()}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-brand-soft">
                              <div className="h-2 rounded-full bg-threshold" style={{ width: `${getRound2Progress()}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-dusk">
                              {(adminKeyCeremonyStatus?.submittedBackupGuardians ?? 0)} / {(adminKeyCeremonyStatus?.totalGuardians ?? electionData?.numberOfGuardians ?? 0)} guardians shared backups
                            </p>
                          </div>
                          <div className={`rounded-xl border p-4 ${(guardianKeyCeremonyContext?.readyForActivation || adminKeyCeremonyStatus?.readyForActivation) ? 'border-aurora/35 bg-sage-soft' : 'border-brand/20 bg-paper'}`}>
                            <p className="font-display text-sm font-semibold text-ink">Step 3 — Activation</p>
                            <p className="mt-1 text-xs text-dusk">
                              {(guardianKeyCeremonyContext?.readyForActivation || adminKeyCeremonyStatus?.readyForActivation)
                                ? 'Quorum formed. Admin can set the schedule and activate voting.'
                                : 'Waiting for all guardians to finish steps 1–2.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-5 rounded-xl border border-brand/20 bg-paper p-4">
                      <h5 className="mb-3 text-sm font-semibold text-ink">Guardian ceremony progress</h5>
                      <div className="space-y-2">
                        {electionData.guardians?.map((guardian) => (
                          <div key={guardian.userEmail} className="flex flex-col gap-2 rounded-lg border border-brand/15 bg-glacier/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <FiUser className="h-5 w-5 flex-shrink-0 text-dusk" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink">{guardian.userName || guardian.userEmail}</p>
                                <p className="text-xs text-dusk">Order {guardian.sequenceOrder}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${guardian.guardianKeySubmitted ? 'bg-brand/15 text-brand-dark' : 'bg-frost text-dusk'}`}>
                                Step 1: {guardian.guardianKeySubmitted ? 'Keypair submitted' : 'Keypair pending'}
                              </span>
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${guardian.backupSharesSubmitted ? 'bg-brand/15 text-brand-dark' : 'bg-frost text-dusk'}`}>
                                Step 2: {guardian.backupSharesSubmitted ? 'Backup shared' : 'Backup pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {keyCeremonyUiMessage && (
                      <div className="mb-3 rounded-lg border border-aurora/30 bg-sage-soft px-3 py-2 text-sm text-aurora-muted">
                        {keyCeremonyUiMessage}
                      </div>
                    )}
                    {keyCeremonyUiError && (
                      <div className="mb-3 rounded-lg border border-ember/30 bg-ember-soft px-3 py-2 text-sm text-ember">
                        {keyCeremonyUiError}
                      </div>
                    )}

                    {/* Guardian full key ceremony actions */}
                    {electionData?.userRoles?.includes('guardian') && (
                      <>
                        {(guardianKeyCeremonyContext?.currentRound === 'keypair_generation') && (
                          <div className="rounded-xl border border-brand/25 bg-paper p-4 mb-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                              <h5 className="font-semibold text-deep">Round 1: Generate + Submit Keypair</h5>
                              <button
                                onClick={handleGenerateKeyCeremonyCredentials}
                                disabled={keyCeremonyBusy.generatingCredentials}
                                className="px-3 py-2 bg-brand-dark text-paper rounded-lg hover:bg-ink disabled:opacity-60"
                              >
                                {keyCeremonyBusy.generatingCredentials ? 'Generating...' : 'Generate Credentials'}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <textarea
                                readOnly
                                className="border rounded-lg px-3 py-2 min-h-28 bg-frost text-ink cursor-default resize-none"
                                placeholder="Private key (generate credentials to fill)"
                                value={guardianCeremonyForm.privateKey}
                              />
                              <textarea
                                readOnly
                                className="border rounded-lg px-3 py-2 min-h-28 bg-frost text-ink cursor-default resize-none"
                                placeholder="Public key (generate credentials to fill)"
                                value={guardianCeremonyForm.publicKey}
                              />
                              <textarea
                                readOnly
                                className="border rounded-lg px-3 py-2 min-h-28 bg-frost text-ink cursor-default resize-none"
                                placeholder="Polynomial (generate credentials to fill)"
                                value={guardianCeremonyForm.polynomial}
                              />
                              <textarea
                                readOnly
                                className="border rounded-lg px-3 py-2 min-h-28 bg-frost text-ink cursor-default resize-none"
                                placeholder="Guardian backup payload (generate credentials to fill)"
                                value={guardianCeremonyForm.keyBackup}
                              />
                            </div>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                              <input
                                type="text"
                                className="border rounded-lg px-3 py-2"
                                placeholder="Local AES-256 password"
                                value={guardianCeremonyForm.localEncryptionPassword}
                                onChange={(e) => setGuardianCeremonyForm((prev) => ({ ...prev, localEncryptionPassword: e.target.value }))}
                              />
                              <button
                                onClick={handleGenerateLocalPassword}
                                className="px-3 py-2 bg-ink text-paper rounded-lg hover:bg-deep"
                              >
                                Generate Password
                              </button>
                            </div>

                            <button
                              onClick={handleSubmitKeyCeremonyRound1}
                              disabled={keyCeremonyBusy.submittingRound1}
                              className="mt-3 px-4 py-2 bg-brand-dark text-paper rounded-lg hover:bg-brand-dark disabled:opacity-60"
                            >
                              {keyCeremonyBusy.submittingRound1 ? 'Submitting...' : 'Submit Round 1'}
                            </button>
                          </div>
                        )}

                        {(guardianKeyCeremonyContext?.currentRound === 'waiting_for_all_keypairs') && (
                          <div className="rounded-xl border border-ceremonial/40 bg-ceremonial-soft p-4 mb-4 text-sm text-ink">
                            Your Round 1 keypair is submitted. Waiting for all guardians to finish Round 1.
                          </div>
                        )}

                        {(guardianKeyCeremonyContext?.currentRound === 'backup_key_sharing') && (
                          <div className="rounded-xl border border-brand/20 bg-paper p-4 mb-4">
                            <h5 className="font-semibold text-deep mb-3">Round 2: Backup Share Generation + Submission</h5>
                            <input
                              type="file"
                              accept=".txt,.json"
                              className="w-full border rounded-lg px-3 py-2"
                              onChange={(e) => handleBackupCredentialFileLoad(e.target.files?.[0])}
                            />

                            {backupCeremonyForm.credentialFileName && (
                              <p className="mt-2 text-xs text-sage">Loaded file: {backupCeremonyForm.credentialFileName}</p>
                            )}

                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                onClick={handleGenerateBackupShares}
                                disabled={keyCeremonyBusy.generatingBackup}
                                className="px-3 py-2 bg-brand-dark text-paper rounded-lg hover:bg-brand disabled:opacity-60"
                              >
                                {keyCeremonyBusy.generatingBackup ? 'Generating...' : 'Generate Backup Shares'}
                              </button>
                              <button
                                onClick={handleSubmitBackupShares}
                                disabled={keyCeremonyBusy.submittingBackup}
                                className="px-3 py-2 bg-aurora-muted text-paper rounded-lg hover:bg-aurora disabled:opacity-60"
                              >
                                {keyCeremonyBusy.submittingBackup ? 'Submitting...' : 'Submit Round 2'}
                              </button>
                            </div>

                            <textarea
                              className="mt-3 border rounded-lg px-3 py-2 min-h-28 w-full"
                              placeholder="Generated encrypted backup payload"
                              value={backupCeremonyForm.generatedGuardianData}
                              onChange={(e) => setBackupCeremonyForm((prev) => ({ ...prev, generatedGuardianData: e.target.value }))}
                            />
                          </div>
                        )}

                        {(guardianKeyCeremonyContext?.currentRound === 'backup_submitted_waiting_others') && (
                          <div className="rounded-xl border border-brand/20 bg-glacier p-4 mb-4 text-sm text-ink">
                            Your Round 2 backup shares are submitted. Waiting for remaining guardians.
                          </div>
                        )}
                      </>
                    )}

                    {/* Admin activation once ceremony is complete */}
                    {(guardianKeyCeremonyContext?.readyForActivation || adminKeyCeremonyStatus?.readyForActivation) &&
                      electionData?.userRoles?.includes('admin') && (
                        <div className="mt-1 rounded-xl border border-aurora/30 bg-sage-soft p-4">
                          <h5 className="font-medium text-emerald-900 mb-2">Key ceremony finished</h5>
                          <p className="text-sm text-aurora-muted mb-3">
                            Set the election schedule now to activate voting. Use the Send Email tab to schedule messages to voters, guardians, or admins.
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <label className="space-y-1">
                              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Election Start</span>
                              <input
                                type="datetime-local"
                                value={activationSchedule.startingTime}
                                onChange={(e) => setActivationSchedule((prev) => ({ ...prev, startingTime: e.target.value }))}
                                className="w-full px-3 py-2 border-2 border-aurora/30 focus:border-emerald-500 rounded-md outline-none"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Election End</span>
                              <input
                                type="datetime-local"
                                value={activationSchedule.endingTime}
                                onChange={(e) => setActivationSchedule((prev) => ({ ...prev, endingTime: e.target.value }))}
                                className="w-full px-3 py-2 border-2 border-aurora/30 focus:border-emerald-500 rounded-md outline-none"
                              />
                            </label>
                          </div>

                          <button
                            onClick={handleActivateElectionFromGuardianTab}
                            disabled={activatingElection}
                            className="mt-3 px-4 py-2 bg-aurora-muted text-paper rounded hover:bg-aurora disabled:opacity-60"
                          >
                            {activatingElection ? 'Activating...' : 'Activate Election'}
                          </button>
                        </div>
                      )}
                  </div>
                )}

                {/* Tally Creation Section - Only show if election has ended */}
                {isElectionFinished() && !isKeyCeremonyPending && (
                  <div className="space-y-4 rounded-2xl border border-brand/20 bg-gradient-to-br from-white to-frost p-6 shadow-soft">
                    <ProcessProgressPanel
                      title="Tally creation progress"
                      status={tallyStatus}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-display font-semibold text-deep mb-2">Create encrypted tally</h4>
                        <p className="text-sm text-dusk">
                          Homomorphic product of cast ballots — ciphertext only. Guardians decrypt after this stage completes.
                        </p>
                      </div>
                    </div>
                    {isElectionAdminUser() && (
                    <button
                      onClick={() => setIsTallyModalOpen(true)}
                      disabled={tallyStatus?.status === 'in_progress' || tallyStatus?.status === 'pending'}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                        tallyStatus?.status === 'in_progress' || tallyStatus?.status === 'pending'
                          ? 'bg-brand-soft text-brand-dark cursor-default'
                          : tallyStatus?.status === 'completed'
                            ? 'bg-aurora-muted text-paper hover:bg-aurora'
                            : 'bg-brand-dark text-paper hover:bg-brand-dark'
                      }`}
                    >
                      {(tallyStatus?.status === 'in_progress' || tallyStatus?.status === 'pending') ? (
                        <>
                          <FiLoader className="h-5 w-5 animate-spin" />
                          <span>
                            Tally In Progress
                            {tallyStatus.totalChunks
                              ? ` (${tallyStatus.processedChunks || 0}/${tallyStatus.totalChunks})`
                              : ''}
                          </span>
                        </>
                      ) : tallyStatus?.status === 'completed' ? (
                        <>
                          <FiCheckCircle className="h-5 w-5" />
                          <span>View Tally Status</span>
                        </>
                      ) : (
                        <>
                          <FiRefreshCw className="h-5 w-5" />
                          <span>Create Tally</span>
                        </>
                      )}
                    </button>
                    )}
                    {isElectionAdminUser() && (
                      <ProcessControlPanel
                        electionId={Number(id)}
                        canControlTally
                        canControlCombine={false}
                      />
                    )}
                  </div>
                )}

                {isElectionFinished() && isTallyComplete && (
                  <>
                    <ProcessProgressPanel
                      title="Combine Decryption Shares Progress"
                      status={combineStatus}
                    />

                    {(() => {
                      const guardiansSubmitted = electionData.guardiansSubmitted || 0;
                      const electionQuorum = electionData.electionQuorum || electionData.totalGuardians || 0;
                      const quorumMet = guardiansSubmitted >= electionQuorum;
                      const needsDecryption = !isCombineComplete && combineStatus?.status !== 'in_progress' && combineStatus?.status !== 'pending';
                      return (
                        <>
                          {needsDecryption && !quorumMet && (
                            <GuardianQuorumViz
                              mode="decryption"
                              title="Waiting for partial decryption shares"
                              total={electionData.totalGuardians || electionData.numberOfGuardians || 0}
                              threshold={electionQuorum}
                              filled={guardiansSubmitted}
                              guardians={(electionData.guardians || []).map((g) => ({
                                id: g.userEmail,
                                label: g.userName || g.userEmail,
                                filled: !!g.decryptedOrNot,
                              }))}
                            />
                          )}

                          {needsDecryption && quorumMet && isElectionAdminUser() && (
                            <div className="observatory-panel space-y-4 p-6">
                              <GuardianQuorumViz
                                mode="combine"
                                title="Threshold met — ready to combine"
                                total={electionData.totalGuardians || electionData.numberOfGuardians || 0}
                                threshold={electionQuorum}
                                filled={guardiansSubmitted}
                                combined={false}
                                guardians={(electionData.guardians || []).map((g) => ({
                                  id: g.userEmail,
                                  label: g.userName || g.userEmail,
                                  filled: !!g.decryptedOrNot,
                                }))}
                              />
                              <div className="text-center">
                                <h4 className="font-display text-lg font-semibold text-ink mb-2">Combine decryption shares</h4>
                                <p className="text-sm text-dusk mb-4">
                                  Quorum met. Combine guardian partial decryptions to reveal the final result.
                                </p>
                                <div className="flex flex-wrap justify-center gap-3">
                                  <button
                                    onClick={handleInitiateCombine}
                                    disabled={combiningDecryptions}
                                    className="btn-brand px-6 py-2 disabled:opacity-50"
                                  >
                                    {combiningDecryptions ? 'Combining...' : 'Combine partial decryptions'}
                                  </button>
                                  <button
                                    onClick={handleCheckCombineStatus}
                                    disabled={combiningDecryptions}
                                    className="inline-flex items-center rounded-xl border border-brand/25 px-6 py-2 text-sm font-medium text-dusk hover:text-ink disabled:opacity-50"
                                  >
                                    <FiRefreshCw className="mr-2 inline h-4 w-4" />
                                    Check status
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {isCombineComplete && (
                            <div className="rounded-xl border border-aurora/35 bg-aurora/10 p-4 text-sm text-aurora">
                              Decryption shares combined. Results are available in the Results tab.
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <GuardianProgressPanel
                      electionId={Number(id)}
                      guardians={electionData?.guardians || []}
                      onElectionRefresh={fetchElectionData}
                    />

                    {isElectionAdminUser() && (
                      <ProcessControlPanel
                        electionId={Number(id)}
                        guardians={electionData?.guardians || []}
                        canControlDecryption
                        canControlCombine
                      />
                    )}
                  </>
                )}

                {/* Active Decryption Process Banner */}
                {isElectionFinished() && isTallyComplete && guardianDecryptionStatus &&
                 (guardianDecryptionStatus.status === 'in_progress' || guardianDecryptionStatus.status === 'pending') && (
                  <div className="rounded-2xl border border-threshold/40 bg-threshold/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <FiLoader className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-threshold" />
                        <div>
                          <p className="font-display font-semibold text-deep">Partial decryption in progress</p>
                          <p className="text-sm text-dusk">
                            Your guardian share is being computed. Open the live status view for per-phase detail.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDecryptionModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-threshold/40 bg-paper px-4 py-2.5 text-sm font-semibold text-threshold hover:bg-threshold/5"
                      >
                        <FiEye className="h-4 w-4" />
                        View progress
                      </button>
                    </div>
                  </div>
                )}

                {/* Key Submission Form */}
                {isElectionFinished() && isTallyComplete && (() => {
                  const submitStatus = canSubmitGuardianKey();

                  if (submitStatus.canSubmit) {
                    return (
                      <div className="rounded-2xl border-2 border-brand/40 bg-gradient-to-br from-glacier via-white to-glacier shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-brand-dark to-brand px-5 sm:px-6 py-4 text-paper">
                          <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-paper/20 p-3 flex-shrink-0">
                              <FiKey className="h-7 w-7" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-paper/80">Guardian action required</p>
                              <h4 className="text-lg sm:text-xl font-bold mt-1">Submit Your Guardian Key for Decryption</h4>
                              <p className="text-sm text-dusk-soft mt-1 max-w-2xl">
                                Upload the <strong className="text-paper">credentials.txt</strong> file from your guardian key ceremony email. This unlocks your share of the encrypted results.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-5 sm:p-6 space-y-5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div className="rounded-xl border border-glacier bg-paper p-3">
                              <p className="text-xs font-bold text-brand-dark uppercase">Step 1</p>
                              <p className="mt-1 text-ink">Find <span className="font-semibold">credentials.txt</span> in your email</p>
                            </div>
                            <div className="rounded-xl border border-glacier bg-paper p-3">
                              <p className="text-xs font-bold text-brand-dark uppercase">Step 2</p>
                              <p className="mt-1 text-ink">Choose the file below (do not edit it)</p>
                            </div>
                            <div className="rounded-xl border border-glacier bg-paper p-3">
                              <p className="text-xs font-bold text-brand-dark uppercase">Step 3</p>
                              <p className="mt-1 text-ink">Press the big green submit button</p>
                            </div>
                          </div>

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
                              ? 'Please submit the right key. Click below to try again.'
                              : 'Click below to check your decryption progress.';
                            
                            const bgColor = guardianDecryptionStatus?.status === 'failed'
                              ? 'bg-ember-soft border-ember/30'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'bg-sage-soft border-aurora/30'
                              : 'bg-glacier border-brand/20';
                            
                            const titleColor = guardianDecryptionStatus?.status === 'failed'
                              ? 'text-red-900'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'text-green-900'
                              : 'text-deep';
                            
                            const textColor = guardianDecryptionStatus?.status === 'failed'
                              ? 'text-ember'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'text-aurora-muted'
                              : 'text-ink';
                            
                            const buttonColor = guardianDecryptionStatus?.status === 'failed'
                              ? 'bg-ember hover:bg-ember'
                              : guardianDecryptionStatus?.status === 'completed'
                              ? 'bg-aurora-muted hover:bg-aurora'
                              : 'bg-brand-dark hover:bg-brand';
                            
                            const icon = guardianDecryptionStatus?.status === 'failed'
                              ? <FiAlertCircle className="h-5 w-5 text-ember mr-2" />
                              : guardianDecryptionStatus?.status === 'completed'
                              ? <FiCheckCircle className="h-5 w-5 text-green-500 mr-2" />
                              : <FiRefreshCw className="h-5 w-5 text-brand mr-2" />;
                            
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
                                    className={`px-4 py-2 ${buttonColor} text-paper rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:bg-ink/30 ml-4`}
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
                          <div className="bg-sage-soft border border-aurora/30 rounded-lg p-4 mb-4">
                            <div className="flex items-center">
                              <FiCheckCircle className="h-5 w-5 text-green-500 mr-2" />
                              <div>
                                <h5 className="font-medium text-green-900">Credentials Received!</h5>
                                <p className="text-sm text-aurora-muted mt-1">
                                  {keySubmissionResult.message || "Your credentials have been received. Decryption processing has started. Use the 'Check Progress' button above to monitor status."}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {keySubmissionError && (
                          <div className="bg-ember-soft border-2 border-ember/40 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                              <FiAlertCircle className="h-6 w-6 text-ember flex-shrink-0 mt-0.5" />
                              <div>
                                <h5 className="font-semibold text-red-900">Could not verify your key</h5>
                                <p className="text-sm text-ember mt-1">{keySubmissionError}</p>
                                <p className="text-xs text-ember mt-2">Double-check that you selected the correct credentials.txt file from your guardian email, then try again.</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <form onSubmit={handleGuardianKeySubmit} className="space-y-5">
                          <div className="rounded-xl border-2 border-dashed border-brand/25 bg-paper p-5 sm:p-6">
                            <label className="block text-base font-semibold text-deep mb-2">
                              Upload credentials.txt
                            </label>
                            <input
                              type="file"
                              accept=".txt"
                              onChange={handleCredentialFileChange}
                              className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-brand-dark file:text-paper file:font-semibold hover:file:bg-ink cursor-pointer"
                              required
                            />
                            <p className="text-sm text-dusk mt-3">
                              Only the plain text file named <span className="font-mono font-semibold">credentials.txt</span> from your guardian ceremony will work.
                            </p>
                            {guardianKey && (
                              <div className="mt-3 flex items-center gap-2 p-3 bg-sage-soft border border-aurora/30 rounded-lg">
                                <FiCheckCircle className="h-5 w-5 text-sage flex-shrink-0" />
                                <p className="text-sm font-medium text-aurora-muted">File loaded — ready to submit</p>
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
                                  className={`w-full sm:w-auto min-w-[260px] px-8 py-3.5 rounded-xl text-base font-bold text-paper shadow-md transition-all ${
                                    isCompleted
                                      ? 'bg-aurora cursor-not-allowed text-paper'
                                      : isInProgress
                                      ? 'bg-brand cursor-not-allowed'
                                      : isFailed
                                      ? 'bg-ceremonial hover:bg-orange-700 hover:shadow-lg'
                                      : isDisabled
                                      ? 'bg-ink/30 cursor-not-allowed'
                                      : 'bg-gradient-to-r from-emerald-600 to-aurora-muted hover:from-emerald-700 hover:to-green-700 hover:shadow-lg'
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
                                    'Submit Guardian Key'
                                  )}
                                </button>
                              );
                            })()}
                          </div>
                        </form>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="border border-yellow-200 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <FiAlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                          <h4 className="font-medium text-yellow-900">Key Submission Not Available</h4>
                        </div>
                        <p className="text-ink mb-4">{submitStatus.reason}</p>

                        {submitStatus.reason === 'Election has not ended yet' && (
                          <p className="text-sm text-yellow-700">
                            You will be able to submit your guardian key after the election ends on {formatDate(electionData.endingTime)}.
                          </p>
                        )}

                        {submitStatus.reason === 'Partial decryption already submitted' && (
                          <div className="bg-sage-soft border border-aurora/30 rounded p-3">
                            <p className="text-sm text-aurora-muted">
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
                  <h4 className="font-medium text-deep mb-3">Guardian Status</h4>

                  {getElectionStatus() === 'finished' && (
                    <div className="mb-4">
                      <GuardianQuorumViz
                        mode="decryption"
                        title="Partial decryption response"
                        total={electionData.totalGuardians || electionData.numberOfGuardians || 0}
                        threshold={electionData.electionQuorum || electionData.totalGuardians || 0}
                        filled={electionData.guardiansSubmitted || 0}
                        combined={isCombineComplete}
                        guardians={(electionData.guardians || []).map((g) => ({
                          id: g.userEmail,
                          label: g.userName || g.userEmail,
                          filled: !!g.decryptedOrNot,
                        }))}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {electionData.guardians?.map((guardian) => (
                      <div key={guardian.userEmail} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FiUser className="h-5 w-5 text-dusk" />
                          <div>
                            <p className="font-medium text-deep">{guardian.userName}</p>
                            <p className="text-sm text-dusk">{guardian.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 flex-wrap justify-end gap-1">
                          <span className="text-sm font-medium text-dusk">Order: {guardian.sequenceOrder}</span>
                          {electionData.status === 'key_ceremony_pending' ? (
                            <>
                              <span className={`px-2 py-1 rounded-full text-xs ${guardian.guardianKeySubmitted ? 'bg-glacier text-ink' : 'bg-ceremonial-soft text-ink'}`}>
                                {guardian.guardianKeySubmitted ? 'Keypair done' : 'Keypair pending'}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs ${guardian.backupSharesSubmitted ? 'bg-glacier text-brand-dark' : 'bg-ceremonial-soft text-ink'}`}>
                                {guardian.backupSharesSubmitted ? 'Backup shared' : 'Backup pending'}
                              </span>
                            </>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs ${guardian.decryptedOrNot ? 'bg-sage-soft text-aurora-muted' : 'bg-ceremonial-soft text-ink'}`}>
                              {guardian.decryptedOrNot ? 'Key Submitted' : 'Pending'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="surface-card p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <p className="section-kicker">Outcome</p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-deep flex items-center gap-2">
                <FiTrendingUp className="h-5 w-5 text-brand" />
                Election Results
              </h3>
            </div>
            {!canUserViewResults() ? (
              <div className="text-center py-8">
                <FiTrendingUp className="h-12 w-12 text-dusk mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-ink mb-2">Results Not Available</h4>
                <p className="text-dusk">
                  Results will be available after decryption shares are combined on the Guardian tab.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {loadingResults && (
                  <div className="text-center py-8">
                    <FiLoader className="h-8 w-8 text-brand mx-auto mb-4 animate-spin" />
                    <p className="text-dusk">Loading election results...</p>
                  </div>
                )}

                {combiningDecryptions && (
                  <div className="bg-glacier border border-brand/20 rounded-lg p-4">
                    <div className="flex items-center">
                      <FiLoader className="h-5 w-5 text-brand mr-2 animate-spin" />
                      <div>
                        <h4 className="font-medium text-deep">Combining Partial Decryptions</h4>
                        <p className="text-sm text-ink">Processing guardian keys to decrypt final results...</p>
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
                  
                  // Check if election is already decrypted or if combine is completed
                  const isAlreadyDecrypted = electionData.status === 'decrypted';
                  const isCombineCompleted = combineStatus?.status === 'completed';
                  // ✅ FIX: Also check if we have animatedResults to determine if decryption is complete
                  const hasResults = animatedResults?.success && animatedResults?.results?.finalTallies;
                  // ✅ FIXED: Removed problematic totalVotesInChoices !== totalBallots condition
                  // Show combine button when: not loading, not already decrypted, combine not completed, and no results yet
                  const needsDecryption = false;
                  
                  console.log('🔍 [Button Display Logic]', {
                    electionStatus: electionData.status,
                    isAlreadyDecrypted,
                    isCombineCompleted,
                    combineStatusValue: combineStatus?.status,
                    hasResults,
                    hasAnimatedResults: !!animatedResults,
                    hasAnimatedResultsFinalTallies: !!animatedResults?.results?.finalTallies,
                    needsDecryption,
                    totalBallots,
                    totalVotesInChoices,
                    loading,
                    shouldShowButton: needsDecryption
                  });

                  // ✅ Fixed: Check if quorum is met instead of requiring all guardians
                  const guardiansSubmitted = electionData.guardiansSubmitted || 0;
                  const electionQuorum = electionData.electionQuorum || electionData.totalGuardians || 0;
                  const quorumMet = guardiansSubmitted >= electionQuorum;

                  console.log('🔍 [Combine Button Visibility]', {
                    needsDecryption,
                    quorumMet,
                    guardiansSubmitted,
                    electionQuorum,
                    willShowButton: needsDecryption && quorumMet,
                    willShowWaitingMessage: needsDecryption && !quorumMet
                  });

                  return (
                    <div ref={resultsExportRef} className="space-y-6 bg-paper">
                      {animatedResults && (
                        <div className="mb-6">
                          <AnimatedResults
                            electionResults={animatedResults}
                            electionChoices={electionData.electionChoices}
                            winnerCount={getWinnerCount(electionData)}
                            votersWhoVoted={processedResults.totalVotedUsers || 0}
                          />
                        </div>
                      )}

                      {/* Results meta banner for PDF export */}
                      <div className="rounded-xl border border-glacier bg-gradient-to-r from-glacier via-white to-blue-50 p-4 sm:p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-brand-dark font-semibold">Election</p>
                            <p className="font-bold text-deep mt-1">{electionData.electionTitle}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-brand-dark font-semibold">Max Choices</p>
                            <p className="font-bold text-deep mt-1">{electionData.maxChoices || 1}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-brand-dark font-semibold">Winners</p>
                            <p className="font-bold text-ink mt-1">Top {getWinnerCount(electionData)} 🏆</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-brand-dark font-semibold">Eligible Voters</p>
                            <p className="font-bold text-deep mt-1">{processedResults.totalEligibleVoters}</p>
                          </div>
                        </div>
                      </div>

                      {/* Results Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6">
                        <div className="p-3 sm:p-4 bg-teal-50 border border-teal-100 rounded-xl text-center">
                          <div className="text-2xl mb-1">👥</div>
                          <h4 className="font-medium text-teal-700 mb-1 text-xs sm:text-sm">Voters Who Voted</h4>
                          <p className="text-xl sm:text-3xl font-extrabold text-teal-800">{processedResults.totalVotedUsers || 0}</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-sage-soft border border-green-100 rounded-xl text-center">
                          <div className="text-2xl mb-1">📋</div>
                          <h4 className="font-medium text-sage mb-1 text-xs sm:text-sm">Eligible Voters</h4>
                          <p className="text-xl sm:text-3xl font-extrabold text-aurora-muted">{processedResults.totalEligibleVoters}</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-glacier border border-brand/15 rounded-xl text-center">
                          <div className="text-2xl mb-1">📊</div>
                          <h4 className="font-medium text-brand-dark mb-1 text-xs sm:text-sm">Voter Turnout</h4>
                          <p className="text-xl sm:text-3xl font-extrabold text-ink">{processedResults.turnoutRate}%</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-ceremonial-soft border border-orange-100 rounded-xl text-center">
                          <div className="text-2xl mb-1">🏆</div>
                          <h4 className="font-medium text-ink mb-1 text-xs sm:text-sm">Total Candidates</h4>
                          <p className="text-xl sm:text-3xl font-extrabold text-ink">{processedResults.choices.length}</p>
                        </div>
                      </div>

                      {/* Download Options */}
                      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6">
                        <button
                          onClick={downloadResultsPDF}
                          disabled={downloadingPdf}
                          className="flex items-center space-x-1 sm:space-x-2 bg-ember text-paper px-3 sm:px-4 py-2 rounded-lg hover:bg-ember text-xs sm:text-sm disabled:opacity-60"
                        >
                          {downloadingPdf ? (
                            <FiLoader className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          ) : (
                            <FiDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                          <span>{downloadingPdf ? 'Generating…' : 'PDF'}</span>
                        </button>
                        <button
                          onClick={downloadResultsCSV}
                          className="flex items-center space-x-1 sm:space-x-2 bg-aurora-muted text-paper px-3 sm:px-4 py-2 rounded-lg hover:bg-aurora text-xs sm:text-sm"
                        >
                          <FiDownload className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>CSV</span>
                        </button>
                      </div>

                      {/* Charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-6">
                        {/* Bar Chart */}
                        <div className="bg-frost rounded-lg p-3 sm:p-4">
                          <h4 className="font-medium text-deep mb-3 sm:mb-4 flex items-center text-sm sm:text-base">
                            <FiBarChart className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Vote Distribution
                          </h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={buildCompetitionRankings([...processedResults.chartData])}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10 }}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={70}
                                tickFormatter={(label) => truncateChartLabel(label, 14)}
                              />
                              <YAxis />
                              <Tooltip
                                formatter={(value) => [value, 'Votes']}
                                labelFormatter={(label) => label}
                              />
                              <Legend formatter={(value) => truncateChartLabel(value, 18)} />
                              <Bar dataKey="votes" fill="#3B82F6" name="Votes" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Pie Chart */}
                        <div className="bg-frost rounded-lg p-3 sm:p-4">
                          <h4 className="font-medium text-deep mb-3 sm:mb-4 flex items-center text-sm sm:text-base">
                            <FiPieChart className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Vote Share
                          </h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={buildCompetitionRankings([...processedResults.chartData])}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ percentage }) => `${percentage}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="votes"
                              >
                                {processedResults.chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value, name, props) => [value, props.payload?.name || 'Votes']}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Detailed Results Table */}
                      <div className="bg-frost rounded-lg p-3 sm:p-4">
                        <h4 className="font-medium text-deep mb-3 sm:mb-4 text-sm sm:text-base">Detailed Results</h4>
                        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                          <table className="w-full border-collapse min-w-[500px]">
                            <thead>
                              <tr className="border-b-2 border-ink/10">
                                <th className="text-left p-3 font-medium text-deep">Position</th>
                                <th className="text-left p-3 font-medium text-deep">Candidate</th>
                                <th className="text-left p-3 font-medium text-deep">Votes</th>
                                <th className="text-left p-3 font-medium text-deep">Percentage</th>
                                <th className="text-left p-3 font-medium text-deep">Visual</th>
                              </tr>
                            </thead>
                            <tbody>
                              {buildCompetitionRankings([...processedResults.chartData]).map((candidate) => {
                                const winnerCount = getWinnerCount(electionData);
                                const isWinner = isWinnerByRank(candidate.rank, winnerCount);
                                const positionLabel = formatOrdinal(candidate.rank);
                                return (
                                  <tr key={candidate.name} className={`border-b border-ink/10 hover:bg-frost-muted ${isWinner ? 'bg-ceremonial-soft/60' : ''}`}>
                                    <td className="p-3">
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                                        isWinner ? 'bg-ceremonial-soft text-ink border border-yellow-300' : 'bg-frost-muted text-dusk'
                                      }`}>
                                        {isWinner && <span aria-hidden>🏆</span>}
                                        {positionLabel}
                                      </span>
                                    </td>
                                    <td className={`p-3 font-medium min-w-0 ${isWinner ? 'text-ink' : 'text-deep'}`}>
                                      <CandidateIdentity
                                        name={candidate.name}
                                        image={getCandidatePic(electionData.electionChoices, candidate.name)}
                                        description={getCandidateDescription(electionData.electionChoices, candidate.name)}
                                        partyName={findChoiceByName(electionData.electionChoices, candidate.name)?.partyName}
                                        size="sm"
                                        enableProfile
                                      />
                                      {isWinner && <span className="mt-1 block text-xs font-bold text-ink">Winner</span>}
                                    </td>
                                    <td className="p-3 font-semibold text-deep">{candidate.votes}</td>
                                    <td className="p-3 text-deep">{candidate.percentage}%</td>
                                    <td className="p-3">
                                      <div className="w-20 bg-ink/10 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all duration-1000 ${isWinner ? 'bg-ceremonial' : 'bg-brand'}`}
                                          style={{ width: `${candidate.percentage}%` }}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Rankings Section */}
                      {processedResults.chartData && processedResults.chartData.length > 0 && (
                        <div className="mt-6">
                          <div className="bg-paper rounded-xl border border-glacier shadow-sm p-4 sm:p-6">
                            <h4 className="font-bold text-deep mb-5 flex items-center gap-2 text-base sm:text-lg">
                              <span className="text-2xl">🏆</span>
                              Election Rankings
                            </h4>
                            <div className="space-y-3">
                              {buildCompetitionRankings([...processedResults.chartData]).map((candidate) => {
                                const winnerCount = getWinnerCount(electionData);
                                const isWinner = isWinnerByRank(candidate.rank, winnerCount);
                                const positionLabel = formatOrdinal(candidate.rank);
                                const style = isWinner
                                  ? { bg: 'bg-gradient-to-r from-yellow-50 to-amber-50', border: 'border-yellow-300', badge: 'bg-ceremonial-soft text-ink border border-yellow-300', rank: 'text-yellow-600', bar: 'from-yellow-400 to-amber-500' }
                                  : { bg: 'bg-glacier', border: 'border-glacier', badge: 'bg-glacier text-brand-dark border border-brand/20', rank: 'text-brand', bar: 'from-brand-light to-brand' };
                                return (
                                  <div key={candidate.name} className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${style.bg} ${style.border} transition-all hover:shadow-md`}>
                                    <div className="w-14 text-center flex-shrink-0">
                                      {isWinner ? (
                                        <div className="flex flex-col items-center">
                                          <span className="text-2xl leading-none">🏆</span>
                                          <span className={`text-xs font-extrabold mt-1 ${style.rank}`}>{positionLabel}</span>
                                        </div>
                                      ) : (
                                        <span className={`text-sm font-extrabold ${style.rank}`}>{positionLabel}</span>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <CandidateIdentity
                                        name={candidate.name}
                                        image={getCandidatePic(electionData.electionChoices, candidate.name)}
                                        description={getCandidateDescription(electionData.electionChoices, candidate.name)}
                                        partyName={findChoiceByName(electionData.electionChoices, candidate.name)?.partyName}
                                        size="md"
                                        enableProfile
                                        nameClassName={`font-bold text-sm sm:text-base ${isWinner ? 'text-ink' : 'text-deep'}`}
                                      />
                                      <div className="mt-1.5 w-full bg-paper/70 rounded-full h-1.5 overflow-hidden border border-white">
                                        <div
                                          className={`h-1.5 rounded-full bg-gradient-to-r ${style.bar} transition-all duration-1000`}
                                          style={{ width: `${candidate.percentage}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${style.badge}`}>
                                        {candidate.votes} votes
                                      </span>
                                      <span className="text-xs font-semibold text-dusk">{candidate.percentage}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Chunk Breakdown Section - Modern UI */}
                      {animatedResults && animatedResults.results && animatedResults.results.chunks && animatedResults.results.chunks.length > 0 && (
                        <div className="mt-8">
                          <div className="bg-gradient-to-r from-glacier to-frost rounded-lg p-6 border border-brand/20">
                            <div className="flex items-center justify-between mb-6">
                              <div>
                                <h4 className="text-xl font-bold text-deep flex items-center gap-2">
                                  <svg className="w-6 h-6 text-brand-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                  Processing Chunk Breakdown
                                </h4>
                                <p className="text-sm text-dusk mt-1">
                                  Detailed view of vote distribution across {animatedResults.results.chunks.length} processing chunks
                                </p>
                              </div>
                              <span className="px-4 py-2 bg-paper rounded-full text-sm font-semibold text-brand-dark shadow-sm">
                                {animatedResults.results.chunks.length} Chunks
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {animatedResults.results.chunks.map((chunk, index) => (
                                <div 
                                  key={chunk.electionCenterId}
                                  className="surface-card-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-ink/10"
                                >
                                  {/* Chunk Header */}
                                  <div className="bg-gradient-to-r from-brand to-brand-dark px-4 py-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="font-bold text-paper text-lg">
                                        Chunk #{chunk.chunkIndex}
                                      </h5>
                                      <span className="px-2 py-1 bg-paper bg-opacity-20 rounded-full text-xs font-medium text-paper">
                                        ID: {chunk.electionCenterId}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Chunk Body */}
                                  <div className="p-4">
                                    {/* Ballot Count */}
                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ink/10">
                                      <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <span className="text-sm font-medium text-ink">
                                        {chunk.ballotCount || 0} Ballots Processed
                                      </span>
                                    </div>

                                    {/* Vote Distribution */}
                                    <div className="space-y-3">
                                      <p className="text-xs font-semibold text-dusk uppercase tracking-wide">Vote Distribution</p>
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
                                            <div className="flex items-center justify-between text-sm gap-2">
                                              <div className="min-w-0 flex-1">
                                                <CandidateIdentity
                                                  name={candidate}
                                                  image={getCandidatePic(electionData?.electionChoices, candidate)}
                                                  description={getCandidateDescription(electionData?.electionChoices, candidate)}
                                                  partyName={findChoiceByName(electionData?.electionChoices, candidate)?.partyName}
                                                  size="sm"
                                                  enableProfile
                                                  nameClassName="font-medium text-ink text-sm"
                                                />
                                              </div>
                                              <span className="font-bold text-brand ml-2 shrink-0">{votes}</span>
                                            </div>
                                            <div className="w-full bg-ink/10 rounded-full h-2 overflow-hidden">
                                              <div
                                                className="bg-gradient-to-r from-brand to-brand-dark h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                              ></div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Chunk Footer */}
                                  <div className="bg-frost px-4 py-2 border-t border-ink/10">
                                    <p className="text-xs text-dusk text-center">
                                      Chunk {index + 1} of {animatedResults.results.chunks.length}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            )}
          </div>
        )}

        {/* Ballots in Tally Tab */}
        {activeTab === 'ballots' && (
          <div className="surface-card p-3 sm:p-6">
            {!canUserViewVerification() ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiDatabase className="h-12 w-12 sm:h-16 sm:w-16 text-dusk-soft mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-deep mb-2">Ballots Not Available</h3>
                <p className="text-sm sm:text-base text-dusk mb-4">
                  Ballot information will be available after the election results have been computed.
                </p>
              </div>
            ) : combiningDecryptions ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiLoader className="h-12 w-12 sm:h-16 sm:w-16 text-brand mx-auto mb-4 animate-spin" />
                <h3 className="text-base sm:text-lg font-semibold text-deep mb-2">
                  🔄 Combining Decryptions
                </h3>
                <p className="text-sm sm:text-base text-dusk mb-4">
                  Combining guardian keys to retrieve ballot hashes and tracking codes...
                </p>
              </div>
            ) : (() => {
              const guardiansSubmitted = electionData.guardiansSubmitted || 0;
              const electionQuorum = electionData.electionQuorum || electionData.totalGuardians || 0;
              const quorumMet = guardiansSubmitted >= electionQuorum;

              if (!quorumMet) {
                return (
                  <div className="text-center py-12">
                    <FiShield className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-deep mb-2">⏳ Waiting for Guardians</h3>
                    <p className="text-dusk mb-4">
                      Not enough guardians have submitted their decryption keys yet.
                    </p>
                    <div className="bg-ceremonial-soft border border-yellow-200 rounded-lg p-4 inline-block">
                      <p className="text-sm text-ink">
                        <strong>Status:</strong> {guardiansSubmitted} of {electionQuorum} required guardians have submitted keys.
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  <ErrorBoundary
                    title="Error loading ballot tally"
                    message="There was a problem displaying the ballots. Please try refreshing the page."
                    showDetails={true}
                    onRetry={() => window.location.reload()}
                  >
                    <BallotsInTallySection
                      electionId={id}
                    />
                  </ErrorBoundary>
                </>
              );
            })()}
          </div>
        )}

        {/* Key Verification Tab (guardians only) */}
        {activeTab === 'key-verification' && (
          <div className="surface-card p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
              <FiKey className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Key Verification
            </h3>
            {canUserManageGuardian() ? (
              <KeyVerificationTab electionId={id} electionData={electionData} />
            ) : (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiShield className="h-12 w-12 sm:h-16 sm:w-16 text-dusk-soft mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-deep mb-2">Guardians Only</h3>
                <p className="text-sm sm:text-base text-dusk">
                  Key verification is available only to guardians assigned to this election.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Verify Your Vote Tab */}
        {activeTab === 'verify' && (
          <div className="surface-card p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <p className="section-kicker signal-proof">Individual proof</p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-deep flex items-center gap-2">
                <FiHash className="h-5 w-5 text-aurora" />
                Verify your vote
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-dusk">
                Quiet confirmation that your encrypted ballot is in the tally — without revealing your choice.
              </p>
            </div>
            {!canUserViewVerification() ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiHash className="h-12 w-12 sm:h-16 sm:w-16 text-dusk-soft mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-deep mb-2">Vote Verification Not Available</h3>
                <p className="text-sm sm:text-base text-dusk mb-4">
                  Vote verification will be available after the election results have been computed.
                </p>
              </div>
            ) : combiningDecryptions ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <FiLoader className="h-12 w-12 sm:h-16 sm:w-16 text-brand mx-auto mb-4 animate-spin" />
                <h3 className="text-base sm:text-lg font-semibold text-deep mb-2">Combining Decryptions</h3>
                <p className="text-sm sm:text-base text-dusk mb-4">
                  Combining guardian keys to enable vote verification...
                </p>
              </div>
            ) : (() => {
              const guardiansSubmitted = electionData.guardiansSubmitted || 0;
              const electionQuorum = electionData.electionQuorum || electionData.totalGuardians || 0;
              const quorumMet = guardiansSubmitted >= electionQuorum;

              if (!quorumMet) {
                return (
                  <div className="mx-auto max-w-lg space-y-4 py-6">
                    <GuardianQuorumViz
                      mode="decryption"
                      title="Verification waiting on threshold"
                      total={electionData.totalGuardians || electionData.numberOfGuardians || 0}
                      threshold={electionQuorum}
                      filled={guardiansSubmitted}
                      guardians={(electionData.guardians || []).map((g) => ({
                        id: g.userEmail,
                        label: g.userName || g.userEmail,
                        filled: !!g.decryptedOrNot,
                      }))}
                    />
                    <p className="text-center text-sm text-dusk">
                      Vote verification opens after enough guardians contribute partial decryption shares.
                    </p>
                  </div>
                );
              }

              return <VerifyVoteSection electionId={id} />;
            })()}
          </div>
        )}

        {/* Send Email Tab */}
        {activeTab === 'send-email' && electionData?.userRoles?.includes('admin') && (
          <ScheduledEmailTab electionId={Number(id)} electionData={electionData} />
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <VerificationTabContent 
            canUserViewVerification={canUserViewVerification}
            id={id}
            electionData={electionData}
          />
        )}

        {/* Worker Proceedings Tab */}
        {activeTab === 'worker-proceedings' && (
          <div className="mt-8">
            <WorkerProceedings electionId={id} />
          </div>
        )}

      </div>
    </div>
  );
}
