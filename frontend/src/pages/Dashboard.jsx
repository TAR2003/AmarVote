import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiCheckCircle,
  FiBarChart2,
  FiClock,
  FiAward,
} from "react-icons/fi";
import { fetchAllElections } from "../utils/api";
import { timezoneUtils } from "../utils/timezoneUtils";

/**
 * Dashboard Component - Optimized for single API call
 * 
 * This component fetches all election data (including user roles, voting status, etc.) 
 * in a single API call and uses only that data to render the entire UI.
 * No additional API calls are made in loops or for individual elections.
 * 
 * Only the top 3 elections are shown in each category for better performance and UX.
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

// Lazy load heavy components
const ElectionCardSkeleton = () => (
  <div className="p-4 bg-white rounded-lg shadow animate-pulse">
    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
  </div>
);

// Memoized election card component
const ElectionCard = React.memo(({ election, getVoteButtonInfo, handleElectionClick }) => {
  const { buttonText, buttonStyle, isDisabled } = getVoteButtonInfo(election);
  
  return (
    <div
      className="p-4 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
      onClick={() => handleElectionClick(election.electionId)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            <h3 className="text-base font-medium text-gray-900">
              {election.electionTitle}
            </h3>
            <span
              className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                election.isPublic 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-orange-100 text-orange-800'
              }`}
            >
              {election.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
          
          <p className="text-sm text-gray-500 mt-1 truncate">
            {election.electionDescription}
          </p>

          <div className="mt-2 flex flex-wrap gap-1">
            {election.userRoles && election.userRoles.slice(0, 2).map((role) => (
              <span
                key={role}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  role === 'admin' ? 'bg-red-100 text-red-800' :
                  role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                  'bg-blue-100 text-blue-800'
                }`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
            ))}
            {election.isPublic && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Eligible Voter
              </span>
            )}
          </div>
          
          <div className="mt-2 text-xs text-gray-400">
            {timezoneUtils.formatShortDate(election.startingTime)}
            {' - '}
            {timezoneUtils.formatShortDate(election.endingTime)}
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          <button 
            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonStyle}`}
            onClick={(e) => {
              e.stopPropagation();
              handleElectionClick(election.electionId);
            }}
            disabled={isDisabled}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
});

// Cache for election data
const electionCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const Dashboard = ({ userEmail }) => {
  const navigate = useNavigate();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Number of elections to display per section
  const MAX_DISPLAY_COUNT = 3;

  // Optimized memoized calculations to prevent unnecessary re-computations
  const { upcoming, ongoing, completed } = useMemo(() => {
    if (!elections.length) return { upcoming: [], ongoing: [], completed: [] };
    
    const now = new Date();
    const categorized = elections.reduce((acc, election) => {
      const startTime = new Date(election.startingTime);
      const endTime = new Date(election.endingTime);
      
      if (startTime > now) {
        acc.upcoming.push(election);
      } else if (startTime <= now && endTime > now) {
        acc.ongoing.push(election);
      } else {
        acc.completed.push(election);
      }
      return acc;
    }, { upcoming: [], ongoing: [], completed: [] });
    
    // Sort each category by date (upcoming by start date, others by end date)
    categorized.upcoming.sort((a, b) => new Date(a.startingTime) - new Date(b.startingTime));
    categorized.ongoing.sort((a, b) => new Date(b.endingTime) - new Date(a.endingTime));
    categorized.completed.sort((a, b) => new Date(b.endingTime) - new Date(a.endingTime));
    
    // Limit to top 3 elections in each category
    return {
      upcoming: categorized.upcoming.slice(0, MAX_DISPLAY_COUNT),
      ongoing: categorized.ongoing.slice(0, MAX_DISPLAY_COUNT),
      completed: categorized.completed.slice(0, MAX_DISPLAY_COUNT)
    };
  }, [elections]);

  // Optimized stats calculation with reduced calculations
  const stats = useMemo(() => [
    {
      name: "Upcoming Elections",
      value: upcoming.length.toString(),
      icon: FiCalendar,
      change: "+2",
      changeType: "positive",
    },
    {
      name: "Available Elections", 
      value: ongoing.length.toString(),
      icon: FiCheckCircle,
      change: "+1",
      changeType: "positive",
    },
    {
      name: "Total Elections",
      value: elections.length.toString(),
      icon: FiBarChart2,
      change: `+${elections.length}`,
      changeType: "positive",
    },
    {
      name: "Completed",
      value: completed.length.toString(),
      icon: FiClock,
      change: "0",
      changeType: "neutral",
    },
  ], [upcoming.length, ongoing.length, elections.length, completed.length]);

  // Optimized data loading with caching
  useEffect(() => {
    const loadElections = async () => {
      if (!userEmail) return;
      
      try {
        setLoading(true);
        
        // Check cache first - use the same cache key as AllElections
        // to avoid multiple API calls if both components are used in the same session
        const cacheKey = 'all_elections';
        const cached = electionCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log('Dashboard: Using cached election data');
          setElections(cached.data);
          setLoading(false);
          setInitialLoadComplete(true);
          return;
        }
        
        // Make a single API call to fetch all election data
        console.log('Dashboard: Fetching fresh election data');
        const electionData = await fetchAllElections();
        
        // Store all data from the API call
        setElections(electionData);
        setLoading(false);
        setInitialLoadComplete(true);
        
        // Cache the data with timestamp - using same cache key for consistency
        electionCache.set(cacheKey, { 
          data: electionData, 
          timestamp: Date.now() 
        });
        
      } catch (err) {
        setError(err.message);
        console.error("Error loading elections:", err);
        setLoading(false);
      }
    };

    loadElections();
  }, [userEmail]);

  // Handle navigation to election page
  const handleElectionClick = useCallback((electionId) => {
    navigate(`/election-page/${electionId}`);
  }, [navigate]);

  // Optimized vote button info using only initial fetch data
  const getVoteButtonInfo = useCallback((election) => {
    const now = new Date();
    const startTime = new Date(election.startingTime);
    const endTime = new Date(election.endingTime);
    
    // Default values
    let buttonText = "View Election";
    let buttonStyle = "text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-gray-500";
    let isDisabled = false;
    
    // Check if election is active
    const isActive = startTime <= now && endTime > now;
    
    if (!isActive) {
      // Election is not active (upcoming or ended)
      if (startTime > now) {
        buttonText = "Upcoming";
        buttonStyle = "text-blue-700 bg-blue-100 cursor-not-allowed";
        isDisabled = true;
      } else {
        buttonText = "View Results";
        buttonStyle = "text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500";
      }
      return { buttonText, buttonStyle, isDisabled };
    }
    
    // Election is active - check if user has already voted
    if (election.hasVoted) {
      buttonText = "Already Voted";
      buttonStyle = "text-gray-700 bg-gray-200 cursor-not-allowed";
      isDisabled = true;
      return { buttonText, buttonStyle, isDisabled };
    }
    
    // Check if user can vote based on election type and user roles
    const canVote = election.isPublic || 
                   (election.userRoles && election.userRoles.includes('voter'));
    
    if (canVote) {
      buttonText = "Vote Now";
      buttonStyle = "text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500";
    } else {
      buttonText = "Not Allowed";
      buttonStyle = "text-red-700 bg-red-100 cursor-not-allowed";
      isDisabled = true;
    }
    
    return { buttonText, buttonStyle, isDisabled };
  }, []);

  // Optimized loading screen with skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Welcome Banner Skeleton */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            <div className="animate-pulse">
              <div className="h-8 bg-white bg-opacity-20 rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-white bg-opacity-10 rounded w-1/2"></div>
            </div>
          </div>
        </div>
        
        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white shadow rounded-xl p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Elections Sections Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white shadow rounded-xl p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <ElectionCardSkeleton key={j} />
                  ))}
                </div>
              </div>
            </div>
          ))}
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
              <FiClock className="h-5 w-5 text-red-400" />
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
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-8 sm:p-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome back, {userEmail.split("@")[0]}!
              </h1>
              <p className="mt-2 text-blue-100 max-w-lg">
                You have {ongoing.length} active elections to participate in. Make your voice
                heard!
              </p>
            </div>
            <div className="hidden sm:block">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <FiAward className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white overflow-hidden shadow rounded-xl hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {stat.name}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stat.value}
                    </div>
                    <div
                      className={`ml-2 flex items-baseline text-sm font-semibold ${
                        stat.changeType === "positive"
                          ? "text-green-600"
                          : stat.changeType === "negative"
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      {stat.change}
                    </div>
                  </dd>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Elections Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Available Elections */}
        <div className="bg-white shadow rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Available Elections
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Elections you can currently participate in
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {ongoing.length > 0 ? (
              ongoing.map((election) => (
                <div
                  key={election.electionId}
                  className="p-4 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => handleElectionClick(election.electionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-base font-medium text-gray-900">
                          {election.electionTitle}
                        </h3>
                        {/* Public/Private Indicator */}
                        <span
                          className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            election.isPublic 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {election.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-500 mt-1">
                        {election.electionDescription}
                      </p>

                      {/* User Roles */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              role === 'admin' ? 'bg-red-100 text-red-800' :
                              role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                              'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </span>
                        ))}
                        {/* Show eligible voter status for public elections */}
                        {election.isPublic && (
                          <span className="inline-flex items-center px-2.py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Eligible Voter (Public)
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-400">
                        Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-1">
                        Ends: {timezoneUtils.formatElectionDate(election.endingTime)}
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {(() => {
                        const { buttonText, buttonStyle, isDisabled } = getVoteButtonInfo(election);
                        return (
                          <button 
                            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonStyle}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleElectionClick(election.electionId);
                            }}
                            disabled={isDisabled}
                          >
                            {buttonText}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-500">
                  No available elections at this time
                </p>
              </div>
            )}
            {ongoing.length > MAX_DISPLAY_COUNT && (
              <div className="p-4 text-center">
                <button 
                  onClick={() => navigate('/all-elections')} 
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View All Available Elections
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Recent Activity
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Your recent voting participation
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {completed.length > 0 ? (
              completed.map((election) => (
                <div
                  key={election.electionId}
                  className="p-4 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => handleElectionClick(election.electionId)}
                >
                  <div className="flex items-start">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-base font-medium text-gray-900">
                          {election.electionTitle}
                        </h3>
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
                      
                      <p className="text-sm text-gray-500 mt-1">
                        {election.electionDescription}
                      </p>

                      {/* User Roles */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              role === 'admin' ? 'bg-red-100 text-red-800' :
                              role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                              'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </span>
                        ))}
                        {/* Show eligible voter status for public elections */}
                        {election.isPublic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Eligible Voter (Public)
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-400">
                        Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-1">
                        Ended on {timezoneUtils.formatShortDate(election.endingTime)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-500">No recent activity to display</p>
              </div>
            )}
            {completed.length > MAX_DISPLAY_COUNT && (
              <div className="p-4 text-center">
                <button 
                  onClick={() => navigate('/all-elections?filter=completed')} 
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View All Completed Elections
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Elections */}
      <div className="bg-white shadow rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Upcoming Elections
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Mark your calendar for these important dates
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {upcoming.length > 0 ? (
            upcoming.map((election) => (
              <div
                key={election.electionId}
                className="p-4 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                onClick={() => handleElectionClick(election.electionId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-base font-medium text-gray-900">
                        {election.electionTitle}
                      </h3>
                      {/* Public/Private Indicator */}
                      <span
                        className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          election.isPublic 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {election.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-500 mt-1">
                      {election.electionDescription}
                    </p>

                    {/* User Roles */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            role === 'admin' ? 'bg-red-100 text-red-800' :
                            role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                            'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      ))}
                      {/* Show eligible voter status for public elections */}
                      {election.isPublic && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Eligible Voter (Public)
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-400">
                      Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                    </div>
                    
                    <div className="mt-1 flex items-center text-xs text-gray-500">
                      <FiCalendar className="h-3 w-3 mr-1" />
                      <span>Starts: {timezoneUtils.formatElectionDate(election.startingTime)}</span>
                    </div>
                  </div>
                  <button
                    className="ml-4 px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Set reminder functionality would go here
                      handleElectionClick(election.electionId);
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">No upcoming elections scheduled</p>
            </div>
          )}
          {upcoming.length > MAX_DISPLAY_COUNT && (
            <div className="p-4 text-center">
              <button 
                onClick={() => navigate('/all-elections?filter=upcoming')} 
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View All Upcoming Elections
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
