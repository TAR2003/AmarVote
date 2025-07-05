import React, { useState, useEffect, useMemo, useCallback, memo, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllElections } from "../utils/api";
import { timezoneUtils } from "../utils/timezoneUtils";
import { FiCalendar, FiClock, FiUsers, FiInfo, FiLoader } from "react-icons/fi";

/**
 * AllElections Component - Optimized for single API call
 * 
 * This component fetches all election data (including user roles, voting status, etc.) 
 * in a single API call and uses only that data to render the entire UI.
 * No additional API calls are made in loops or for individual elections.
 * 
 * Expected election data structure from API:
 * {
 *   electionId: string,
 *   electionTitle: string,
 *   electionDescription: string,
 *   startingTime: string,
 *   endingTime: string,
 *   isPublic: boolean,
 *   userRoles: string[], // ['voter', 'admin', 'guardian']
 *   hasVoted: boolean,
 *   noOfCandidates: number,
 *   adminName: string,
 *   adminEmail: string
 * }
 */

// Skeleton component for loading states
const ElectionCardSkeleton = () => (
  <div className="p-6 border-b border-gray-200 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="h-6 bg-gray-300 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
        <div className="flex gap-2 mb-3">
          <div className="h-5 bg-gray-200 rounded w-16"></div>
          <div className="h-5 bg-gray-200 rounded w-20"></div>
        </div>
        <div className="flex gap-4">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
      <div className="h-8 bg-gray-200 rounded w-24"></div>
    </div>
  </div>
);

// Cache for election data
const electionCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Memoized Election Card component for better performance
const ElectionCard = memo(({ election, onElectionClick, getElectionStatus, getStatusColor }) => {
  const status = getElectionStatus(election);
  
  const handleClick = useCallback(() => {
    onElectionClick(election.electionId);
  }, [onElectionClick, election.electionId]);

  const handleActionClick = useCallback((e) => {
    e.stopPropagation();
    onElectionClick(election.electionId);
  }, [onElectionClick, election.electionId]);

  return (
    <div
      className="p-6 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            <h3 className="text-lg font-medium text-gray-900">
              {election.electionTitle}
            </h3>
            <span
              className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
            <span
              className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                election.isPublic 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-orange-100 text-orange-800'
              }`}
            >
              {election.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
          
          <p className="mt-1 text-sm text-gray-500">
            {election.electionDescription}
          </p>

          {/* User Roles */}
          <div className="mt-3 flex flex-wrap gap-2">
            {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  role === 'admin' ? 'bg-red-100 text-red-800' :
                  role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                  'bg-blue-100 text-blue-800'
                }`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
            ))}
            {canUserVoteInElection(election) && !election.userRoles?.includes('voter') && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {election.eligibility === 'unlisted' ? 'Eligible (Open)' : 'Eligible Voter'}
              </span>
            )}
          </div>
          
          <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center">
              <FiCalendar className="h-4 w-4 mr-1" />
              <span>
                {timezoneUtils.formatElectionDate(election.startingTime)}
              </span>
            </div>
            <div className="flex items-center">
              <FiClock className="h-4 w-4 mr-1" />
              <span>
                Ends: {timezoneUtils.formatElectionDate(election.endingTime)}
              </span>
            </div>
            <div className="flex items-center">
              <FiUsers className="h-4 w-4 mr-1" />
              <span>{election.noOfCandidates} candidates</span>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-gray-400">
            Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
          </div>
        </div>
        
        <div className="flex-shrink-0 ml-4">
          {status === "ongoing" && (
            <button                          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            election.hasVoted 
                              ? 'text-gray-700 bg-gray-200 cursor-not-allowed'
                              : (canUserVoteInElection(election) 
                                  ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-gray-500')
                          }`}
                          onClick={handleActionClick}
                          disabled={election.hasVoted && canUserVoteInElection(election)}
                        >
                          {(canUserVoteInElection(election) && !election.hasVoted) ? 'Vote Now' : 
                           election.hasVoted ? 'Already Voted' : 'View Election'}
            </button>
          )}
          {status === "upcoming" && (
            <button 
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={handleActionClick}
            >
              Set Reminder
            </button>
          )}
          {status === "completed" && (
            <button 
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={handleActionClick}
            >
              View Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

const AllElections = () => {
  const navigate = useNavigate();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [displayLimit, setDisplayLimit] = useState(10); // Limit initial render
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Optimized data loading with caching
  useEffect(() => {
    const loadElections = async () => {
      try {
        setLoading(true);
        
        // Check cache first
        const cacheKey = 'all_elections';
        const cached = electionCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log('Using cached election data');
          setElections(cached.data);
          setLoading(false);
          setInitialLoadComplete(true);
          return;
        }
        
        // Make a single API call to fetch all election data
        console.log('Fetching fresh election data');
        const electionData = await fetchAllElections();
        
        // Store all data from the API call
        setElections(electionData);
        setInitialLoadComplete(true);
        
        // Cache the data with timestamp
        electionCache.set(cacheKey, { 
          data: electionData, 
          timestamp: Date.now() 
        });
        
      } catch (err) {
        setError(err.message);
        console.error("Error loading elections:", err);
      } finally {
        setLoading(false);
      }
    };

    loadElections();
  }, []);

  // Handle navigation to election page - memoized
  const handleElectionClick = useCallback((electionId) => {
    navigate(`/election-page/${electionId}`);
  }, [navigate]);

  // Memoized election status function
  const getElectionStatus = useCallback((election) => {
    const now = new Date();
    const startTime = new Date(election.startingTime);
    const endTime = new Date(election.endingTime);

    if (startTime > now) return "upcoming";
    if (startTime <= now && endTime > now) return "ongoing";
    return "completed";
  }, []);

  // Memoized status color function
  const getStatusColor = useCallback((status) => {
    switch (status) {
      case "upcoming":
        return "bg-blue-100 text-blue-800";
      case "ongoing":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }, []);

  // Check if user can vote in the election based on eligibility criteria
  const canUserVoteInElection = useCallback((election) => {
    // If user is explicitly listed as voter, they can vote
    if (election.userRoles?.includes('voter')) {
      return true;
    }
    // If election eligibility is 'unlisted', anyone can vote
    if (election.eligibility === 'unlisted') {
      return true;
    }
    // For 'listed' eligibility, only users in voter role can vote
    return false;
  }, []);

  // Memoized filtered elections with progressive loading
  const { filteredElections, hasMore } = useMemo(() => {
    const now = new Date();
    
    // First filter by user role if specified
    let filtered = elections;
    if (["voter", "admin", "guardian"].includes(filter)) {
      filtered = elections.filter((election) => {
        if (filter === "voter") {
          // User can vote if they are explicitly listed as voter OR if election eligibility is 'unlisted'
          return canUserVoteInElection(election);
        } else {
          // For admin and guardian, check explicit roles only
          return election.userRoles && election.userRoles.includes(filter);
        }
      });
    }
    
    // Filter by public/private if specified
    if (filter === "public") {
      filtered = elections.filter((election) => election.isPublic === true);
    } else if (filter === "private") {
      filtered = elections.filter((election) => election.isPublic === false);
    }
    
    // Then filter by time-based status
    switch (filter) {
      case "upcoming":
        filtered = filtered.filter((e) => new Date(e.startingTime) > now);
        break;
      case "ongoing":
        filtered = filtered.filter(
          (e) => new Date(e.startingTime) <= now && new Date(e.endingTime) > now
        );
        break;
      case "completed":
        filtered = filtered.filter((e) => new Date(e.endingTime) <= now);
        break;
    }
    
    // Sort by most recent first for better UX
    filtered.sort((a, b) => new Date(b.startingTime) - new Date(a.startingTime));
    
    return {
      filteredElections: filtered.slice(0, displayLimit),
      hasMore: filtered.length > displayLimit
    };
  }, [elections, filter, displayLimit]);

  // Function to load more elections
  const loadMoreElections = useCallback(() => {
    setDisplayLimit(prev => prev + 10);
  }, []);

  // Reset display limit when filter changes
  useEffect(() => {
    setDisplayLimit(10);
  }, [filter]);

  // Memoized tab counts to prevent recalculation on every render
  const tabCounts = useMemo(() => {
    const now = new Date();
    return {
      all: elections.length,
      upcoming: elections.filter(e => new Date(e.startingTime) > now).length,
      ongoing: elections.filter(e => new Date(e.startingTime) <= now && new Date(e.endingTime) > now).length,
      completed: elections.filter(e => new Date(e.endingTime) <= now).length,
      public: elections.filter(e => e.isPublic === true).length,
      private: elections.filter(e => e.isPublic === false).length,
      voter: elections.filter(e => canUserVoteInElection(e)).length,
      admin: elections.filter(e => e.userRoles?.includes('admin')).length,
      guardian: elections.filter(e => e.userRoles?.includes('guardian')).length,
    };
  }, [elections]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
          
          {/* Filter tabs skeleton */}
          <div className="px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded-md w-20 animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Elections List Skeleton */}
        <div className="bg-white shadow rounded-lg">
          <div className="divide-y divide-gray-200">
            {[...Array(5)].map((_, i) => (
              <ElectionCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiInfo className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading elections
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">All Elections</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and participate in all elections you have access to
          </p>
        </div>
        
        {/* Filter tabs */}
        <div className="px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All Elections", count: tabCounts.all },
              { key: "upcoming", label: "Upcoming", count: tabCounts.upcoming },
              { key: "ongoing", label: "Ongoing", count: tabCounts.ongoing },
              { key: "completed", label: "Completed", count: tabCounts.completed },
              { key: "public", label: "Public", count: tabCounts.public },
              { key: "private", label: "Private", count: tabCounts.private },
              { key: "voter", label: "As Voter", count: tabCounts.voter },
              { key: "admin", label: "As Admin", count: tabCounts.admin },
              { key: "guardian", label: "As Guardian", count: tabCounts.guardian },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-white bg-opacity-20 text-current py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Elections List */}
      <div className="bg-white shadow rounded-lg">
        <div className="divide-y divide-gray-200">
          {filteredElections.length > 0 ? (
            filteredElections.map((election) => {
              const status = getElectionStatus(election);
              return (
                <div
                  key={election.electionId}
                  className="p-6 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => handleElectionClick(election.electionId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">
                          {election.electionTitle}
                        </h3>
                        <span
                          className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            status
                          )}`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        {/* Public/Private Indicator */}
                        <span
                          className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            election.isPublic 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {election.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      
                      <p className="mt-1 text-sm text-gray-500">
                        {election.electionDescription}
                      </p>

                      {/* User Roles */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              role === 'admin' ? 'bg-red-100 text-red-800' :
                              role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                              'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </span>
                        ))}
                        {/* Show eligible voter status */}
                        {canUserVoteInElection(election) && !election.userRoles?.includes('voter') && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {election.eligibility === 'unlisted' ? 'Eligible (Open)' : 'Eligible Voter'}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <FiCalendar className="h-4 w-4 mr-1" />
                          <span>
                            {timezoneUtils.formatElectionDate(election.startingTime)}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <FiClock className="h-4 w-4 mr-1" />
                          <span>
                            Ends: {timezoneUtils.formatElectionDate(election.endingTime)}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <FiUsers className="h-4 w-4 mr-1" />
                          <span>{election.noOfCandidates} candidates</span>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-400">
                        Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 ml-4">
                      {status === "ongoing" && (
                        <button 
                          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            election.hasVoted 
                              ? 'text-gray-700 bg-gray-200 cursor-not-allowed'
                              : (canUserVoteInElection(election) 
                                  ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-gray-500')
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleElectionClick(election.electionId);
                          }}
                          disabled={election.hasVoted && canUserVoteInElection(election)}
                        >
                          {/* Show Vote Now only if user is eligible and hasn't voted yet */}
                          {(canUserVoteInElection(election) && !election.hasVoted) ? 'Vote Now' : 
                           election.hasVoted ? 'Already Voted' : 'View Election'}
                        </button>
                      )}
                      {status === "upcoming" && (
                        <button 
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Set reminder functionality can be added here
                          }}
                        >
                          Set Reminder
                        </button>
                      )}
                      {status === "completed" && (
                        <button 
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleElectionClick(election.electionId);
                          }}
                        >
                          View Results
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <FiCalendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No elections found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === "all"
                  ? "You don't have access to any elections at the moment."
                  : `No ${filter} elections found.`}
              </p>
            </div>
          )}
        </div>
        
        {/* Load More Button */}
        {hasMore && filteredElections.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={loadMoreElections}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <FiLoader className="h-4 w-4 mr-2" />
              Load More Elections
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllElections;
