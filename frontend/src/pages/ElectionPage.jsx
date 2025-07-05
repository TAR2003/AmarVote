import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { electionApi } from '../utils/electionApi';
import { timezoneUtils } from '../utils/timezoneUtils';
import toast from 'react-hot-toast';
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
  FiHash,
  FiCheck
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

const subMenus = [
  { name: 'Election Info', key: 'info', icon: FiInfo },
  { name: 'Voting Booth', key: 'voting', icon: FiCheckCircle },
  { name: 'Guardian Keys', key: 'guardian', icon: FiShield },
  { name: 'Results', key: 'results', icon: FiTrendingUp },
  { name: 'Verification', key: 'verification', icon: FiEye },
];

// Timer Component
const ElectionTimer = ({ startTime, endTime, status }) => {
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

export default function ElectionPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('info');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [electionData, setElectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Voting-related state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voteResult, setVoteResult] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteError, setVoteError] = useState(null);
  
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
  const [loadingResults, setLoadingResults] = useState(false);
  const [combiningDecryptions, setCombiningDecryptions] = useState(false);
  
  // Tally creation state
  const [tallyCreated, setTallyCreated] = useState(false);
  const [creatingTally, setCreatingTally] = useState(false);

  // Load election data and optionally create tally
  useEffect(() => {
    const fetchElectionData = async () => {
      try {
        setLoading(true);
        const data = await electionApi.getElectionById(id);
        if (data === null) {
          setError('You are not authorized to view this election or the election does not exist.');
        } else {
          setElectionData(data);
          // Check if user has already voted
          const currentUser = data.voters?.find(voter => voter.isCurrentUser);
          setHasVoted(currentUser?.hasVoted || false);
          
          // Auto-create tally if election has ended and tally doesn't exist yet
          const electionStatus = getElectionStatusFromData(data);
          
          if (electionStatus === 'Ended' && !data.encryptedTally) {
            console.log('Election has ended - creating tally automatically');
            await createTallyForElection(id);
          }
        }
      } catch (err) {
        setError('Failed to load election data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchElectionData();
    }
  }, [id]);

  // Create tally function
  const createTallyForElection = async (electionId) => {
    try {
      setCreatingTally(true);
      const tallyResponse = await electionApi.createTally(electionId);
      console.log('Tally creation response:', tallyResponse);
      setTallyCreated(true);
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

  // Load results when switching to results tab
  useEffect(() => {
    if (activeTab === 'results' && canUserViewResults() && !resultsData && !loadingResults) {
      loadElectionResults();
    }
  }, [activeTab]);

  const loadElectionResults = async () => {
    setLoadingResults(true);
    try {
      // Check if we need to combine partial decryptions first
      const totalBallots = electionData?.voters?.filter(v => v.hasVoted).length || 0;
      const totalVotesInChoices = electionData?.electionChoices?.reduce((sum, choice) => sum + (choice.totalVotes || 0), 0) || 0;
      
      if (totalVotesInChoices !== totalBallots && totalBallots > 0) {
        // Need to combine partial decryptions
        await combinePartialDecryptions();
      }
      
      // For now, use the data from electionData
      const processedResults = processElectionResults();
      setResultsData(processedResults);
    } catch (err) {
      console.error('Error loading results:', err);
    } finally {
      setLoadingResults(false);
    }
  };

  const combinePartialDecryptions = async () => {
    setCombiningDecryptions(true);
    try {
      const response = await electionApi.combinePartialDecryptions(id);
      console.log('Combined partial decryptions:', response);
      // Refresh election data to get updated results
      const updatedData = await electionApi.getElectionById(id);
      setElectionData(updatedData);
    } catch (err) {
      console.error('Error combining partial decryptions:', err);
    } finally {
      setCombiningDecryptions(false);
    }
  };

  const processElectionResults = () => {
    if (!electionData?.electionChoices) return null;
    
    const totalVotes = electionData.electionChoices.reduce((sum, choice) => sum + (choice.totalVotes || 0), 0);
    const totalEligibleVoters = electionData.voters?.length || 0;
    const totalVotedUsers = electionData.voters?.filter(v => v.hasVoted).length || 0;
    
    const chartData = electionData.electionChoices.map(choice => ({
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
      choices: electionData.electionChoices
    };
  };

  const handleVoteSubmit = (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setShowConfirmModal(true);
  };

  const handleConfirmVote = async () => {
    setIsSubmitting(true);
    setVoteError(null);
    
    try {
      const selectedChoice = electionData.electionChoices.find(
        choice => choice.choiceId.toString() === selectedCandidate
      );
      
      const result = await electionApi.castBallot(
        id,
        selectedChoice.choiceId,
        selectedChoice.optionTitle
      );
      
      // Store the voted candidate information with the result
      const voteResultWithCandidate = {
        ...result,
        votedCandidate: selectedChoice
      };
      
      setVoteResult(voteResultWithCandidate);
      setHasVoted(true);
      setSelectedCandidate('');
      setShowConfirmModal(false);
      
      // Update eligibility data to reflect that user has voted
      setEligibilityData(prev => ({
        ...prev,
        eligible: false,
        hasVoted: true,
        message: 'You have already voted in this election',
        reason: 'Already voted'
      }));
    } catch (err) {
      setVoteError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuardianKeySubmit = async (e) => {
    e.preventDefault();
    if (!guardianKey.trim()) return;
    
    setIsSubmittingKey(true);
    setKeySubmissionError(null);
    setKeySubmissionResult(null);
    
    try {
      const result = await electionApi.submitGuardianKey(id, guardianKey);
      
      if (result.success) {
        setKeySubmissionResult(result);
        setGuardianKey('');
        
        // Refresh election data to update guardian status
        const updatedData = await electionApi.getElectionById(id);
        setElectionData(updatedData);
      } else {
        setKeySubmissionError(result.message || 'Failed to submit guardian key');
      }
    } catch (err) {
      setKeySubmissionError(err.message || 'Failed to submit guardian key');
    } finally {
      setIsSubmittingKey(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const saveVoteDetails = () => {
    const details = `
Election: ${electionData.electionTitle}
Vote Hash: ${voteResult.hashCode}
Tracking Code: ${voteResult.trackingCode}
Date: ${timezoneUtils.formatForDisplay(new Date().toISOString())}
Candidate: ${voteResult.votedCandidate?.optionTitle || 'Unknown'}
Party: ${voteResult.votedCandidate?.partyName || 'N/A'}
    `.trim();
    
    const blob = new Blob([details], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-receipt-${id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
    
    resultsData.chartData.forEach((item, index) => {
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

  const getElectionStatus = () => {
    if (!electionData) return 'Unknown';
    
    const now = new Date();
    const startDate = new Date(electionData.startingTime);
    const endDate = new Date(electionData.endingTime);
    
    if (now < startDate) return 'Upcoming';
    if (now > endDate) return 'Ended';
    return 'Active';
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

  const canUserVote = () => {
    // Check if user can vote based on the new eligibility field
    return canUserVoteInElection(electionData) && getElectionStatus() === 'Active' && !hasVoted;
  };

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

  const canUserViewResults = () => {
    return electionData?.userRoles?.includes('admin') || 
           electionData?.userRoles?.includes('guardian') ||
           getElectionStatus() === 'Ended';
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
    
    return { canSubmit: true, reason: 'Ready to submit key' };
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{electionData.electionTitle}</h1>
              <p className="text-sm text-gray-500">Election ID: {electionData.electionId}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(getElectionStatus())}`}>
                {getElectionStatus()}
              </span>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FiUser className="h-4 w-4" />
                <span>
                  Your roles: {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {subMenus.map((menu) => {
              const Icon = menu.icon;
              return (
                <button
                  key={menu.key}
                  onClick={() => setActiveTab(menu.key)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === menu.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{menu.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <FiInfo className="h-5 w-5 mr-2" />
                Election Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <FiUsers className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Voters</p>
                    <p className="text-2xl font-semibold text-gray-900">{electionData.voters?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <FiShield className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Guardians</p>
                    <p className="text-2xl font-semibold text-gray-900">{electionData.guardians?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <FiCheckCircle className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Candidates</p>
                    <p className="text-2xl font-semibold text-gray-900">{electionData.electionChoices?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Candidates */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Candidates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {electionData.electionChoices?.map((choice) => (
                  <div key={choice.choiceId} className="border rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      {choice.candidatePic && (
                        <img src={choice.candidatePic} alt={choice.optionTitle} className="h-12 w-12 rounded-full object-cover" />
                      )}
                      <div>
                        <h4 className="font-medium text-gray-900">{choice.optionTitle}</h4>
                        <p className="text-sm text-gray-600">{choice.partyName}</p>
                        <p className="text-sm text-gray-500">{choice.optionDescription}</p>
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiCheckCircle className="h-5 w-5 mr-2" />
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
              <div className={`border rounded-lg p-4 mb-6 ${
                eligibilityData.eligible 
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
                    <h4 className={`font-semibold ${
                      eligibilityData.eligible 
                        ? 'text-green-900' 
                        : eligibilityData.hasVoted 
                          ? 'text-blue-900'
                          : 'text-red-900'
                    }`}>
                      {eligibilityData.message}
                    </h4>
                    <p className={`text-sm ${
                      eligibilityData.eligible 
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
                    <button
                      onClick={saveVoteDetails}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <FiSave className="h-4 w-4" />
                      <span>Save Vote Receipt</span>
                    </button>
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
            
            {/* Voting Form - Only Enabled if Eligible */}
            {!checkingEligibility && eligibilityData?.eligible && !voteResult && (
              <div className="max-w-2xl">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <FiInfo className="h-5 w-5 text-yellow-600 mr-2" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Voting Instructions</h4>
                      <p className="text-sm text-yellow-800 mt-1">
                        Select one candidate from the list below and click "Cast Vote" to submit your ballot. 
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
                        <div key={choice.choiceId} className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedCandidate === choice.choiceId.toString()
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
                      disabled={!selectedCandidate || isSubmitting}
                      className={`px-8 py-3 rounded-lg font-medium text-white transition-colors ${
                        !selectedCandidate || isSubmitting
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                      }`}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center space-x-2">
                          <FiLoader className="h-4 w-4 animate-spin" />
                          <span>Casting Vote...</span>
                        </div>
                      ) : (
                        'Cast Vote'
                      )}
                    </button>
                  </div>
                </form>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Confirm Your Vote</h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  You are about to cast your vote for:
                </p>
                {(() => {
                  const selectedChoice = electionData.electionChoices.find(
                    choice => choice.choiceId.toString() === selectedCandidate
                  );
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        {selectedChoice?.candidatePic && (
                          <img 
                            src={selectedChoice.candidatePic} 
                            alt={selectedChoice.optionTitle} 
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium text-blue-900">{selectedChoice?.optionTitle}</p>
                          {selectedChoice?.partyName && (
                            <p className="text-sm text-blue-700">{selectedChoice.partyName}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> This action cannot be undone. You will not be able to change your vote after submission.
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmVote}
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <FiLoader className="h-4 w-4 animate-spin" />
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

        {/* Guardian Keys Tab */}
        {activeTab === 'guardian' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiShield className="h-5 w-5 mr-2" />
              Guardian Key Submission
            </h3>
            {!canUserManageGuardian() ? (
              <div className="text-center py-8">
                <FiShield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Guardian Access Required</h4>
                <p className="text-gray-600">You need guardian privileges to access this section.</p>
              </div>
            ) : (
              <div className="space-y-6">
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
                    <h4 className="font-medium text-green-900 mb-2">Decryption Status</h4>
                    <p className="text-sm text-green-800">
                      {electionData.guardiansSubmitted || 0} of {electionData.totalGuardians || 0} guardians have submitted keys
                    </p>
                  </div>
                </div>

                {/* Key Submission Form */}
                {(() => {
                  const submitStatus = canSubmitGuardianKey();
                  
                  if (submitStatus.canSubmit) {
                    return (
                      <div className="border border-green-200 rounded-lg p-6">
                        <h4 className="font-medium text-green-900 mb-4 flex items-center">
                          <FiKey className="h-5 w-5 mr-2" />
                          Submit Your Guardian Key
                        </h4>
                        
                        {keySubmissionResult && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center">
                              <FiCheckCircle className="h-5 w-5 text-green-500 mr-2" />
                              <div>
                                <h5 className="font-medium text-green-900">Partial Decryption Successful</h5>
                                <p className="text-sm text-green-800 mt-1">
                                  {keySubmissionResult.message || "Your key has been verified and partial decryption has been completed."}
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
                                <h5 className="font-medium text-red-900">Key Submission Failed</h5>
                                <p className="text-sm text-red-800 mt-1">{keySubmissionError}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <form onSubmit={handleGuardianKeySubmit} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Guardian Private Key
                            </label>
                            <textarea
                              value={guardianKey}
                              onChange={(e) => setGuardianKey(e.target.value)}
                              placeholder="Enter your guardian private key here..."
                              rows={4}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                              required
                            />
                            <p className="text-sm text-gray-600 mt-1">
                              Enter the private key that was provided to you during the key ceremony.
                            </p>
                          </div>
                          
                          <div className="flex justify-center">
                            <button
                              type="submit"
                              disabled={!guardianKey.trim() || isSubmittingKey}
                              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                                !guardianKey.trim() || isSubmittingKey
                                  ? 'bg-gray-400 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              {isSubmittingKey ? (
                                <div className="flex items-center space-x-2">
                                  <FiLoader className="h-4 w-4 animate-spin" />
                                  <span>Submitting...</span>
                                </div>
                              ) : (
                                'Submit Guardian Key'
                              )}
                            </button>
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
                    {electionData.allGuardiansSubmitted && (
                      <div className="mt-2 flex items-center text-green-600">
                        <FiCheck className="h-4 w-4 mr-1" />
                        <span className="text-sm font-medium">All guardians have submitted their keys</span>
                      </div>
                    )}
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
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            guardian.decryptedOrNot ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiTrendingUp className="h-5 w-5 mr-2" />
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
                  const processedResults = processElectionResults();
                  if (!processedResults) return null;

                  const totalBallots = processedResults.totalVotedUsers;
                  const totalVotesInChoices = processedResults.totalVotes;
                  const needsDecryption = totalVotesInChoices !== totalBallots && totalBallots > 0;
                  const allGuardiansSubmitted = electionData.allGuardiansSubmitted || false;

                  return (
                    <>
                      {needsDecryption && !allGuardiansSubmitted && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                          <div className="flex items-center">
                            <FiAlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                            <div>
                              <h4 className="font-medium text-yellow-900">Waiting for Guardian Keys</h4>
                              <p className="text-sm text-yellow-800">
                                Final results are not yet available. Guardians need to submit their partial decryption keys.
                                ({electionData.guardiansSubmitted || 0} of {electionData.totalGuardians || 0} submitted)
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {needsDecryption && allGuardiansSubmitted && (
                        <div className="text-center mb-6">
                          <button
                            onClick={combinePartialDecryptions}
                            disabled={combiningDecryptions}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {combiningDecryptions ? 'Combining...' : 'Combine Partial Decryptions'}
                          </button>
                        </div>
                      )}

                      {/* Results Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-blue-50 rounded-lg text-center">
                          <h4 className="font-medium text-blue-900 mb-2">Total Votes Cast</h4>
                          <p className="text-2xl font-bold text-blue-800">{processedResults.totalVotes}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg text-center">
                          <h4 className="font-medium text-green-900 mb-2">Eligible Voters</h4>
                          <p className="text-2xl font-bold text-green-800">{processedResults.totalEligibleVoters}</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg text-center">
                          <h4 className="font-medium text-purple-900 mb-2">Voter Turnout</h4>
                          <p className="text-2xl font-bold text-purple-800">{processedResults.turnoutRate}%</p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-lg text-center">
                          <h4 className="font-medium text-orange-900 mb-2">Total Candidates</h4>
                          <p className="text-2xl font-bold text-orange-800">{processedResults.choices.length}</p>
                        </div>
                      </div>

                      {/* Download Options */}
                      <div className="flex justify-center space-x-4 mb-6">
                        <button
                          onClick={downloadResultsPDF}
                          className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                        >
                          <FiDownload className="h-4 w-4" />
                          <span>Download PDF</span>
                        </button>
                        <button
                          onClick={downloadResultsCSV}
                          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                        >
                          <FiDownload className="h-4 w-4" />
                          <span>Download CSV</span>
                        </button>
                      </div>

                      {/* Charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Bar Chart */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                            <FiBarChart className="h-4 w-4 mr-2" />
                            Vote Distribution (Bar Chart)
                          </h4>
                          <ResponsiveContainer width="100%" height={300}>
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
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                            <FiPieChart className="h-4 w-4 mr-2" />
                            Vote Share (Pie Chart)
                          </h4>
                          <ResponsiveContainer width="100%" height={300}>
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
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-4">Detailed Results</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
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
                                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                                      index === 0 ? 'bg-gold-100 text-gold-800' :
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
                                        style={{width: `${candidate.percentage}%`}}
                                      ></div>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}

              </div>
            )}
          </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <div className="bg-white rounded-lg shadow p-6">
            {!canUserViewVerification() ? (
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
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <FiEye className="h-5 w-5 mr-2" />
                  Election Verification
                </h3>
                
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <FiInfo className="h-5 w-5 text-blue-500 mr-2" />
                      <div>
                        <h4 className="font-medium text-blue-900">Cryptographic Verification</h4>
                        <p className="text-sm text-blue-800 mt-1">
                          This section displays cryptographic artifacts and proofs that can be used to verify the integrity of the election.
                          All data shown below can be independently verified using ElectionGuard verification tools.
                        </p>
                      </div>
                    </div>
                  </div>

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

              {electionData.guardians && electionData.guardians.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Guardian Information</h4>
                  {electionData.guardians.map((guardian, index) => (
                    <div key={guardian.userEmail} className="space-y-3">
                      <DataDisplay
                        title={`Guardian ${index + 1} Public Key (${guardian.userName})`}
                        data={guardian.guardianPublicKey || "Not available"}
                        type="text"
                      />
                      <DataDisplay
                        title={`Guardian ${index + 1} Polynomial`}
                        data={guardian.guardianPolynomial || "Not available"}
                      />
                      <DataDisplay
                        title={`Guardian ${index + 1} Decryption Status`}
                        data={guardian.decryptedOrNot ? "Submitted" : "Pending"}
                        type="text"
                      />
                    </div>
                  ))}
                </div>
              )}

              <DataDisplay
                title="Encrypted Tally"
                data={electionData.encryptedTally || "Not available"}
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

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Verification Instructions</h4>
                <div className="text-sm text-gray-700 space-y-2">
                  <p>• <strong>Joint Public Key:</strong> Used to encrypt all ballots in this election</p>
                  <p>• <strong>Commitment Hash:</strong> Cryptographic commitment to the election parameters</p>
                  <p>• <strong>Guardian Keys:</strong> Public keys and polynomials used in the threshold cryptography</p>
                  <p>• <strong>Encrypted Tally:</strong> The encrypted sum of all valid ballots</p>
                  <p>• <strong>Proofs:</strong> Zero-knowledge proofs that the tallying was performed correctly</p>
                </div>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> You can use these artifacts with ElectionGuard verification tools to independently verify that your vote was counted correctly and that the election results are mathematically sound.
                  </p>
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
