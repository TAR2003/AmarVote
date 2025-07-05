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
  FiHash
} from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const ElectionTimer = ({ startTime, endTime }) => {
  const [timeStatus, setTimeStatus] = useState({
    isStarted: false,
    isEnded: false,
    timeLeft: 0,
    totalDuration: 0,
    progress: 0
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      const totalDuration = end - start;
      const timeLeft = end - now;
      const elapsed = now - start;
      
      const isStarted = now >= start;
      const isEnded = now >= end;
      
      let progress = 0;
      if (isStarted && !isEnded) {
        progress = (elapsed / totalDuration) * 100;
      } else if (isEnded) {
        progress = 100;
      }
      
      setTimeStatus({
        isStarted,
        isEnded,
        timeLeft: Math.max(0, timeLeft),
        totalDuration,
        progress: Math.min(100, Math.max(0, progress))
      });
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [startTime, endTime]);

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else {
      return `${minutes}m ${seconds}s`;
    }
  };

  const getStatusColor = () => {
    if (!timeStatus.isStarted) return '#6b7280'; // gray
    if (timeStatus.isEnded) return '#dc2626'; // red
    if (timeStatus.progress > 80) return '#f59e0b'; // yellow
    return '#10b981'; // green
  };

  const getStatusText = () => {
    if (!timeStatus.isStarted) return 'Not Started';
    if (timeStatus.isEnded) return 'Ended';
    return 'In Progress';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <FiClock className="h-5 w-5 mr-2" />
        Election Timer
      </h3>
      
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-8">
            <div className="text-center">
              <div className="w-24 h-24">
                <CircularProgressbar
                  value={timeStatus.progress}
                  text={`${Math.round(timeStatus.progress)}%`}
                  styles={buildStyles({
                    textSize: '16px',
                    pathColor: getStatusColor(),
                    textColor: getStatusColor(),
                    trailColor: '#e5e7eb',
                  })}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">Progress</p>
            </div>
            
            <div className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700">Status</h4>
                  <p className={`text-lg font-bold ${
                    timeStatus.isEnded ? 'text-red-600' :
                    timeStatus.isStarted ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {getStatusText()}
                  </p>
                </div>
                
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-700">Time Left</h4>
                  <p className="text-lg font-bold text-blue-800">
                    {timeStatus.isEnded ? '0s' : formatTime(timeStatus.timeLeft)}
                  </p>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-700">Duration</h4>
                  <p className="text-lg font-bold text-purple-800">
                    {formatTime(timeStatus.totalDuration)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DataDisplay = ({ title, data, isCollapsible = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `${title.toLowerCase().replace(/\s+/g, '_')}.json`);
  };

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
        <p className="text-gray-500 italic">No data available</p>
      </div>
    );
  }

  const displayData = Array.isArray(data) ? data : [data];
  const preview = JSON.stringify(displayData[0], null, 2).substring(0, 200);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900">{title}</h4>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <FiCopy className="h-4 w-4" />
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 text-sm text-green-600 hover:text-green-800"
          >
            <FiDownload className="h-4 w-4" />
            <span>Download</span>
          </button>
          {isCollapsible && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800"
            >
              <FiEye className="h-4 w-4" />
              <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-3">
        {isExpanded || !isCollapsible ? (
          <SyntaxHighlighter
            language="json"
            style={atomOneDark}
            customStyle={{ background: 'transparent', fontSize: '12px' }}
          >
            {JSON.stringify(displayData, null, 2)}
          </SyntaxHighlighter>
        ) : (
          <div className="text-sm text-gray-600 font-mono">
            {preview}
            {preview.length >= 200 && '...'}
            <button
              onClick={() => setIsExpanded(true)}
              className="text-blue-600 hover:text-blue-800 ml-2"
            >
              Show more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ElectionPage() {
  const { id } = useParams();
  const [electionData, setElectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [eligibilityData, setEligibilityData] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [tallyCreated, setTallyCreated] = useState(false);
  const [creatingTally, setCreatingTally] = useState(false);
  
  // Guardian key submission states
  const [guardianKey, setGuardianKey] = useState('');
  const [isSubmittingKey, setIsSubmittingKey] = useState(false);
  const [keySubmissionResult, setKeySubmissionResult] = useState(null);
  const [keySubmissionError, setKeySubmissionError] = useState(null);
  
  // Results combination states
  const [combiningDecryptions, setCombiningDecryptions] = useState(false);

  const formatDate = (dateString) => {
    return timezoneUtils.formatToLocalTime(dateString);
  };

  const getElectionStatus = () => {
    if (!electionData) return 'Unknown';
    
    const now = new Date();
    const start = new Date(electionData.startingTime);
    const end = new Date(electionData.endingTime);
    
    if (now < start) return 'Not Started';
    if (now > end) return 'Ended';
    return 'Active';
  };

  const canUserVote = () => {
    const status = getElectionStatus();
    return status === 'Active' && eligibilityData?.canVote;
  };

  const canUserManageGuardian = () => {
    if (!electionData?.guardians) return false;
    const currentUserEmail = localStorage.getItem('userEmail');
    return electionData.guardians.some(guardian => 
      guardian.userEmail === currentUserEmail
    );
  };

  const canUserViewResults = () => {
    return getElectionStatus() === 'Ended' || electionData?.earlyResultAccess;
  };

  const canSubmitGuardianKey = () => {
    const currentUserEmail = localStorage.getItem('userEmail');
    const guardian = electionData?.guardians?.find(g => g.userEmail === currentUserEmail);
    
    if (!guardian) {
      return { canSubmit: false, reason: 'You are not a guardian for this election' };
    }
    
    if (getElectionStatus() !== 'Ended') {
      return { canSubmit: false, reason: 'Election has not ended yet' };
    }
    
    if (guardian.decryptedOrNot) {
      return { canSubmit: false, reason: 'Partial decryption already submitted' };
    }
    
    return { canSubmit: true };
  };

  const menuItems = [
    { key: 'info', label: 'Information', icon: FiInfo },
    { key: 'voting', label: 'Voting Booth', icon: FiUsers },
    { key: 'guardian', label: 'Guardian Keys', icon: FiShield },
    { key: 'results', label: 'Results', icon: FiTrendingUp },
    { key: 'verification', label: 'Verification', icon: FiEye }
  ];

  const fetchElectionData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await electionApi.getElectionById(id);
      setElectionData(data);
    } catch (err) {
      setError(err.message || 'Failed to load election data');
      toast.error('Failed to load election data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const checkEligibility = useCallback(async () => {
    try {
      setCheckingEligibility(true);
      const data = await electionApi.checkEligibility(id);
      setEligibilityData(data);
    } catch (err) {
      console.error('Failed to check eligibility:', err);
      setEligibilityData({ canVote: false, reason: 'Failed to check eligibility' });
    } finally {
      setCheckingEligibility(false);
    }
  }, [id]);

  const fetchResults = useCallback(async () => {
    try {
      setLoadingResults(true);
      const data = await electionApi.getResults(id);
      setResultsData(data);
    } catch (err) {
      console.error('Failed to load results:', err);
      toast.error('Failed to load election results');
    } finally {
      setLoadingResults(false);
    }
  }, [id]);

  const createTally = useCallback(async () => {
    try {
      setCreatingTally(true);
      await electionApi.createTally(id);
      setTallyCreated(true);
      toast.success('Tally created successfully');
    } catch (err) {
      console.error('Failed to create tally:', err);
      toast.error('Failed to create tally: ' + err.message);
    } finally {
      setCreatingTally(false);
    }
  }, [id]);

  const handleGuardianKeySubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingKey(true);
    setKeySubmissionError(null);
    setKeySubmissionResult(null);
    
    try {
      const result = await electionApi.submitGuardianKey(id, {
        guardianKey: guardianKey.trim()
      });
      
      setKeySubmissionResult(result);
      setGuardianKey('');
      toast.success('Guardian key submitted successfully!');
      
      // Refresh election data to update guardian status
      await fetchElectionData();
    } catch (err) {
      setKeySubmissionError(err.message || 'Failed to submit guardian key');
      toast.error('Failed to submit guardian key');
    } finally {
      setIsSubmittingKey(false);
    }
  };

  const combinePartialDecryptions = async () => {
    setCombiningDecryptions(true);
    try {
      await electionApi.combinePartialDecryptions(id);
      toast.success('Partial decryptions combined successfully!');
      
      // Refresh results after combination
      await fetchResults();
    } catch (err) {
      console.error('Failed to combine partial decryptions:', err);
      toast.error('Failed to combine partial decryptions: ' + err.message);
    } finally {
      setCombiningDecryptions(false);
    }
  };

  const processElectionResults = () => {
    if (!resultsData || !electionData) return null;

    const choices = electionData.electionChoices || [];
    const totalVotes = choices.reduce((sum, choice) => sum + (choice.totalVotes || 0), 0);
    const totalEligibleVoters = electionData.totalEligibleVoters || 0;
    const totalVotedUsers = resultsData.totalVotedUsers || 0;

    const chartData = choices.map(choice => ({
      name: choice.candidateName,
      votes: choice.totalVotes || 0,
      percentage: totalVotes > 0 ? ((choice.totalVotes || 0) / totalVotes * 100).toFixed(1) : '0.0',
      party: choice.partyName || 'Independent'
    }));

    return {
      choices: chartData,
      totalVotes,
      totalEligibleVoters,
      totalVotedUsers,
      turnoutRate: totalEligibleVoters > 0 ? ((totalVotedUsers / totalEligibleVoters) * 100).toFixed(1) : '0.0',
      chartData
    };
  };

  const downloadResultsPDF = async () => {
    const processedResults = processElectionResults();
    if (!processedResults) return;

    const pdf = new jsPDF();
    
    // Title
    pdf.setFontSize(20);
    pdf.text(`Election Results: ${electionData.title}`, 20, 30);
    
    // Summary
    pdf.setFontSize(12);
    pdf.text(`Total Votes: ${processedResults.totalVotes}`, 20, 50);
    pdf.text(`Eligible Voters: ${processedResults.totalEligibleVoters}`, 20, 65);
    pdf.text(`Turnout Rate: ${processedResults.turnoutRate}%`, 20, 80);
    
    // Results table
    const tableData = processedResults.chartData
      .sort((a, b) => b.votes - a.votes)
      .map((candidate, index) => [
        index + 1,
        candidate.name,
        candidate.party,
        candidate.votes,
        `${candidate.percentage}%`
      ]);
    
    pdf.autoTable({
      head: [['Rank', 'Candidate', 'Party', 'Votes', 'Percentage']],
      body: tableData,
      startY: 90,
    });
    
    pdf.save(`${electionData.title}_Results.pdf`);
    toast.success('PDF downloaded successfully!');
  };

  const downloadResultsCSV = () => {
    const processedResults = processElectionResults();
    if (!processedResults) return;

    const csvData = [
      ['Rank', 'Candidate', 'Party', 'Votes', 'Percentage'],
      ...processedResults.chartData
        .sort((a, b) => b.votes - a.votes)
        .map((candidate, index) => [
          index + 1,
          candidate.name,
          candidate.party || 'Independent',
          candidate.votes,
          `${candidate.percentage}%`
        ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${electionData.title}_Results.csv`);
    toast.success('CSV downloaded successfully!');
  };

  useEffect(() => {
    if (id) {
      fetchElectionData();
    }
  }, [id, fetchElectionData]);

  // Auto-check eligibility when switching to voting tab
  useEffect(() => {
    if (activeTab === 'voting' && id && !eligibilityData && !checkingEligibility) {
      checkEligibility();
    }
  }, [activeTab, id, eligibilityData, checkingEligibility, checkEligibility]);

  // Auto-fetch results when switching to results tab
  useEffect(() => {
    if (activeTab === 'results' && canUserViewResults() && !resultsData && !loadingResults) {
      fetchResults();
    }
  }, [activeTab, resultsData, loadingResults, fetchResults]);

  // Auto-create tally on page load
  useEffect(() => {
    if (electionData && !tallyCreated && !creatingTally) {
      createTally();
    }
  }, [electionData, tallyCreated, creatingTally, createTally]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading election data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!electionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="h-8 w-8 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Election not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{electionData.title}</h1>
              <p className="text-gray-600 mt-1">{electionData.description}</p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                getElectionStatus() === 'Active' ? 'bg-green-100 text-green-800' :
                getElectionStatus() === 'Ended' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getElectionStatus()}
              </div>
            </div>
          </div>
        </div>

        {/* Election Timer */}
        <ElectionTimer 
          startTime={electionData.startingTime} 
          endTime={electionData.endingTime} 
        />

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {menuItems.map((menu) => {
                const Icon = menu.icon;
                return (
                  <button
                    key={menu.key}
                    onClick={() => setActiveTab(menu.key)}
                    className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === menu.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{menu.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiInfo className="h-5 w-5 mr-2" />
              Election Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center">
                  <FiCalendar className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Start Time</p>
                    <p className="text-gray-600">{formatDate(electionData.startingTime)}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <FiCalendar className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">End Time</p>
                    <p className="text-gray-600">{formatDate(electionData.endingTime)}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <FiUsers className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Eligible Voters</p>
                    <p className="text-gray-600">{electionData.totalEligibleVoters || 'Not specified'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center">
                  <FiShield className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Number of Guardians</p>
                    <p className="text-gray-600">{electionData.numberOfGuardians}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <FiCheckCircle className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Election Quorum</p>
                    <p className="text-gray-600">{electionData.electionQuorum}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <FiTrendingUp className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Candidates</p>
                    <p className="text-gray-600">{electionData.electionChoices?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {electionData.electionChoices && electionData.electionChoices.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Candidates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {electionData.electionChoices.map((choice, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h5 className="font-medium text-gray-900">{choice.candidateName}</h5>
                      {choice.partyName && (
                        <p className="text-sm text-gray-600">{choice.partyName}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'voting' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiUsers className="h-5 w-5 mr-2" />
              Voting Booth
            </h3>
            {checkingEligibility ? (
              <div className="text-center py-8">
                <FiLoader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Checking your eligibility...</p>
              </div>
            ) : !eligibilityData?.canVote ? (
              <div className="text-center py-8">
                <FiX className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Cannot Vote</h4>
                <p className="text-gray-600">{eligibilityData?.reason || 'You are not eligible to vote in this election.'}</p>
              </div>
            ) : getElectionStatus() !== 'Active' ? (
              <div className="text-center py-8">
                <FiClock className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Voting Not Available</h4>
                <p className="text-gray-600">
                  {getElectionStatus() === 'Not Started' 
                    ? `Voting will open on ${formatDate(electionData.startingTime)}`
                    : 'Voting has ended for this election'
                  }
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <FiCheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Ready to Vote</h4>
                <p className="text-gray-600 mb-6">You are eligible to vote in this election.</p>
                <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
                  Cast Your Vote
                </button>
              </div>
            )}
          </div>
        )}

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
                      {electionData.guardians?.filter(g => g.decryptedOrNot).length || 0} of {electionData.guardians?.length || 0} guardians have submitted keys
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
                                  Your key has been verified and partial decryption has been completed.
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
                  <div className="space-y-2">
                    {electionData.guardians?.map((guardian) => (
                      <div key={guardian.userEmail} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FiUser className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{guardian.userEmail}</p>
                            <p className="text-sm text-gray-600">Guardian {guardian.guardianSequenceOrder}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {guardian.decryptedOrNot ? (
                            <span className="flex items-center space-x-1 text-green-600">
                              <FiCheckCircle className="h-4 w-4" />
                              <span className="text-sm">Submitted</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1 text-yellow-600">
                              <FiClock className="h-4 w-4" />
                              <span className="text-sm">Pending</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiTrendingUp className="h-5 w-5 mr-2" />
              Election Results
            </h3>
            
            {!canUserViewResults() ? (
              <div className="text-center py-8">
                <FiLock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Results Not Available</h4>
                <p className="text-gray-600">Results will be available after the election ends.</p>
              </div>
            ) : loadingResults ? (
              <div className="text-center py-8">
                <FiLoader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading election results...</p>
              </div>
            ) : !resultsData ? (
              <div className="text-center py-8">
                <FiAlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">No Results Available</h4>
                <p className="text-gray-600">Results data is not yet available.</p>
                <button
                  onClick={fetchResults}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <FiRefreshCw className="h-4 w-4 inline mr-2" />
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-6">
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
                  const allGuardiansSubmitted = electionData.guardians?.every(g => g.decryptedOrNot) || false;

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
                                ({electionData.guardians?.filter(g => g.decryptedOrNot).length || 0} of {electionData.guardians?.length || 0} submitted)
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
                              <XAxis 
                                dataKey="name" 
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                fontSize={12}
                              />
                              <YAxis />
                              <Tooltip 
                                formatter={(value, name) => [value, 'Votes']}
                                labelFormatter={(label) => `Candidate: ${label}`}
                              />
                              <Legend />
                              <Bar dataKey="votes" fill="#3B82F6" name="Votes" />
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
                                label={({name, percentage}) => `${name}: ${percentage}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="votes"
                              >
                                {processedResults.chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value, name) => [value, 'Votes']} />
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
                                      index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                      index === 1 ? 'bg-gray-100 text-gray-800' :
                                      index === 2 ? 'bg-orange-100 text-orange-800' :
                                      'bg-blue-100 text-blue-800'
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

        {activeTab === 'verification' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiEye className="h-5 w-5 mr-2" />
              Election Verification
            </h3>
            <p className="text-gray-600 mb-6">
              This section displays cryptographic artifacts that can be used to verify the integrity and correctness of the election.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DataDisplay 
                title="Joint Public Key" 
                data={electionData.jointPublicKey} 
              />
              <DataDisplay 
                title="Commitment Hash" 
                data={electionData.commitmentHash} 
              />
              <DataDisplay 
                title="Guardian Public Keys" 
                data={electionData.guardians?.map(g => ({
                  email: g.userEmail,
                  sequence: g.guardianSequenceOrder,
                  publicKey: g.publicKey
                }))} 
              />
              <DataDisplay 
                title="Guardian Polynomials" 
                data={electionData.guardians?.map(g => ({
                  email: g.userEmail,
                  sequence: g.guardianSequenceOrder,
                  polynomial: g.polynomial
                }))} 
              />
              <DataDisplay 
                title="Encrypted Tally" 
                data={electionData.encryptedTally} 
              />
              <DataDisplay 
                title="Sample Encrypted Ballots" 
                data={electionData.encryptedBallots?.slice(0, 5)} 
              />
              <DataDisplay 
                title="Election Manifest" 
                data={electionData.manifest} 
              />
              <DataDisplay 
                title="Election Parameters" 
                data={{
                  numberOfGuardians: electionData.numberOfGuardians,
                  electionQuorum: electionData.electionQuorum,
                  startingTime: electionData.startingTime,
                  endingTime: electionData.endingTime,
                  totalEligibleVoters: electionData.totalEligibleVoters
                }} 
              />
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                <FiInfo className="h-4 w-4 mr-2" />
                Verification Instructions
              </h4>
              <p className="text-sm text-blue-800">
                These cryptographic artifacts can be used with ElectionGuard verification tools to independently verify 
                the election results. Each piece of data can be downloaded in JSON format for use with verification software.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
