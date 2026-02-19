import React, { useState, useEffect } from 'react';
import { FiCheck, FiClock, FiCalendar, FiUsers, FiLock, FiUnlock, FiBox, FiChevronDown, FiChevronRight, FiZap, FiPackage } from 'react-icons/fi';
import { electionApi } from '../utils/electionApi';
import axios from 'axios';

const ElectionTimeline = ({ electionId, electionData }) => {
  const [timelineData, setTimelineData] = useState([]);
  const [workerLogTasks, setWorkerLogTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        setLoading(true);
        
        const events = [];
        const workerTasks = [];
        
        // Fetch worker logs data
        try {
          // Fetch all worker log types
          const [tallyLogs, partialDecryptionLogs, compensatedDecryptionLogs, combineLogs] = await Promise.all([
            axios.get(`/api/worker-logs/tally/${electionId}`).catch(() => ({ data: { logs: [] } })),
            axios.get(`/api/worker-logs/decryption/partial/${electionId}`).catch(() => ({ data: { logs: [] } })),
            axios.get(`/api/worker-logs/decryption/compensated/${electionId}`).catch(() => ({ data: { logs: [] } })),
            axios.get(`/api/worker-logs/combine/${electionId}`).catch(() => ({ data: { logs: [] } }))
          ]);

          console.log('📊 Worker Logs Fetched:', {
            tally: tallyLogs.data,
            partial: partialDecryptionLogs.data,
            compensated: compensatedDecryptionLogs.data,
            combine: combineLogs.data
          });
          
          console.log('🔍 Guardians Data:', electionData.guardians);

          // Process Tally Creation
          if (tallyLogs.data.logs && tallyLogs.data.logs.length > 0) {
            const logs = tallyLogs.data.logs;
            const sortedLogs = [...logs].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
            const firstLog = sortedLogs[0];
            const lastLog = sortedLogs[sortedLogs.length - 1];
            
            // Only create task if we have valid end times
            if (firstLog.startTime && lastLog.endTime) {
              workerTasks.push({
                id: 'tally-creation',
                title: 'Tally Creation',
                type: 'tally',
                icon: FiBox,
                color: 'purple',
                startTime: new Date(firstLog.startTime),
                endTime: new Date(lastLog.endTime),
                chunks: sortedLogs.map(log => ({
                  chunkNumber: log.chunkNumber,
                  startTime: log.startTime ? new Date(log.startTime) : null,
                  endTime: log.endTime ? new Date(log.endTime) : null,
                  duration: log.duration,
                  status: log.status
                })),
                description: `Processed ${logs.length} chunks`,
                status: 'completed'
              });
            }
          }

          // Process Partial Decryption by Guardian
          if (partialDecryptionLogs.data.logs && partialDecryptionLogs.data.logs.length > 0) {
            const logsByGuardian = {};
            partialDecryptionLogs.data.logs.forEach(log => {
              if (!logsByGuardian[log.guardianId]) {
                logsByGuardian[log.guardianId] = [];
              }
              logsByGuardian[log.guardianId].push(log);
            });

            Object.entries(logsByGuardian).forEach(([guardianId, logs]) => {
              const sortedLogs = [...logs].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
              const firstLog = sortedLogs[0];
              const lastLog = sortedLogs[sortedLogs.length - 1];
              
              // Only create task if we have valid end times
              if (firstLog.startTime && lastLog.endTime) {
                // Find guardian info
                const guardian = electionData.guardians?.find(g => g.guardianId === parseInt(guardianId));
                const guardianName = guardian ? `Guardian ${guardian.sequenceOrder}` : `Guardian ${guardianId}`;
                
                workerTasks.push({
                  id: `partial-decryption-guardian-${guardianId}`,
                  title: `Partial Decryption by ${guardianName}`,
                  type: 'partial-decryption',
                  icon: FiLock,
                  color: 'indigo',
                  startTime: new Date(firstLog.startTime),
                  endTime: new Date(lastLog.endTime),
                  guardianId: parseInt(guardianId),
                  chunks: sortedLogs.map(log => ({
                    chunkNumber: log.chunkNumber,
                    startTime: log.startTime ? new Date(log.startTime) : null,
                    endTime: log.endTime ? new Date(log.endTime) : null,
                    duration: log.duration,
                    status: log.status
                  })),
                  description: `Decrypted ${logs.length} chunks`,
                  status: 'completed'
                });
              }
            });
          }

          // Process Compensated Decryption by Guardian
          if (compensatedDecryptionLogs.data.logs && compensatedDecryptionLogs.data.logs.length > 0) {
            const logsByDecryptingGuardianAndTargetGuardian = {};
            compensatedDecryptionLogs.data.logs.forEach(log => {
              const key = `${log.decryptingGuardianId}-${log.guardianId}`;
              if (!logsByDecryptingGuardianAndTargetGuardian[key]) {
                logsByDecryptingGuardianAndTargetGuardian[key] = [];
              }
              logsByDecryptingGuardianAndTargetGuardian[key].push(log);
            });

            Object.entries(logsByDecryptingGuardianAndTargetGuardian).forEach(([key, logs]) => {
              const [decryptingGuardianId, targetGuardianId] = key.split('-').map(Number);
              const sortedLogs = [...logs].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
              const firstLog = sortedLogs[0];
              const lastLog = sortedLogs[sortedLogs.length - 1];
              
              // Only create task if we have valid end times
              if (firstLog.startTime && lastLog.endTime) {
                // Find guardian info
                const decryptingGuardian = electionData.guardians?.find(g => g.guardianId === decryptingGuardianId);
                const targetGuardian = electionData.guardians?.find(g => g.guardianId === targetGuardianId);
                const decryptingName = decryptingGuardian ? `Guardian ${decryptingGuardian.sequenceOrder}` : `Guardian ${decryptingGuardianId}`;
                const targetName = targetGuardian ? `Guardian ${targetGuardian.sequenceOrder}` : `Guardian ${targetGuardianId}`;
                
                workerTasks.push({
                  id: `compensated-decryption-${decryptingGuardianId}-for-${targetGuardianId}`,
                  title: `Compensated Decryption by ${decryptingName} for ${targetName}`,
                  type: 'compensated-decryption',
                  icon: FiZap,
                  color: 'teal',
                  startTime: new Date(firstLog.startTime),
                  endTime: new Date(lastLog.endTime),
                  decryptingGuardianId,
                  targetGuardianId,
                  chunks: sortedLogs.map(log => ({
                    chunkNumber: log.chunkNumber,
                    startTime: log.startTime ? new Date(log.startTime) : null,
                    endTime: log.endTime ? new Date(log.endTime) : null,
                    duration: log.duration,
                    status: log.status
                  })),
                  description: `Generated backup shares for ${logs.length} chunks`,
                  status: 'completed'
                });
              }
            });
          }

          // Process Combine Decryption
          if (combineLogs.data.logs && combineLogs.data.logs.length > 0) {
            const logs = combineLogs.data.logs;
            const sortedLogs = [...logs].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
            const firstLog = sortedLogs[0];
            const lastLog = sortedLogs[sortedLogs.length - 1];
            
            // Only create task if we have valid end times
            if (firstLog.startTime && lastLog.endTime) {
              workerTasks.push({
                id: 'combine-decryption',
                title: 'Combine Decryption Process',
                type: 'combine',
                icon: FiPackage,
                color: 'pink',
                startTime: new Date(firstLog.startTime),
                endTime: new Date(lastLog.endTime),
                chunks: sortedLogs.map(log => ({
                  chunkNumber: log.chunkNumber,
                  startTime: log.startTime ? new Date(log.startTime) : null,
                  endTime: log.endTime ? new Date(log.endTime) : null,
                  duration: log.duration,
                  status: log.status
                })),
                description: `Combined ${logs.length} chunks to produce final results`,
                status: 'completed'
              });
            }
          }

          // Sort worker tasks by start time
          workerTasks.sort((a, b) => a.startTime - b.startTime);
          console.log('✅ Worker Tasks Created:', workerTasks.length, workerTasks);
          setWorkerLogTasks(workerTasks);

        } catch (err) {
          console.error('Error fetching worker logs:', err);
        }
        
        // 1. Election Creation
        if (electionData.createdAt) {
          events.push({
            id: 'creation',
            title: 'Election Created',
            timestamp: new Date(electionData.createdAt),
            icon: FiCalendar,
            color: 'blue',
            description: `Election "${electionData.electionTitle}" was created`,
            status: 'completed'
          });
        }
        
        // 2. Voting Period Start
        if (electionData.startingTime) {
          events.push({
            id: 'voting-start',
            title: 'Voting Period Started',
            timestamp: new Date(electionData.startingTime),
            icon: FiUsers,
            color: 'green',
            description: 'Voters can now cast their encrypted ballots',
            status: 'completed'
          });
        }
        
        // 3. Voting Period End
        if (electionData.endingTime) {
          const votingEnded = new Date() > new Date(electionData.endingTime);
          events.push({
            id: 'voting-end',
            title: 'Voting Period Ended',
            timestamp: new Date(electionData.endingTime),
            icon: FiClock,
            color: votingEnded ? 'orange' : 'gray',
            description: 'No more votes can be cast',
            status: votingEnded ? 'completed' : 'pending'
          });
        }
        
        // Sort events by timestamp
        events.sort((a, b) => a.timestamp - b.timestamp);
        
        setTimelineData(events);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching timeline data:', err);
        setLoading(false);
      }
    };
    
    if (electionId && electionData) {
      fetchTimelineData();
    }
  }, [electionId, electionData]);

  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (timelineData.length === 0 && workerLogTasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FiClock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No timeline data available yet</p>
      </div>
    );
  }

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      orange: 'bg-orange-100 text-orange-600 border-orange-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200',
      teal: 'bg-teal-100 text-teal-600 border-teal-200',
      pink: 'bg-pink-100 text-pink-600 border-pink-200',
      gray: 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return colors[color] || colors.blue;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(timestamp);
  };

  const formatDuration = (milliseconds) => {
    if (!milliseconds) return 'N/A';
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Merge timeline events and worker log tasks, sorted by time
  const allItems = [
    ...timelineData.map(e => ({ ...e, itemType: 'event', sortTime: e.timestamp })),
    ...workerLogTasks.map(t => ({ ...t, itemType: 'task', sortTime: t.startTime }))
  ].sort((a, b) => a.sortTime - b.sortTime);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FiClock className="h-5 w-5 mr-2 text-blue-600" />
          Election Process Timeline
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Complete timeline of all election processes with detailed worker operations
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Timeline items */}
        <div className="space-y-6">
          {allItems.map((item) => {
            if (item.itemType === 'event') {
              // Regular timeline event
              const Icon = item.icon;
              const colorClasses = getColorClasses(item.color);

              return (
                <div key={item.id} className="relative flex items-start gap-4 pl-0">
                  {/* Icon */}
                  <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 ${colorClasses}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <FiClock className="h-3 w-3 mr-1" />
                          {formatTimestamp(item.timestamp)}
                        </div>
                      </div>
                      
                      {item.status === 'completed' && (
                        <div className="flex-shrink-0 ml-4">
                          <div className="bg-green-100 text-green-600 rounded-full p-1">
                            <FiCheck className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              // Worker log task with expandable chunks
              const Icon = item.icon;
              const colorClasses = getColorClasses(item.color);
              const isExpanded = expandedTasks[item.id];
              const duration = item.endTime - item.startTime;

              return (
                <div key={item.id} className="relative flex items-start gap-4 pl-0">
                  {/* Icon */}
                  <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 ${colorClasses}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    {/* Main Task Card - Clickable */}
                    <div 
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => toggleTaskExpansion(item.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{item.title}</h4>
                            {isExpanded ? (
                              <FiChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <FiChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center">
                              <FiClock className="h-3 w-3 mr-1" />
                              {formatTimestamp(item.startTime)}
                            </div>
                            <div className="text-gray-400">→</div>
                            <div className="flex items-center">
                              {formatTimestamp(item.endTime)}
                            </div>
                            <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                              {formatDuration(duration)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0 ml-4">
                          <div className="bg-green-100 text-green-600 rounded-full p-1">
                            <FiCheck className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Chunks */}
                    {isExpanded && item.chunks && item.chunks.length > 0 && (
                      <div className="mt-3 ml-8 space-y-2">
                        {item.chunks.map((chunk, idx) => (
                          <div 
                            key={idx}
                            className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-700">Chunk {chunk.chunkNumber}</span>
                                  {chunk.status === 'COMPLETED' ? (
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                      Completed
                                    </span>
                                  ) : (
                                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                                      {chunk.status}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <div className="flex items-center">
                                    <FiClock className="h-3 w-3 mr-1" />
                                    {formatTimestamp(chunk.startTime)}
                                  </div>
                                  <div className="text-gray-400">→</div>
                                  <div>{formatTimestamp(chunk.endTime)}</div>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded font-medium text-xs">
                                  {formatDuration(chunk.duration)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-2">Timeline Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Total Events</p>
            <p className="text-lg font-bold text-gray-900">{timelineData.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Worker Tasks</p>
            <p className="text-lg font-bold text-purple-600">{workerLogTasks.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Total Chunks</p>
            <p className="text-lg font-bold text-blue-600">
              {workerLogTasks.reduce((sum, task) => sum + (task.chunks?.length || 0), 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Guardians</p>
            <p className="text-lg font-bold text-indigo-600">
              {electionData.guardians?.length || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectionTimeline;
