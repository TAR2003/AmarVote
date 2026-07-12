import React, { useState, useEffect, useMemo, useCallback, memo, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { deleteElection, invalidateElectionsCache } from "../utils/api";
import { getApiErrorMessage } from "../utils/httpErrors";
import { useElections } from "../context/ElectionsContext";
import { timezoneUtils } from "../utils/timezoneUtils";
import { FiCalendar, FiClock, FiUsers, FiInfo, FiLoader, FiTrash2 } from "react-icons/fi";
import ElectionBrowseCard from "../components/ElectionBrowseCard";

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
  <div className="surface-card animate-pulse border border-glacier/70 p-5 sm:p-6">
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
                  : 'bg-ceremonial-soft text-ink'
              }`}
            >
              {election.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
          
          <p className="mt-1.5 text-sm text-dusk">
            {election.electionDescription}
          </p>

          {/* User Roles */}
          <div className="mt-3 flex flex-wrap gap-2">
            {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  role === 'admin' ? 'bg-ember-soft text-ember' :
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
          
          <div className="mt-4 flex flex-col gap-2 text-sm text-dusk sm:flex-row sm:flex-wrap sm:gap-x-6">
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
          
          <div className="mt-2 text-xs text-dusk">
            Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
          </div>
        </div>
        
        <div className="w-full sm:ml-4 sm:w-auto sm:flex-shrink-0">
          {status === "ongoing" && (
            <button                          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto ${
                            election.hasVoted 
                              ? 'cursor-not-allowed bg-frost text-dusk'
                              : (canUserVoteInElection(election) 
                                  ? 'text-paper bg-brand-dark hover:bg-brand focus:ring-brand' 
                                  : 'bg-frost text-ink hover:bg-ink/10 focus:ring-slate-400')
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
        return "bg-frost text-ink";
      default:
        return "bg-frost text-ink";
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
        <div className="overflow-hidden rounded-3xl bg-deep shadow-lift">
          <div className="border-b border-white/10 px-5 py-7 sm:px-8 sm:py-9">
            <div className="animate-pulse">
              <div className="mb-3 h-3 w-28 rounded-full bg-paper/15"></div>
              <div className="mb-3 h-9 w-1/2 rounded-xl bg-paper/20"></div>
              <div className="h-4 w-2/3 rounded-lg bg-paper/10"></div>
            </div>
          </div>

          <div className="bg-paper/5 px-5 py-4 sm:px-8">
            <div className="flex gap-2 overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-9 w-20 shrink-0 rounded-xl bg-paper/10"></div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <ElectionCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-enter">
        <div className="overflow-hidden rounded-3xl border border-ceremonial/40 bg-ceremonial-soft/70 shadow-soft">
          <div className="h-1 bg-ceremonial" />
          <div className="flex gap-4 p-5 sm:p-7">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ceremonial-soft">
              <FiInfo className="h-5 w-5 text-ink" />
            </div>
            <div>
              <p className="section-kicker text-ink">Election directory</p>
              <h3 role="alert" className="mt-1 font-display text-xl font-semibold text-deep">
                Could not load elections
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink/80">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  refreshElections(true).catch((err) => setError(getApiErrorMessage(err)));
                }}
                className="mt-5 inline-flex items-center rounded-xl border border-amber-300 bg-paper px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition-colors hover:bg-ceremonial-soft"
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
      <div className="overflow-hidden rounded-3xl bg-deep shadow-lift">
        <div className="relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-24 w-80 rounded-full bg-sage/10 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dusk-soft">Election directory</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-paper sm:text-4xl">All Elections</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-dusk-soft sm:text-base">
            View and participate in all elections you have access to
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 bg-paper/5 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-deep/20 p-1.5 scrollbar-hide">
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
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                  filter === tab.key
                    ? "bg-paper text-deep shadow-soft"
                    : "text-dusk-soft hover:bg-paper/10 hover:text-paper"
                }`}
              >
                {tab.label}
                <span className={`ml-2 rounded-lg px-2 py-0.5 text-xs ${filter === tab.key ? "bg-glacier text-deep" : "bg-paper/10 text-dusk-soft"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-2xl border border-sage/25 bg-sage-soft p-4 text-sm font-medium text-sage shadow-soft">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filteredElections.length > 0 ? (
            filteredElections.map((election) => {
              const status = getElectionStatus(election);
              const canVote = canUserVoteInElection(election);
              const actionLabel = status === "ongoing"
                ? (canVote && !election.hasVoted ? "Vote Now" : election.hasVoted ? "Already Voted" : "View Election")
                : status === "upcoming"
                  ? "View"
                  : "View results";
              return (
                <ElectionBrowseCard
                  key={election.electionId}
                  election={election}
                  status={status}
                  statusClass={getStatusColor(status)}
                  onOpen={handleElectionClick}
                  onAction={handleElectionClick}
                  actionLabel={actionLabel}
                  actionDisabled={status === "ongoing" && election.hasVoted && canVote}
                  secondaryAction={canDeleteElection(election) ? (
                        <button
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ember/30 bg-paper px-4 py-2.5 text-sm font-semibold text-ember shadow-soft transition-colors hover:bg-ember-soft focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          onClick={(e) => handleRequestDelete(election, e)}
                          disabled={deletingElectionId === election.electionId}
                        >
                          <FiTrash2 className="h-4 w-4" />
                          {deletingElectionId === election.electionId ? "Deleting..." : "Delete"}
                        </button>
                      ) : null}
                />
              );
            })
          ) : (
            <div className="surface-card border border-dashed border-brand/25 p-10 text-center sm:p-14">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-glacier text-brand">
                <FiCalendar className="h-6 w-6" />
              </div>
              <p className="section-kicker mt-5">Election directory</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-deep">
                No elections found
              </h3>
              <p className="mt-1 text-sm text-dusk">
                {filter === "all"
                  ? "You don't have access to any elections at the moment."
                  : `No ${filter} elections found.`}
              </p>
            </div>
          )}
        
        {/* Load More Button */}
        {hasMore && filteredElections.length > 0 && (
          <div className="surface-card border border-glacier/70 px-5 py-4 sm:px-6">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-deep/50 px-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-5 shadow-lift sm:p-6">
            <p className="section-kicker text-ember">Permanent action</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-deep">Delete Election</h3>
            <p className="mt-3 text-sm leading-relaxed text-dusk">
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
                className="w-full rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-paper shadow-soft transition-colors hover:bg-ember disabled:opacity-60 sm:w-auto"
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
