import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { electionApi } from '../utils/electionApi';
import { timezoneUtils } from '../utils/timezoneUtils';
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
  FiSave
} from 'react-icons/fi';

const subMenus = [
  { name: 'Election Info', key: 'info', icon: FiInfo },
  { name: 'Voting Booth', key: 'voting', icon: FiCheckCircle },
  { name: 'Guardian Keys', key: 'guardian', icon: FiShield },
  { name: 'Results', key: 'results', icon: FiTrendingUp },
];

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Upcoming': return 'bg-yellow-100 text-yellow-800';
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Ended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const canUserVote = () => {
    // User can vote if:
    // 1. They are explicitly listed as a voter, OR
    // 2. The election is public (no voter restrictions)
    // AND the election is currently active
    // AND they haven't already voted
    const isEligibleVoter = electionData?.userRoles?.includes('voter') || electionData?.isPublic;
    return isEligibleVoter && getElectionStatus() === 'Active' && !hasVoted;
  };

  const canUserManageGuardian = () => {
    return electionData?.userRoles?.includes('guardian');
  };

  const canUserViewResults = () => {
    return electionData?.userRoles?.includes('admin') || 
           electionData?.userRoles?.includes('guardian') ||
           getElectionStatus() === 'Ended';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading election data...</p>
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
                      if (electionData.isPublic && !roles.includes('voter')) {
                        roles.push('voter (public)');
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
                    <p><span className="font-medium">Type:</span> {electionData.isPublic ? 'Public' : 'Private'}</p>
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
              Guardian Management
            </h3>
            {!canUserManageGuardian() ? (
              <div className="text-center py-8">
                <FiShield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Guardian Access Required</h4>
                <p className="text-gray-600">You need guardian privileges to access this section.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Quorum Information</h4>
                    <p className="text-sm text-blue-800">
                      Required Guardians: {electionData.numberOfGuardians} | 
                      Quorum: {electionData.electionQuorum}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Active Guardians</h4>
                    <p className="text-sm text-green-800">
                      {electionData.guardians?.length || 0} of {electionData.numberOfGuardians} configured
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Guardian List</h4>
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
                            {guardian.decryptedOrNot ? 'Decrypted' : 'Pending'}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Total Votes</h4>
                    <p className="text-2xl font-bold text-blue-800">
                      {electionData.electionChoices?.reduce((total, choice) => total + choice.totalVotes, 0) || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Voter Turnout</h4>
                    <p className="text-2xl font-bold text-green-800">
                      {electionData.voters?.filter(v => v.hasVoted).length || 0} / {electionData.voters?.length || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-900 mb-2">Participation Rate</h4>
                    <p className="text-2xl font-bold text-purple-800">
                      {electionData.voters?.length ? 
                        Math.round((electionData.voters.filter(v => v.hasVoted).length / electionData.voters.length) * 100) : 0}%
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Vote Distribution</h4>
                  <div className="space-y-3">
                    {electionData.electionChoices?.map((choice) => {
                      const totalVotes = electionData.electionChoices.reduce((total, c) => total + c.totalVotes, 0);
                      const percentage = totalVotes > 0 ? (choice.totalVotes / totalVotes) * 100 : 0;
                      
                      return (
                        <div key={choice.choiceId} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              {choice.candidatePic && (
                                <img src={choice.candidatePic} alt={choice.optionTitle} className="h-8 w-8 rounded-full object-cover" />
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{choice.optionTitle}</p>
                                <p className="text-sm text-gray-600">{choice.partyName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{choice.totalVotes}</p>
                              <p className="text-sm text-gray-600">{percentage.toFixed(1)}%</p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{width: `${percentage}%`}}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
