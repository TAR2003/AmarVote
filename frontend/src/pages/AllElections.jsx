import React, { useState, useEffect, useMemo, useCallback, memo, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { deleteElection, invalidateElectionsCache } from "../utils/api";
import { getApiErrorMessage } from "../utils/httpErrors";
import { useElections } from "../context/ElectionsContext";
import { timezoneUtils } from "../utils/timezoneUtils";
import { FiCalendar, FiClock, FiUsers, FiInfo, FiLoader, FiTrash2 } from "react-icons/fi";

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
  <div className="surface-card animate-pulse p-6">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="mb-2 h-6 w-2/3 rounded-lg bg-glacier"></div>
        <div className="mb-3 h-4 w-1/2 rounded-lg bg-frost"></div>
        <div className="flex gap-2 mb-3">
          <div className="h-5 w-16 rounded-lg bg-frost"></div>
          <div className="h-5 w-20 rounded-lg bg-frost"></div>
        </div>
        <div className="flex gap-4">
          <div className="h-4 w-24 rounded-lg bg-frost"></div>
          <div className="h-4 w-32 rounded-lg bg-frost"></div>
        </div>
      </div>
      <div className="h-10 w-24 rounded-xl bg-frost"></div>
    </div>
  </div>
);

// Memoized Election Card component for better performance
const ElectionCard = memo(({ election, onElectionClick, getElectionStatus, getStatusColor, canUserVoteInElection }) => {
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
      className="surface-card-interactive cursor-pointer p-6"
      onClick={handleClick}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-deep">
              {election.electionTitle}
            </h3>
            <span
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${getStatusColor(status)}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
            <span
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                election.isPublic 
                  ? 'bg-sage-soft text-sage' 
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {election.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
          
          <p className="mt-1.5 text-sm text-slate-600">
            {election.electionDescription}
          </p>

          {/* User Roles */}
          <div className="mt-3 flex flex-wrap gap-2">
            {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  role === 'admin' ? 'bg-red-100 text-red-800' :
                  role === 'guardian' ? 'bg-glacier text-ink' :
                  'bg-glacier text-ink'
                }`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
            ))}
            {canUserVoteInElection(election) && !election.userRoles?.includes('voter') && (
              <span className="inline-flex items-center rounded-lg bg-sage-soft px-2.5 py-1 text-xs font-semibold text-sage">
                {election.eligibility === 'unlisted' ? 'Eligible (Open)' : 'Eligible Voter'}
              </span>
            )}
          </div>
          
          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-6">
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
        
        <div className="w-full sm:ml-4 sm:w-auto sm:flex-shrink-0">
          {status === "ongoing" && (
            <button                          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto ${
                            election.hasVoted 
                              ? 'cursor-not-allowed bg-slate-100 text-slate-600'
                              : (canUserVoteInElection(election) 
                                  ? 'text-white bg-brand hover:bg-brand-dark focus:ring-brand' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400')
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
              className="btn-ghost inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold sm:w-auto"
              onClick={handleActionClick}
            >
              Set Reminder
            </button>
          )}
          {status === "completed" && (
            <button 
              className="btn-ghost inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold sm:w-auto"
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
  const { elections, setElections, loading, error: electionsError, refreshElections } = useElections();
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [displayLimit, setDisplayLimit] = useState(10);
  const [electionToDelete, setElectionToDelete] = useState(null);
  const [deletingElectionId, setDeletingElectionId] = useState(null);
  const canDeleteElection = useCallback((election) => election.userRoles?.includes('admin'), []);

  useEffect(() => {
    if (electionsError) {
      setError(electionsError);
    }
  }, [electionsError]);

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
        return "bg-glacier text-brand-dark";
      case "ongoing":
        return "bg-sage-soft text-sage";
      case "completed":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
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

  const handleRequestDelete = useCallback((election, event) => {
    event.stopPropagation();
    setElectionToDelete(election);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!electionToDelete) return;

    try {
      setDeletingElectionId(electionToDelete.electionId);
      setError(null);
      await deleteElection(electionToDelete.electionId);
      setElections((prev) => prev.filter((e) => e.electionId !== electionToDelete.electionId));
      invalidateElectionsCache();
      setSuccessMessage(`Election "${electionToDelete.electionTitle}" deleted successfully.`);
      setElectionToDelete(null);
    } catch (err) {
      setError(err.message || "Failed to delete election");
    } finally {
      setDeletingElectionId(null);
    }
  }, [electionToDelete, setElections]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

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
  }, [elections, filter, displayLimit, canUserVoteInElection]);

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
  }, [elections, canUserVoteInElection]);

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-glacier px-6 py-5">
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
        <div className="surface-card overflow-hidden">
          <div className="space-y-3 p-3">
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiInfo className="h-5 w-5 text-amber-500" />
            </div>
            <div className="ml-3">
              <h3 role="alert" className="text-sm font-medium text-amber-900">
                Could not load elections
              </h3>
              <div className="mt-2 text-sm text-amber-800">
                <p>{error}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  refreshElections(true).catch((err) => setError(getApiErrorMessage(err)));
                }}
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 bg-white hover:bg-amber-50"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="surface-card overflow-hidden">
        <div className="border-b border-glacier px-4 py-5 sm:px-6 sm:py-6">
          <p className="section-kicker">Election directory</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-deep sm:text-3xl">All Elections</h1>
          <p className="mt-2 text-sm text-slate-600">
            View and participate in all elections you have access to
          </p>
        </div>
        
        {/* Filter tabs */}
        <div className="bg-frost/50 px-4 py-4 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
                className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                  filter === tab.key
                    ? "bg-deep text-white shadow-soft"
                    : "bg-white text-slate-700 ring-1 ring-glacier hover:bg-glacier/50"
                }`}
              >
                {tab.label}
                <span className="ml-2 rounded-lg bg-white/20 px-2 py-0.5 text-xs text-current">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-sage/30 bg-sage-soft p-4 text-sm font-medium text-sage shadow-soft">
          {successMessage}
        </div>
      )}

      {/* Elections List */}
      <div className="space-y-3">
          {filteredElections.length > 0 ? (
            filteredElections.map((election) => {
              const status = getElectionStatus(election);
              return (
                <div
                  key={election.electionId}
                  className="surface-card-interactive cursor-pointer p-5 sm:p-6"
                  onClick={() => handleElectionClick(election.electionId)}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-deep break-words sm:text-xl">
                          {election.electionTitle}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${getStatusColor(
                            status
                          )}`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        {/* Public/Private Indicator */}
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            election.isPublic 
                              ? 'bg-sage-soft text-sage' 
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {election.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {election.electionDescription}
                      </p>

                      {/* User Roles */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                              role === 'admin' ? 'bg-red-100 text-red-800' :
                              role === 'guardian' ? 'bg-glacier text-ink' :
                              'bg-glacier text-ink'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </span>
                        ))}
                        {/* Show eligible voter status */}
                        {canUserVoteInElection(election) && !election.userRoles?.includes('voter') && (
                          <span className="inline-flex items-center rounded-lg bg-sage-soft px-2.5 py-1 text-xs font-semibold text-sage">
                            {election.eligibility === 'unlisted' ? 'Eligible (Open)' : 'Eligible Voter'}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-5 flex flex-col gap-2 border-t border-glacier pt-4 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
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
                      
                      <div className="mt-3 text-xs font-medium text-slate-500">
                        Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                      </div>
                    </div>
                    
                    <div className="w-full sm:w-auto sm:flex-shrink-0 sm:ml-4 flex flex-col gap-2">
                      {canDeleteElection(election) && (
                        <button
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-soft transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          onClick={(e) => handleRequestDelete(election, e)}
                          disabled={deletingElectionId === election.electionId}
                        >
                          <FiTrash2 className="h-4 w-4" />
                          {deletingElectionId === election.electionId ? "Deleting..." : "Delete"}
                        </button>
                      )}

                      {status === "ongoing" && (
                        <button 
                          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            election.hasVoted 
                              ? 'cursor-not-allowed bg-slate-100 text-slate-600'
                              : (canUserVoteInElection(election) 
                                  ? 'text-white bg-brand hover:bg-brand-dark focus:ring-brand' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400')
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
                          className="btn-ghost inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold"
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
                          className="btn-ghost inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold"
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
            <div className="surface-card p-12 text-center">
              <FiCalendar className="mx-auto h-12 w-12 text-brand" />
              <h3 className="mt-3 font-display text-lg font-semibold text-deep">
                No elections found
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {filter === "all"
                  ? "You don't have access to any elections at the moment."
                  : `No ${filter} elections found.`}
              </p>
            </div>
          )}
        
        {/* Load More Button */}
        {hasMore && filteredElections.length > 0 && (
          <div className="surface-card px-6 py-4">
            <button
              onClick={loadMoreElections}
              className="btn-ghost flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <FiLoader className="h-4 w-4 mr-2" />
              Load More Elections
            </button>
          </div>
        )}
      </div>

      {electionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-5 shadow-lift sm:p-6">
            <p className="section-kicker text-red-600">Permanent action</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-deep">Delete Election</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Are you sure you want to permanently delete "{electionToDelete.electionTitle}"?
              This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={() => setElectionToDelete(null)}
                className="btn-ghost w-full rounded-xl px-4 py-2.5 text-sm font-semibold sm:w-auto"
                disabled={!!deletingElectionId}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-red-700 disabled:opacity-60 sm:w-auto"
                disabled={!!deletingElectionId}
              >
                {deletingElectionId ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllElections;
