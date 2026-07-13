import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiBarChart2,
  FiUsers,
  FiUserCheck,
  FiArrowRight,
  FiCalendar,
  FiActivity,
  FiInbox,
} from "react-icons/fi";
import { userApi } from "../utils/userApi";
import { useElections } from "../context/ElectionsContext";
import ElectionBrowseCard from "../components/ElectionBrowseCard";
import BrandMark from "../components/BrandMark";

const canUserVoteInElection = (election) => {
  if (!election) return false;

  const eligibility = election.eligibility;

  if (eligibility === "unlisted") {
    return true;
  }
  if (eligibility === "listed") {
    return election.userRoles?.includes("voter") || false;
  }

  return false;
};

const ElectionCardSkeleton = () => (
              <div className="animate-pulse rounded-2xl border border-ink/10 bg-paper/80 p-5">
    <div className="mb-3 h-3 w-20 rounded-full bg-glacier" />
    <div className="mb-2 h-5 w-3/4 rounded-lg bg-glacier" />
    <div className="h-3 w-1/2 rounded-lg bg-frost-muted" />
  </div>
);

const EmptyState = ({ icon: Icon, title, hint }) => (
  <div className="dash-empty">
    <div className="dash-empty-icon" aria-hidden="true">
      <Icon className="h-5 w-5" />
    </div>
    <p className="font-display text-base font-semibold text-ink">{title}</p>
    {hint ? <p className="mt-1 max-w-xs text-sm leading-relaxed text-dusk">{hint}</p> : null}
  </div>
);

const SectionHeader = ({ kicker, title, subtitle, count, onViewAll, viewAllLabel }) => (
  <div className="flex flex-col gap-3 border-b border-ink/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
    <div>
      <p className="section-kicker">{kicker}</p>
      <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-deep sm:text-2xl">
        {title}
        {typeof count === "number" && count > 0 ? (
          <span className="ml-2 align-middle font-sans text-sm font-semibold text-dusk">
            ({count})
          </span>
        ) : null}
      </h2>
      {subtitle ? <p className="mt-1 text-sm leading-relaxed text-dusk">{subtitle}</p> : null}
    </div>
    {onViewAll ? (
      <button
        type="button"
        onClick={onViewAll}
        className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brand-dark transition hover:text-brand sm:self-auto"
      >
        {viewAllLabel || "View all"}
        <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    ) : null}
  </div>
);

const Dashboard = ({ userEmail }) => {
  const navigate = useNavigate();
  const { elections, loading: electionsLoading, error: electionsError } = useElections();
  const [userStats, setUserStats] = useState({ registeredUsers: 0, activeUsers: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const loading = electionsLoading || statsLoading;
  const error = electionsError;
  const MAX_DISPLAY_COUNT = 3;

  const displayName = useMemo(() => {
    if (!userEmail) return "there";
    const local = userEmail.split("@")[0] || "there";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [userEmail]);

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
    const categorized = elections.reduce(
      (acc, election) => {
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
      },
      { upcoming: [], ongoing: [], completed: [] }
    );

    categorized.upcoming.sort((a, b) => new Date(a.startingTime) - new Date(b.startingTime));
    categorized.ongoing.sort((a, b) => new Date(b.endingTime) - new Date(a.endingTime));
    categorized.completed.sort((a, b) => new Date(b.endingTime) - new Date(a.endingTime));

    return {
      upcoming: categorized.upcoming.slice(0, MAX_DISPLAY_COUNT),
      ongoing: categorized.ongoing.slice(0, MAX_DISPLAY_COUNT),
      completed: categorized.completed.slice(0, MAX_DISPLAY_COUNT),
      upcomingCount: categorized.upcoming.length,
      ongoingCount: categorized.ongoing.length,
      completedCount: categorized.completed.length,
    };
  }, [elections]);

  const electionCounts = useMemo(() => {
    const now = new Date();
    let completedTotal = 0;

    elections.forEach((election) => {
      if (!election.endingTime) return;
      const endTime = new Date(election.endingTime);
      if (!Number.isNaN(endTime.getTime()) && endTime <= now) {
        completedTotal += 1;
      }
    });

    return {
      totalCount: elections.length,
      completedCount: completedTotal,
    };
  }, [elections]);

  const stats = useMemo(
    () => [
      {
        name: "Total elections",
        value: electionCounts.totalCount.toLocaleString(),
        icon: FiBarChart2,
        rail: "from-brand-dark to-brand",
        iconWrap: "bg-brand-soft text-brand-dark",
      },
      {
        name: "Completed",
        value: electionCounts.completedCount.toLocaleString(),
        icon: FiCheckCircle,
        rail: "from-aurora to-aurora-muted",
        iconWrap: "bg-sage-soft text-aurora-muted",
      },
      {
        name: "Registered users",
        value: userStats.registeredUsers.toLocaleString(),
        icon: FiUsers,
        rail: "from-deep to-ink",
        iconWrap: "bg-frost-muted text-ink",
      },
      {
        name: "Active now",
        value: userStats.activeUsers.toLocaleString(),
        subtitle: "last 30 min",
        icon: FiUserCheck,
        rail: "from-ceremonial to-ceremonial",
        iconWrap: "bg-ceremonial-soft text-ink",
        pulse: userStats.activeUsers > 0,
      },
    ],
    [electionCounts, userStats]
  );

  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;
    setStatsLoading(true);

    userApi
      .getUserStats()
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

  const handleElectionClick = useCallback(
    (electionId) => {
      navigate(`/election-page/${electionId}`);
    },
    [navigate]
  );

  const getVoteButtonInfo = useCallback((election) => {
    if (!election.startingTime || !election.endingTime) {
      return {
        buttonText: "Key Ceremony",
        buttonStyle: "btn-ghost w-full justify-center py-2.5 text-xs sm:text-sm",
        isDisabled: false,
      };
    }

    const now = new Date();
    const startTime = new Date(election.startingTime);
    const endTime = new Date(election.endingTime);
    const isActive = startTime <= now && endTime > now;

    if (!isActive) {
      if (startTime > now) {
        return {
          buttonText: "Upcoming",
          buttonStyle:
            "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink/10 bg-glacier px-5 py-2.5 text-xs font-semibold text-dusk sm:text-sm",
          isDisabled: true,
        };
      }
      return {
        buttonText: "View Results",
        buttonStyle:
          "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sage-soft px-5 py-2.5 text-xs font-semibold text-aurora-muted transition hover:bg-sage/20 sm:text-sm",
        isDisabled: false,
      };
    }

    if (election.hasVoted) {
      return {
        buttonText: "Already Voted",
        buttonStyle:
          "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink/10 bg-frost px-5 py-2.5 text-xs font-semibold text-dusk sm:text-sm",
        isDisabled: true,
      };
    }

    if (canUserVoteInElection(election)) {
      return {
        buttonText: "Vote Now",
        buttonStyle: "btn-brand w-full justify-center py-2.5 text-xs sm:text-sm",
        isDisabled: false,
      };
    }

    return {
      buttonText: "Not Allowed",
      buttonStyle:
        "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ember-soft px-5 py-2.5 text-xs font-semibold text-ember sm:text-sm",
      isDisabled: true,
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 page-enter">
        <div className="dash-hero overflow-hidden rounded-[1.75rem]">
          <div className="relative px-5 py-10 sm:px-10 sm:py-14">
            <div className="animate-pulse space-y-4">
              <div className="h-3 w-28 rounded-full bg-paper/15" />
              <div className="h-10 w-2/3 max-w-md rounded-xl bg-paper/20" />
              <div className="h-4 w-1/2 max-w-sm rounded-lg bg-paper/10" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-3 w-1/2 rounded bg-glacier" />
                <div className="h-8 w-1/3 rounded bg-frost-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="surface-card overflow-hidden">
              <div className="border-b border-ink/10 px-6 py-5">
                <div className="h-3 w-24 animate-pulse rounded bg-glacier" />
                <div className="mt-3 h-6 w-40 animate-pulse rounded bg-frost-muted" />
              </div>
              <div className="space-y-3 p-4">
                {[...Array(2)].map((_, j) => (
                  <ElectionCardSkeleton key={j} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-enter">
        <div className="overflow-hidden rounded-2xl border border-ember/25 bg-ember-soft/60 p-6 shadow-soft">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember/15 text-ember">
              <FiBarChart2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-ember">
                Couldn’t load your elections
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-ember/90">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const heroSubtitle =
    ongoingCount === 0
      ? "The chamber is quiet — browse what is coming, or open the full directory when you are ready."
      : `${ongoingCount} election${ongoingCount === 1 ? "" : "s"} open for participation right now.`;

  return (
    <div className="space-y-8 page-enter">
      {/* Welcome — one composition */}
      <section className="dash-hero relative overflow-hidden rounded-[1.75rem] shadow-lift">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -right-16 -top-20 h-72 w-72 animate-aurora-drift rounded-full bg-brand/25 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-80 w-80 animate-aurora-drift-alt rounded-full bg-aurora/10 blur-3xl" />
          <div className="absolute inset-0 bg-hero-grid opacity-25" style={{ backgroundSize: "48px 48px" }} />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ceremonial/50 to-transparent" />
        </div>

        <div className="relative px-5 py-9 sm:px-10 sm:py-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl animate-fade-up">
              <div className="flex items-center gap-3">
                <BrandMark size="lg" light className="shadow-brand" />
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dusk-soft">
                  AmarVote · Overview
                </p>
              </div>

              <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-paper text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                Welcome back, {displayName}
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-dusk-soft text-balance sm:text-lg">
                {heroSubtitle}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {ongoingCount > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-aurora/30 bg-aurora/10 px-3.5 py-1.5 text-xs font-semibold text-aurora">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora" />
                    </span>
                    Live now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-paper/5 px-3.5 py-1.5 text-xs font-semibold text-dusk-soft">
                    <FiCalendar className="h-3.5 w-3.5" aria-hidden="true" />
                    {upcomingCount > 0 ? `${upcomingCount} scheduled` : "No live ballots"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/all-elections")}
                  className="btn-ghost-light py-2 text-sm"
                >
                  Browse elections
                  <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="hidden shrink-0 animate-fade-up sm:block lg:pb-1" style={{ animationDelay: "0.12s" }}>
              <div className="relative rounded-2xl border border-white/10 bg-paper/5 px-6 py-5 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-dusk-soft">
                  Your lens
                </p>
                <div className="mt-3 flex items-end gap-6">
                  <div>
                    <p className="font-display text-3xl font-bold text-paper">{ongoingCount}</p>
                    <p className="mt-0.5 text-xs text-dusk-soft">open</p>
                  </div>
                  <div className="h-10 w-px bg-white/10" />
                  <div>
                    <p className="font-display text-3xl font-bold text-paper">{upcomingCount}</p>
                    <p className="mt-0.5 text-xs text-dusk-soft">ahead</p>
                  </div>
                  <div className="h-10 w-px bg-white/10" />
                  <div>
                    <p className="font-display text-3xl font-bold text-paper">{completedCount}</p>
                    <p className="mt-0.5 text-xs text-dusk-soft">done</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Signal metrics */}
      <section aria-label="Platform metrics" className="stagger-children grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="dash-stat group">
            <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${stat.rail} opacity-80`} />
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-dusk sm:text-xs">
                  {stat.name}
                  {stat.subtitle ? (
                    <span className="font-normal normal-case tracking-normal text-dusk/80">
                      {" "}
                      · {stat.subtitle}
                    </span>
                  ) : null}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="font-display text-2xl font-bold tracking-tight text-deep sm:text-3xl">
                    {stat.value}
                  </p>
                  {stat.pulse ? (
                    <span className="relative flex h-2 w-2" aria-label="Active">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ceremonial opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-ceremonial" />
                    </span>
                  ) : null}
                </div>
              </div>
              <div
                className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl transition duration-300 group-hover:scale-105 sm:flex ${stat.iconWrap}`}
              >
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Live + recent */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="dash-panel overflow-hidden">
          <div className="dash-panel-rail dash-panel-rail-live" aria-hidden="true" />
          <SectionHeader
            kicker="Live participation"
            title="Available elections"
            subtitle="Ballots open for you right now"
            count={ongoingCount}
            onViewAll={ongoingCount > MAX_DISPLAY_COUNT ? () => navigate("/all-elections") : undefined}
            viewAllLabel="View all available"
          />
          <div className="space-y-3 p-4 sm:p-5">
            {ongoing.length > 0 ? (
              ongoing.map((election) => {
                const { buttonText, buttonStyle, isDisabled } = getVoteButtonInfo(election);
                return (
                  <ElectionBrowseCard
                    key={election.electionId}
                    election={election}
                    status="ongoing"
                    statusClass="status-chip-active"
                    onOpen={handleElectionClick}
                    onAction={handleElectionClick}
                    actionLabel={buttonText}
                    actionDisabled={isDisabled}
                    actionClassName={buttonStyle}
                    density="compact"
                  />
                );
              })
            ) : (
              <EmptyState
                icon={FiActivity}
                title="Nothing live yet"
                hint="When an election opens, it will appear here with a clear path to vote."
              />
            )}
          </div>
        </div>

        <div className="dash-panel overflow-hidden">
          <div className="dash-panel-rail dash-panel-rail-quiet" aria-hidden="true" />
          <SectionHeader
            kicker="Election record"
            title="Recent activity"
            subtitle="Recently concluded elections"
            count={completedCount}
            onViewAll={
              completedCount > MAX_DISPLAY_COUNT
                ? () => navigate("/all-elections?filter=completed")
                : undefined
            }
            viewAllLabel="View all completed"
          />
          <div className="space-y-3 p-4 sm:p-5">
            {completed.length > 0 ? (
              completed.map((election) => (
                <ElectionBrowseCard
                  key={election.electionId}
                  election={election}
                  status="completed"
                  statusClass="status-chip-ended"
                  onOpen={handleElectionClick}
                  onAction={handleElectionClick}
                  actionLabel="View Results"
                  actionClassName="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sage-soft px-5 py-2.5 text-xs font-semibold text-aurora-muted transition hover:bg-sage/20 sm:text-sm"
                  density="compact"
                />
              ))
            ) : (
              <EmptyState
                icon={FiInbox}
                title="No recent results"
                hint="Finished elections you can review will settle here."
              />
            )}
          </div>
        </div>
      </section>

      {/* Upcoming */}
      <section className="dash-panel overflow-hidden">
        <div className="dash-panel-rail dash-panel-rail-ahead" aria-hidden="true" />
        <SectionHeader
          kicker="Scheduled ahead"
          title="Upcoming elections"
          subtitle="Mark your calendar — key ceremonies and open dates"
          count={upcomingCount}
          onViewAll={
            upcomingCount > MAX_DISPLAY_COUNT
              ? () => navigate("/all-elections?filter=upcoming")
              : undefined
          }
          viewAllLabel="View all upcoming"
        />
        <div className="space-y-3 p-4 sm:p-5">
          {upcoming.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {upcoming.map((election) => (
                <ElectionBrowseCard
                  key={election.electionId}
                  election={election}
                  status="upcoming"
                  statusClass="status-chip-pending"
                  onOpen={handleElectionClick}
                  onAction={handleElectionClick}
                  actionLabel="View Details"
                  actionClassName="btn-ghost w-full justify-center py-2.5 text-xs sm:text-sm"
                  density="compact"
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FiCalendar}
              title="Nothing scheduled"
              hint="Upcoming elections will line up here once they are published."
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
