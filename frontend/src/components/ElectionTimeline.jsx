import React, { useState, useEffect, useMemo } from 'react';
import {
  FiCheck,
  FiClock,
  FiCalendar,
  FiUsers,
  FiLock,
  FiBox,
  FiChevronDown,
  FiChevronRight,
  FiZap,
  FiPackage,
  FiTrendingUp,
  FiKey,
} from 'react-icons/fi';
import axios from 'axios';
import { timezoneUtils } from '../utils/timezoneUtils';

axios.defaults.withCredentials = true;

const PHASE_FOR_ITEM = {
  creation: 'setup',
  'key-ceremony-complete': 'setup',
  'voting-start': 'voting',
  'voting-end': 'voting',
  'results-available': 'tabulation',
  tally: 'tabulation',
  'partial-decryption': 'tabulation',
  'compensated-decryption': 'tabulation',
  combine: 'tabulation',
};

const PHASE_META = {
  setup: { label: 'Setup', color: 'blue', description: 'Election created and guardians prepared keys' },
  voting: { label: 'Voting', color: 'green', description: 'Voters cast encrypted ballots' },
  tabulation: { label: 'Tabulation', color: 'brand', description: 'Tallying, decryption, and final results' },
};

const toSortTime = (value) => {
  const parsed = timezoneUtils.parseUtcTimestamp(value);
  return parsed ? parsed.getTime() : Number.MAX_SAFE_INTEGER;
};

const formatTimestamp = (value) => timezoneUtils.formatDateTime(value);

const formatDisplayTimeParts = (value) => {
  const formatted = formatTimestamp(value);
  const parts = formatted.split(' · ');
  return {
    primary: parts[0] || formatted,
    secondary: parts.length > 1 ? parts.slice(1).join(' · ') : '',
  };
};

const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return 'N/A';
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatGap = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return null;
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s later`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m later`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m later` : `${hours}h later`;
  const days = Math.floor(hours / 24);
  return `${days}d later`;
};

const getColorClasses = (color) => {
  const colors = {
    blue: 'bg-glacier text-brand border-brand/20',
    green: 'bg-sage-soft text-aurora-muted border-aurora/30',
    orange: 'bg-ceremonial-soft text-ink border-ceremonial/40',
    brand: 'bg-glacier text-brand-dark border-brand/20',
    deep: 'bg-glacier text-ink border-brand/25',
    sage: 'bg-sage-soft text-sage border-sage/20',
    ink: 'bg-frost text-ink border-ink/10',
    gray: 'bg-frost text-dusk border-ink/10',
    brandSoft: 'bg-glacier text-brand-dark border-brand/20',
  };
  return colors[color] || colors.blue;
};

const getAccentBorder = (color) => {
  const colors = {
    blue: 'border-l-brand',
    green: 'border-l-aurora',
    orange: 'border-l-ceremonial',
    brand: 'border-l-brand',
    deep: 'border-l-ink',
    sage: 'border-l-sage',
    ink: 'border-l-ink',
    gray: 'border-l-dusk-soft',
    brandSoft: 'border-l-brand',
  };
  return colors[color] || colors.blue;
};

const getDateLabel = (value) => {
  const parsed = timezoneUtils.parseUtcTimestamp(value);
  if (!parsed) return 'Unknown date';
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getItemPhase = (item) => {
  if (item.itemType === 'event') return PHASE_FOR_ITEM[item.id] || 'setup';
  return PHASE_FOR_ITEM[item.type] || 'tabulation';
};

const compareTimelineItems = (a, b) => {
  const timeDiff = a.sortTime - b.sortTime;
  if (timeDiff !== 0) return timeDiff;
  return String(a.title).localeCompare(String(b.title));
};

const sortTimelineItems = (items) => [...items].sort(compareTimelineItems);

const estimateMidpointTimestamp = (startValue, endValue) => {
  const startMs = toSortTime(startValue);
  const endMs = toSortTime(endValue);
  if (startMs === Number.MAX_SAFE_INTEGER || endMs === Number.MAX_SAFE_INTEGER || endMs <= startMs) {
    return startValue || endValue;
  }
  return new Date(startMs + Math.floor((endMs - startMs) / 2)).toISOString();
};

const buildWorkerTask = ({
  id,
  title,
  type,
  icon,
  color,
  startTime,
  endTime,
  chunks,
  description,
  extra = {},
}) => ({
  id,
  itemType: 'task',
  title,
  type,
  icon,
  color,
  startTime,
  endTime,
  sortTime: toSortTime(startTime),
  chunks,
  description,
  status: 'completed',
  ...extra,
});

const getTaskTimeRange = (logs) => {
  if (!logs?.length) return null;

  const sortedLogs = [...logs].sort((a, b) => toSortTime(a.startTime) - toSortTime(b.startTime));
  const firstLog = sortedLogs[0];
  if (!firstLog?.startTime) return null;

  const endCandidates = sortedLogs
    .map((log) => log.endTime)
    .filter(Boolean)
    .sort((a, b) => toSortTime(a) - toSortTime(b));

  return {
    sortedLogs,
    startTime: firstLog.startTime,
    endTime: endCandidates[endCandidates.length - 1] || firstLog.startTime,
  };
};

const buildMilestoneEvent = ({ id, title, timestamp, icon, color, description, status = 'completed' }) => ({
  id,
  itemType: 'event',
  title,
  timestamp,
  sortTime: toSortTime(timestamp),
  icon,
  color,
  description,
  status,
});

const ElectionTimeline = ({ electionId, electionData }) => {
  const [timelineItems, setTimelineItems] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        setLoading(true);

        const events = [];
        const workerTasks = [];
        let latestCombineEndTime = null;

        try {
          const [tallyLogs, partialDecryptionLogs, compensatedDecryptionLogs, combineLogs] = await Promise.all([
            axios.get(`/api/worker-logs/tally/${electionId}`).catch(() => ({ data: { logs: [] } })),
            axios.get(`/api/worker-logs/decryption/partial/${electionId}`).catch(() => ({ data: { logs: [] } })),
            axios.get(`/api/worker-logs/decryption/compensated/${electionId}`).catch(() => ({ data: { logs: [] } })),
            axios.get(`/api/worker-logs/combine/${electionId}`).catch(() => ({ data: { logs: [] } })),
          ]);

          const tallyRange = getTaskTimeRange(tallyLogs.data.logs);
          if (tallyRange) {
            workerTasks.push(buildWorkerTask({
              id: 'tally-creation',
              title: 'Tally Creation',
              type: 'tally',
              icon: FiBox,
              color: 'brand',
              startTime: tallyRange.startTime,
              endTime: tallyRange.endTime,
              chunks: tallyRange.sortedLogs.map((log) => ({
                chunkNumber: log.chunkNumber,
                startTime: log.startTime,
                endTime: log.endTime,
                duration: log.duration,
                status: log.status,
              })),
              description: `Processed ${tallyRange.sortedLogs.length} encrypted ballot chunks`,
            }));
          }

          if (partialDecryptionLogs.data.logs?.length > 0) {
            const logsByGuardian = {};
            partialDecryptionLogs.data.logs.forEach((log) => {
              if (!logsByGuardian[log.guardianId]) logsByGuardian[log.guardianId] = [];
              logsByGuardian[log.guardianId].push(log);
            });

            Object.entries(logsByGuardian).forEach(([guardianId, logs]) => {
              const range = getTaskTimeRange(logs);
              if (!range) return;

              const guardian = electionData.guardians?.find(
                (g) => g.guardianId === parseInt(guardianId, 10)
              );
              const guardianName = guardian
                ? `Guardian ${guardian.sequenceOrder}`
                : `Guardian ${guardianId}`;

              workerTasks.push(buildWorkerTask({
                id: `partial-decryption-guardian-${guardianId}`,
                title: `Partial Decryption by ${guardianName}`,
                type: 'partial-decryption',
                icon: FiLock,
                color: 'deep',
                startTime: range.startTime,
                endTime: range.endTime,
                chunks: range.sortedLogs.map((log) => ({
                  chunkNumber: log.chunkNumber,
                  startTime: log.startTime,
                  endTime: log.endTime,
                  duration: log.duration,
                  status: log.status,
                })),
                description: `Decrypted ${range.sortedLogs.length} chunks`,
                extra: { guardianId: parseInt(guardianId, 10) },
              }));
            });
          }

          if (compensatedDecryptionLogs.data.logs?.length > 0) {
            const logsByPair = {};
            compensatedDecryptionLogs.data.logs.forEach((log) => {
              const key = `${log.decryptingGuardianId}-${log.guardianId}`;
              if (!logsByPair[key]) logsByPair[key] = [];
              logsByPair[key].push(log);
            });

            Object.entries(logsByPair).forEach(([key, logs]) => {
              const [decryptingGuardianId, targetGuardianId] = key.split('-').map(Number);
              const range = getTaskTimeRange(logs);
              if (!range) return;

              const decryptingGuardian = electionData.guardians?.find(
                (g) => g.guardianId === decryptingGuardianId
              );
              const targetGuardian = electionData.guardians?.find(
                (g) => g.guardianId === targetGuardianId
              );
              const decryptingName = decryptingGuardian
                ? `Guardian ${decryptingGuardian.sequenceOrder}`
                : `Guardian ${decryptingGuardianId}`;
              const targetName = targetGuardian
                ? `Guardian ${targetGuardian.sequenceOrder}`
                : `Guardian ${targetGuardianId}`;

              workerTasks.push(buildWorkerTask({
                id: `compensated-decryption-${decryptingGuardianId}-for-${targetGuardianId}`,
                title: `Compensated Decryption by ${decryptingName} for ${targetName}`,
                type: 'compensated-decryption',
                icon: FiZap,
                color: 'sage',
                startTime: range.startTime,
                endTime: range.endTime,
                chunks: range.sortedLogs.map((log) => ({
                  chunkNumber: log.chunkNumber,
                  startTime: log.startTime,
                  endTime: log.endTime,
                  duration: log.duration,
                  status: log.status,
                })),
                description: `Generated backup shares for ${range.sortedLogs.length} chunks`,
                extra: { decryptingGuardianId, targetGuardianId },
              }));
            });
          }

          const combineRange = getTaskTimeRange(combineLogs.data.logs);
          if (combineRange) {
            latestCombineEndTime = combineRange.endTime;
            workerTasks.push(buildWorkerTask({
              id: 'combine-decryption',
              title: 'Combine Decryption Process',
              type: 'combine',
              icon: FiPackage,
              color: 'ink',
              startTime: combineRange.startTime,
              endTime: combineRange.endTime,
              chunks: combineRange.sortedLogs.map((log) => ({
                chunkNumber: log.chunkNumber,
                startTime: log.startTime,
                endTime: log.endTime,
                duration: log.duration,
                status: log.status,
              })),
              description: `Combined ${combineRange.sortedLogs.length} chunks to produce final results`,
            }));
          }
        } catch (err) {
          console.error('Error fetching worker logs:', err);
        }

        if (electionData.createdAt) {
          events.push(buildMilestoneEvent({
            id: 'creation',
            title: 'Election Created',
            timestamp: electionData.createdAt,
            icon: FiCalendar,
            color: 'blue',
            description: `Election "${electionData.electionTitle}" was created`,
          }));
        }

        if (
          electionData.jointPublicKey
          && electionData.status
          && electionData.status !== 'key_ceremony_pending'
        ) {
          events.push(buildMilestoneEvent({
            id: 'key-ceremony-complete',
            title: 'Key Ceremony Completed',
            timestamp: estimateMidpointTimestamp(electionData.createdAt, electionData.startingTime),
            icon: FiKey,
            color: 'brandSoft',
            description: `Guardians established the joint public key (${electionData.guardiansSubmitted || 0}/${electionData.totalGuardians || electionData.numberOfGuardians || 0} submitted)`,
          }));
        }

        if (electionData.startingTime) {
          events.push(buildMilestoneEvent({
            id: 'voting-start',
            title: 'Voting Period Started',
            timestamp: electionData.startingTime,
            icon: FiUsers,
            color: 'green',
            description: 'Voters can now cast their encrypted ballots',
          }));
        }

        if (electionData.endingTime) {
          const votingEnded = Date.now() > toSortTime(electionData.endingTime);
          events.push(buildMilestoneEvent({
            id: 'voting-end',
            title: 'Voting Period Ended',
            timestamp: electionData.endingTime,
            icon: FiClock,
            color: votingEnded ? 'orange' : 'gray',
            description: 'No more votes can be cast',
            status: votingEnded ? 'completed' : 'pending',
          }));
        }

        if (electionData.status === 'decrypted' || latestCombineEndTime) {
          const maxWorkerEndMs = workerTasks.reduce(
            (max, task) => Math.max(max, toSortTime(task.endTime)),
            0
          );
          const resultsTimestamp = latestCombineEndTime
            || (maxWorkerEndMs > 0 && maxWorkerEndMs !== Number.MAX_SAFE_INTEGER
              ? new Date(maxWorkerEndMs).toISOString()
              : electionData.endingTime);

          events.push(buildMilestoneEvent({
            id: 'results-available',
            title: 'Results Available',
            timestamp: resultsTimestamp,
            icon: FiTrendingUp,
            color: 'brand',
            description: 'Final tallies were decrypted and are ready for verification',
            status: electionData.status === 'decrypted' ? 'completed' : 'pending',
          }));
        }

        const allItems = sortTimelineItems([...events, ...workerTasks]);
        setTimelineItems(allItems);

        const defaultExpanded = {};
        workerTasks.forEach((task) => {
          defaultExpanded[task.id] = true;
        });
        setExpandedTasks(defaultExpanded);
      } catch (err) {
        console.error('Error fetching timeline data:', err);
        setTimelineItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (electionId && electionData) {
      fetchTimelineData();
    }
  }, [electionId, electionData]);

  const sortedTimelineItems = useMemo(
    () => sortTimelineItems(timelineItems),
    [timelineItems]
  );

  const renderedTimeline = useMemo(() => {
    let lastDateLabel = null;
    let previousSortTime = null;

    return sortedTimelineItems.map((item, index) => {
      const displayTime = item.itemType === 'event' ? item.timestamp : item.startTime;
      const dateLabel = getDateLabel(displayTime);
      const showDateHeader = dateLabel !== lastDateLabel;
      if (showDateHeader) lastDateLabel = dateLabel;

      const phase = getItemPhase(item);

      const gapLabel = previousSortTime != null && item.sortTime !== Number.MAX_SAFE_INTEGER
        ? formatGap(item.sortTime - previousSortTime)
        : null;
      if (item.sortTime !== Number.MAX_SAFE_INTEGER) {
        previousSortTime = item.sortTime;
      }

      return {
        item,
        index,
        dateLabel,
        showDateHeader,
        phase,
        gapLabel,
        displayTime,
      };
    });
  }, [sortedTimelineItems]);

  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const eventCount = sortedTimelineItems.filter((item) => item.itemType === 'event').length;
  const taskCount = sortedTimelineItems.filter((item) => item.itemType === 'task').length;
  const totalChunks = sortedTimelineItems.reduce(
    (sum, item) => sum + (item.chunks?.length || 0),
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
      </div>
    );
  }

  if (sortedTimelineItems.length === 0) {
    return (
      <div className="text-center py-12 text-dusk">
        <FiClock className="h-12 w-12 mx-auto mb-4 text-dusk-soft" />
        <p>No timeline data available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel border-brand/15 bg-gradient-to-br from-frost via-white to-glacier/50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-deep flex items-center gap-2">
              <FiClock className="h-5 w-5 text-brand" />
              Election Process Timeline
            </h3>
            <p className="text-sm text-dusk mt-1 max-w-2xl">
              Sorted by time, oldest first. Each step shows when it happened and how long after the previous event.
            </p>
          </div>
          <div className="rounded-xl border border-brand/20 bg-paper/80 px-4 py-3 text-right shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Sort order</p>
            <p className="text-sm font-semibold text-ink">Oldest → Newest</p>
            <p className="text-xs text-dusk mt-0.5">{sortedTimelineItems.length} events</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {Object.entries(PHASE_META).map(([key, meta]) => (
              <span
                key={key}
                className={`text-xs font-medium px-3 py-1 rounded-full border ${getColorClasses(meta.color)}`}
              >
                {meta.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative pl-0 sm:pl-4">
        <div className="absolute left-[4.5rem] sm:left-[7.5rem] top-4 bottom-4 w-px bg-gradient-to-b from-glacier via-brand/50 to-sage/40" />

        <div className="space-y-5">
          {renderedTimeline.map(({
            item,
            index,
            dateLabel,
            showDateHeader,
            phase,
            gapLabel,
            displayTime,
          }) => {
            const Icon = item.icon;
            const colorClasses = getColorClasses(item.color);
            const accentBorder = getAccentBorder(item.color);
            const phaseMeta = PHASE_META[phase];
            const isExpanded = expandedTasks[item.id] ?? item.itemType === 'task';
            const durationMs = item.itemType === 'task'
              ? toSortTime(item.endTime) - toSortTime(item.startTime)
              : 0;
            const timeParts = formatDisplayTimeParts(displayTime);

            return (
              <React.Fragment key={item.id}>
                {showDateHeader && (
                  <div className="relative flex items-center gap-3 pl-[4.5rem] sm:pl-28">
                    <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-paper border border-brand/25 text-brand-dark shadow-sm">
                      <FiCalendar className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                      {dateLabel}
                    </span>
                  </div>
                )}

                {gapLabel && index > 0 && (
                  <div className="relative ml-[4.5rem] sm:ml-[7.5rem] pl-4">
                    <span className="inline-flex items-center rounded-full bg-paper border border-ink/10 px-3 py-1 text-[11px] font-medium text-dusk shadow-sm">
                      {gapLabel}
                    </span>
                  </div>
                )}

                <div className="relative flex items-start gap-3 sm:gap-4">
                  <div className="w-[4.5rem] sm:w-28 shrink-0 pt-3 text-right">
                    <p className="text-[11px] font-semibold text-ink leading-tight">
                      {timeParts.primary}
                    </p>
                    {timeParts.secondary && (
                      <p className="text-[10px] text-dusk mt-0.5 hidden sm:block">
                        {timeParts.secondary}
                      </p>
                    )}
                  </div>

                  <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ${colorClasses}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.itemType === 'event' ? (
                      <div className={`surface-card rounded-2xl hover:shadow-lift border-l-4 ${accentBorder}`}>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-dusk">
                                  Step {index + 1}
                                </span>
                                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${getColorClasses(phaseMeta.color)}`}>
                                  {phaseMeta.label}
                                </span>
                              </div>
                              <h4 className="text-base font-semibold text-ink">{item.title}</h4>
                              <p className="text-sm text-dusk mt-1">{item.description}</p>
                              <div className="flex items-center gap-1.5 text-xs text-dusk mt-3">
                                <FiClock className="h-3.5 w-3.5" />
                                {formatTimestamp(item.timestamp)}
                              </div>
                            </div>
                            {item.status === 'completed' && (
                              <div className="rounded-full bg-sage-soft p-1.5 text-aurora-muted">
                                <FiCheck className="h-4 w-4" />
                              </div>
                            )}
                            {item.status === 'pending' && (
                              <div className="rounded-full bg-ceremonial-soft px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink">
                                Pending
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleTaskExpansion(item.id)}
                          className={`surface-card w-full rounded-2xl text-left hover:shadow-lift border-l-4 ${accentBorder}`}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-dusk">
                                    Step {index + 1}
                                  </span>
                                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${getColorClasses(phaseMeta.color)}`}>
                                    Worker task
                                  </span>
                                  <span className="text-[10px] font-medium text-dusk">
                                    {item.chunks?.length || 0} chunks
                                  </span>
                                  {isExpanded ? (
                                    <FiChevronDown className="h-4 w-4 text-dusk" />
                                  ) : (
                                    <FiChevronRight className="h-4 w-4 text-dusk" />
                                  )}
                                </div>
                                <h4 className="text-base font-semibold text-ink">{item.title}</h4>
                                <p className="text-sm text-dusk mt-1">{item.description}</p>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-dusk mt-3">
                                  <span className="inline-flex items-center gap-1">
                                    <FiClock className="h-3.5 w-3.5" />
                                    {formatTimestamp(item.startTime)}
                                  </span>
                                  <span className="text-dusk-soft">to</span>
                                  <span>{formatTimestamp(item.endTime)}</span>
                                  <span className="rounded-md bg-glacier px-2 py-1 font-medium text-brand-dark">
                                    {formatDuration(durationMs)}
                                  </span>
                                </div>
                              </div>
                              <div className="rounded-full bg-sage-soft p-1.5 text-aurora-muted">
                                <FiCheck className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        </button>

                        {isExpanded && item.chunks?.length > 0 && (
                          <div className="mt-3 ml-3 space-y-2 border-l-2 border-dashed border-ink/10 pl-4">
                            {[...item.chunks]
                              .sort((a, b) => toSortTime(a.startTime) - toSortTime(b.startTime))
                              .map((chunk, chunkIdx) => (
                              <div
                                key={`${item.id}-chunk-${chunk.chunkNumber ?? chunkIdx}`}
                                className="rounded-lg border border-ink/10 bg-frost/80 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span className="text-sm font-medium text-ink">
                                        Chunk {chunk.chunkNumber}
                                      </span>
                                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                                        chunk.status === 'COMPLETED'
                                          ? 'bg-sage-soft text-aurora-muted'
                                          : 'bg-ember-soft text-ember'
                                      }`}
                                      >
                                        {chunk.status}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-dusk">
                                      <span>{formatTimestamp(chunk.startTime)}</span>
                                      <span className="text-dusk-soft">to</span>
                                      <span>{formatTimestamp(chunk.endTime)}</span>
                                    </div>
                                  </div>
                                  <span className="shrink-0 rounded-md bg-paper border border-glacier px-2 py-1 text-xs font-medium text-brand-dark">
                                    {formatDuration(chunk.duration)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="surface-card bg-frost/80 p-5">
        <h4 className="font-semibold text-ink mb-3">Timeline Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="rounded-xl bg-paper border border-ink/10 p-3">
            <p className="text-dusk">Milestones</p>
            <p className="text-2xl font-bold text-ink">{eventCount}</p>
          </div>
          <div className="rounded-xl bg-paper border border-ink/10 p-3">
            <p className="text-dusk">Worker Tasks</p>
            <p className="text-2xl font-bold text-brand-dark">{taskCount}</p>
          </div>
          <div className="rounded-xl bg-paper border border-ink/10 p-3">
            <p className="text-dusk">Total Chunks</p>
            <p className="text-2xl font-bold text-brand">{totalChunks}</p>
          </div>
          <div className="rounded-xl bg-paper border border-ink/10 p-3">
            <p className="text-dusk">Guardians</p>
            <p className="text-2xl font-bold text-brand-dark">
              {electionData.guardians?.length || electionData.numberOfGuardians || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectionTimeline;
