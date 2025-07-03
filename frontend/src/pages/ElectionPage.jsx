import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { electionApi } from '../utils/electionApi';
import { 
  FiCalendar, 
  FiClock, 
  FiUsers, 
  FiInfo, 
  FiShield, 
  FiCheckCircle, 
  FiUser,
  FiAlertCircle,
  FiTrendingUp
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
  const [submitted, setSubmitted] = useState(false);
  const [electionData, setElectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchElectionData = async () => {
      try {
        setLoading(true);
        const data = await electionApi.getElectionById(id);
        if (data === null) {
          setError('You are not authorized to view this election or the election does not exist.');
        } else {
          setElectionData(data);
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

  const handleVoteSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    // TODO: Implement actual vote submission logic
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
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
    const isEligibleVoter = electionData?.userRoles?.includes('voter') || electionData?.isPublic;
    return isEligibleVoter && getElectionStatus() === 'Active';
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
            {!canUserVote() ? (
              <div className="text-center py-8">
                <FiAlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Voting Not Available</h4>
                <p className="text-gray-600">
                  {!electionData.userRoles?.includes('voter') && !electionData.isPublic
                    ? 'You are not authorized to vote in this election.'
                    : getElectionStatus() !== 'Active'
                    ? 'Voting is only available during the election period.'
                    : 'Voting is not available at this time.'
                  }
                </p>
              </div>
            ) : submitted ? (
              <div className="text-center py-8">
                <FiCheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">Vote Submitted Successfully!</h4>
                <p className="text-gray-600">Thank you for participating in this election.</p>
              </div>
            ) : (
              <form onSubmit={handleVoteSubmit} className="max-w-2xl">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select your candidate:
                  </label>
                  <div className="space-y-3">
                    {electionData.electionChoices?.map((choice) => (
                      <div key={choice.choiceId} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                        <input
                          type="radio"
                          id={choice.choiceId}
                          name="candidate"
                          value={choice.choiceId}
                          checked={selectedCandidate === choice.choiceId.toString()}
                          onChange={(e) => setSelectedCandidate(e.target.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <label htmlFor={choice.choiceId} className="ml-3 flex-1 cursor-pointer">
                          <div className="flex items-center space-x-3">
                            {choice.candidatePic && (
                              <img src={choice.candidatePic} alt={choice.optionTitle} className="h-10 w-10 rounded-full object-cover" />
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{choice.optionTitle}</p>
                              <p className="text-sm text-gray-600">{choice.partyName}</p>
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!selectedCandidate}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Submit Vote
                </button>
              </form>
            )}
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
