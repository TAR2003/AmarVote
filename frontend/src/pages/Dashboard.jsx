import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiBarChart2,
  FiUsers,
  FiUserCheck,
  FiAward,
} from "react-icons/fi";
import { userApi } from "../utils/userApi";
import { useElections } from "../context/ElectionsContext";
import ElectionBrowseCard from "../components/ElectionBrowseCard";

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
  <div className="surface-card animate-pulse p-5">
    <div className="mb-3 h-4 w-3/4 rounded-lg bg-glacier"></div>
    <div className="h-3 w-1/2 rounded-lg bg-frost"></div>
  </div>
);

const Dashboard = ({ userEmail }) => {
  const navigate = useNavigate();
  const { elections, loading: electionsLoading, error: electionsError } = useElections();
  const [userStats, setUserStats] = useState({ registeredUsers: 0, activeUsers: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const loading = electionsLoading || statsLoading;
  const error = electionsError;
  
  // Number of elections to display per section
  const MAX_DISPLAY_COUNT = 3;

  // Optimized memoized calculations to prevent unnecessary re-computations
  const { upcoming, ongoing, completed, upcomingCount, ongoingCount, completedCount } = useMemo(() => {
    if (!elections.length) {
      return {
        upcoming: [],
        ongoing: [],
        completed: [],
        upcomingCount: 0,
        ongoingCount: 0,
        completedCount: 0,
      };
    }
    
    const now = new Date();
    const categorized = elections.reduce((acc, election) => {
      if (!election.startingTime || !election.endingTime) {
        acc.upcoming.push(election);
        return acc;
      }

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
      completed: categorized.completed.slice(0, MAX_DISPLAY_COUNT),
      upcomingCount: categorized.upcoming.length,
      ongoingCount: categorized.ongoing.length,
      completedCount: categorized.completed.length,
    };
  }, [elections]);

  // Compute dashboard counters from all elections.
  const electionCounts = useMemo(() => {
    const now = new Date();
    let completedCount = 0;

    elections.forEach((election) => {
      if (!election.endingTime) return;

      const endTime = new Date(election.endingTime);
      if (!Number.isNaN(endTime.getTime()) && endTime <= now) {
        completedCount += 1;
      }
    });

    return {
      totalCount: elections.length,
      completedCount,
    };
  }, [elections]);

  const stats = useMemo(() => [
    {
      name: "Total Elections",
      value: electionCounts.totalCount.toString(),
      icon: FiBarChart2,
      gradient: "from-blue-500 to-brand-dark",
      iconBg: "bg-glacier",
      iconColor: "text-brand",
      ring: "ring-blue-100",
    },
    {
      name: "Completed Elections",
      value: electionCounts.completedCount.toString(),
      icon: FiCheckCircle,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      ring: "ring-emerald-100",
    },
    {
      name: "Registered Users",
      value: userStats.registeredUsers.toLocaleString(),
      icon: FiUsers,
      gradient: "from-deep to-ink",
      iconBg: "bg-frost",
      iconColor: "text-ink",
      ring: "ring-glacier",
    },
    {
      name: "Active Users",
      value: userStats.activeUsers.toLocaleString(),
      subtitle: "30m",
      icon: FiUserCheck,
      gradient: "from-amber-500 to-orange-600",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      ring: "ring-amber-100",
      pulse: userStats.activeUsers > 0,
    },
  ], [electionCounts, userStats]);

  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;
    setStatsLoading(true);

    userApi.getUserStats()
      .then((statsData) => {
        if (!cancelled) {
          setUserStats(statsData);
        }
      })
      .catch((err) => {
        console.error("Error loading user stats:", err);
      })
      .finally(() => {
        if (!cancelled) {
          setStatsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  // Handle navigation to election page
  const handleElectionClick = useCallback((electionId) => {
    navigate(`/election-page/${electionId}`);
  }, [navigate]);

  // Optimized vote button info using only initial fetch data
  const getVoteButtonInfo = useCallback((election) => {
    if (!election.startingTime || !election.endingTime) {
      return {
        buttonText: "Key Ceremony",
        buttonStyle: "text-ink bg-glacier hover:bg-frost focus:ring-brand",
        isDisabled: false,
      };
    }

    const now = new Date();
    const startTime = new Date(election.startingTime);
    const endTime = new Date(election.endingTime);
    
    // Default values
    let buttonText = "View Election";
    let buttonStyle = "text-slate-700 bg-slate-100 hover:bg-slate-200 focus:ring-slate-400";
    let isDisabled = false;
    
    // Check if election is active
    const isActive = startTime <= now && endTime > now;
    
    if (!isActive) {
      // Election is not active (upcoming or ended)
      if (startTime > now) {
        buttonText = "Upcoming";
        buttonStyle = "text-ink bg-glacier cursor-not-allowed";
        isDisabled = true;
      } else {
        buttonText = "View Results";
        buttonStyle = "text-sage bg-sage-soft hover:bg-green-100 focus:ring-sage";
      }
      return { buttonText, buttonStyle, isDisabled };
    }
    
    // Election is active - check if user has already voted
    if (election.hasVoted) {
      buttonText = "Already Voted";
      buttonStyle = "text-slate-600 bg-slate-100 cursor-not-allowed";
      isDisabled = true;
      return { buttonText, buttonStyle, isDisabled };
    }
    
    // Check if user can vote based on election eligibility and user roles
    const canVote = canUserVoteInElection(election);
    
    if (canVote) {
      buttonText = "Vote Now";
      buttonStyle = "text-white bg-brand hover:bg-brand-dark focus:ring-brand";
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
      <div className="space-y-6 page-enter">
        {/* Welcome Banner Skeleton */}
        <div className="bg-gradient-to-r from-brand to-brand-dark rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            <div className="animate-pulse">
              <div className="h-8 bg-white bg-opacity-20 rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-white bg-opacity-10 rounded w-1/2"></div>
            </div>
          </div>
        </div>
        
        {/* Stats Skeleton */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card p-4 sm:p-6">
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
            <div key={i} className="surface-card p-6">
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
              <FiBarChart2 className="h-5 w-5 text-red-400" />
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
    <div className="space-y-6 page-enter">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-deep-aurora shadow-lift">
        <div className="pointer-events-none absolute inset-0 bg-hero-grid opacity-30" style={{ backgroundSize: "40px 40px" }} />
        <div className="relative px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-kicker text-brand-light">
                Election overview
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-tight text-white break-words sm:text-3xl">
                Welcome back, {userEmail.split("@")[0]}
              </h1>
              <p className="mt-2 max-w-lg text-sm text-slate-300 sm:text-base">
                {ongoing.length === 0
                  ? "No active elections right now — browse upcoming ones or create when you’re ready."
                  : `You have ${ongoing.length} active election${ongoing.length === 1 ? "" : "s"} in progress.`}
              </p>
            </div>
            <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/30 bg-brand/15 shadow-brand">
              <FiAward className="h-8 w-8 text-brand-light" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className={`surface-card relative overflow-hidden rounded-xl sm:rounded-2xl transition-all duration-300 hover:shadow-lift ring-1 ${stat.ring}`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
            <div className="p-3 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-500 leading-tight truncate">
                    {stat.name}
                    {stat.subtitle && (
                      <span className="text-gray-400"> · {stat.subtitle}</span>
                    )}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                  <p className="font-display text-lg font-bold tracking-tight text-deep sm:text-3xl">
                      {stat.value}
                    </p>
                    {stat.pulse && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    )}
                  </div>
                </div>
                <div className={`hidden sm:flex flex-shrink-0 p-2.5 rounded-xl ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Elections Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Available Elections */}
        <div className="surface-card overflow-hidden">
          <div className="border-b border-glacier px-6 py-5">
            <p className="section-kicker">Live participation</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-deep">
              Available Elections
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Elections you can currently participate in
            </p>
          </div>
          <div className="space-y-3 p-4">
            {ongoing.length > 0 ? (
              ongoing.map((election) => {
                const { buttonText, isDisabled } = getVoteButtonInfo(election);
                return (
                  <ElectionBrowseCard
                    key={election.electionId}
                    election={election}
                    status="ongoing"
                    statusClass="bg-sage-soft text-emerald-800"
                    onOpen={handleElectionClick}
                    onAction={handleElectionClick}
                    actionLabel={buttonText}
                    actionDisabled={isDisabled}
                    density="compact"
                  />
                );
              })
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-500">
                  No available elections at this time
                </p>
              </div>
            )}
            {ongoingCount > MAX_DISPLAY_COUNT && (
              <div className="p-4 text-center">
                <button 
                  onClick={() => navigate('/all-elections')} 
                  className="text-brand hover:text-ink text-sm font-medium"
                >
                  View All Available Elections
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="surface-card overflow-hidden">
          <div className="border-b border-glacier px-6 py-5">
            <p className="section-kicker">Election record</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-deep">
              Recent Activity
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Your recent voting participation
            </p>
          </div>
          <div className="space-y-3 p-4">
            {completed.length > 0 ? (
              completed.map((election) => (
                <ElectionBrowseCard
                  key={election.electionId}
                  election={election}
                  status="completed"
                  statusClass="bg-slate-100 text-slate-600"
                  onOpen={handleElectionClick}
                  onAction={handleElectionClick}
                  actionLabel="View Results"
                  density="compact"
                />
              ))
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-500">No recent activity to display</p>
              </div>
            )}
            {completedCount > MAX_DISPLAY_COUNT && (
              <div className="p-4 text-center">
                <button 
                  onClick={() => navigate('/all-elections?filter=completed')} 
                  className="text-brand hover:text-ink text-sm font-medium"
                >
                  View All Completed Elections
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Elections */}
      <div className="surface-card overflow-hidden">
        <div className="border-b border-glacier px-6 py-5">
          <p className="section-kicker">Scheduled ahead</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-deep">
            Upcoming Elections
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Mark your calendar for these important dates
          </p>
        </div>
        <div className="space-y-3 p-4">
          {upcoming.length > 0 ? (
            upcoming.map((election) => (
              <ElectionBrowseCard
                key={election.electionId}
                election={election}
                status="upcoming"
                statusClass="bg-glacier text-brand-dark"
                onOpen={handleElectionClick}
                onAction={handleElectionClick}
                actionLabel="View Details"
                density="compact"
              />
            ))
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">No upcoming elections scheduled</p>
            </div>
          )}
          {upcomingCount > MAX_DISPLAY_COUNT && (
            <div className="p-4 text-center">
              <button 
                onClick={() => navigate('/all-elections?filter=upcoming')} 
                className="text-brand hover:text-ink text-sm font-medium"
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
