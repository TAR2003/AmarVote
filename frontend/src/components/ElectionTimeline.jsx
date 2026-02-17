import React, { useState, useEffect } from 'react';
import { FiCheck, FiClock, FiCalendar, FiUsers, FiLock, FiUnlock, FiBox, FiAlertCircle } from 'react-icons/fi';
import { electionApi } from '../utils/electionApi';

const ElectionTimeline = ({ electionId, electionData }) => {
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        setLoading(true);
        
        const events = [];
        
        // Fetch task logs from the new centralized API
        try {
          const response = await fetch(`/api/election/${electionId}/task-logs`, {
            credentials: 'include',
          });
          
          if (response.ok) {
            const taskLogsData = await response.json();
            
            if (taskLogsData.success && taskLogsData.taskLogs) {
              console.log('📊 Loaded task logs:', taskLogsData.taskLogs.length);
              
              // Process each task log
              taskLogsData.taskLogs.forEach(log => {
                const baseEvent = {
                  id: `tasklog-${log.logId}`,
                  status: log.status === 'COMPLETED' ? 'completed' : log.status === 'FAILED' ? 'failed' : 'in-progress'
                };
                
                // Add start event if startTime exists
                if (log.startTime) {
                  const startEvent = {
                    ...baseEvent,
                    id: `${baseEvent.id}-start`,
                    timestamp: new Date(log.startTime),
                  };
                  
                  switch (log.taskType) {
                    case 'TALLY_CREATION':
                      startEvent.title = 'Tally Creation Started';
                      startEvent.icon = FiBox;
                      startEvent.color = 'purple';
                      startEvent.description = `Started by ${log.userEmail || 'system'}`;
                      break;
                    case 'GUARDIAN_PARTIAL_DECRYPTION':
                      startEvent.title = `Guardian Partial Decryption Started`;
                      startEvent.icon = FiLock;
                      startEvent.color = 'indigo';
                      startEvent.description = `${log.userEmail || 'Guardian'} started decryption (Guardian ID: ${log.guardianId || 'N/A'})`;
                      break;
                    case 'COMPENSATED_DECRYPTION':
                      startEvent.title = `Compensated Decryption Started`;
                      startEvent.icon = FiLock;
                      startEvent.color = 'teal';
                      startEvent.description = `${log.userEmail || 'Guardian'} compensating for missing guardian (Compensating: ${log.compensatingGuardianId || 'N/A'}, Missing: ${log.missingGuardianId || 'N/A'})`;
                      break;
                    case 'COMBINE_DECRYPTION':
                      startEvent.title = 'Combine Decryption Started';
                      startEvent.icon = FiUnlock;
                      startEvent.color = 'pink';
                      startEvent.description = `Started by ${log.userEmail || 'system'} - combining all partial decryptions`;
                      break;
                    default:
                      startEvent.title = `${log.taskType} Started`;
                      startEvent.icon = FiClock;
                      startEvent.color = 'gray';
                      startEvent.description = log.taskDescription || 'Task started';
                  }
                  
                  events.push(startEvent);
                }
                
                // Add end event if endTime exists
                if (log.endTime) {
                  const endEvent = {
                    ...baseEvent,
                    id: `${baseEvent.id}-end`,
                    timestamp: new Date(log.endTime),
                  };
                  
                  const durationText = log.durationMs ? ` (${(log.durationMs / 1000).toFixed(2)}s)` : '';
                  
                  switch (log.taskType) {
                    case 'TALLY_CREATION':
                      endEvent.title = log.status === 'COMPLETED' ? 'Tally Creation Completed' : 'Tally Creation Failed';
                      endEvent.icon = log.status === 'COMPLETED' ? FiCheck : FiAlertCircle;
                      endEvent.color = log.status === 'COMPLETED' ? 'green' : 'red';
                      endEvent.description = log.status === 'COMPLETED' 
                        ? `Completed by ${log.userEmail || 'system'}${durationText}`
                        : `Failed: ${log.errorMessage || 'Unknown error'}`;
                      break;
                    case 'GUARDIAN_PARTIAL_DECRYPTION':
                      endEvent.title = log.status === 'COMPLETED' ? 'Guardian Partial Decryption Completed' : 'Guardian Partial Decryption Failed';
                      endEvent.icon = log.status === 'COMPLETED' ? FiUnlock : FiAlertCircle;
                      endEvent.color = log.status === 'COMPLETED' ? 'indigo' : 'red';
                      endEvent.description = log.status === 'COMPLETED'
                        ? `${log.userEmail || 'Guardian'} completed${durationText}`
                        : `Failed: ${log.errorMessage || 'Unknown error'}`;
                      break;
                    case 'COMPENSATED_DECRYPTION':
                      endEvent.title = log.status === 'COMPLETED' ? 'Compensated Decryption Completed' : 'Compensated Decryption Failed';
                      endEvent.icon = log.status === 'COMPLETED' ? FiUnlock : FiAlertCircle;
                      endEvent.color = log.status === 'COMPLETED' ? 'teal' : 'red';
                      endEvent.description = log.status === 'COMPLETED'
                        ? `${log.userEmail || 'Guardian'} completed backup for missing guardian${durationText}`
                        : `Failed: ${log.errorMessage || 'Unknown error'}`;
                      break;
                    case 'COMBINE_DECRYPTION':
                      endEvent.title = log.status === 'COMPLETED' ? 'Combine Decryption Completed' : 'Combine Decryption Failed';
                      endEvent.icon = log.status === 'COMPLETED' ? FiCheck : FiAlertCircle;
                      endEvent.color = log.status === 'COMPLETED' ? 'green' : 'red';
                      endEvent.description = log.status === 'COMPLETED'
                        ? `All partial decryptions combined successfully${durationText}`
                        : `Failed: ${log.errorMessage || 'Unknown error'}`;
                      break;
                    default:
                      endEvent.title = log.status === 'COMPLETED' ? `${log.taskType} Completed` : `${log.taskType} Failed`;
                      endEvent.icon = log.status === 'COMPLETED' ? FiCheck : FiAlertCircle;
                      endEvent.color = log.status === 'COMPLETED' ? 'green' : 'red';
                      endEvent.description = log.status === 'COMPLETED'
                        ? `Completed${durationText}`
                        : `Failed: ${log.errorMessage || 'Unknown error'}`;
                  }
                  
                  events.push(endEvent);
                }
              });
            }
          }
        } catch (err) {
          console.log('Could not fetch task logs, falling back to legacy data:', err);
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
        if (electionData.startDate) {
          events.push({
            id: 'voting-start',
            title: 'Voting Period Started',
            timestamp: new Date(electionData.startDate),
            icon: FiUsers,
            color: 'green',
            description: 'Voters can now cast their encrypted ballots',
            status: 'completed'
          });
        }
        
        // 3. Voting Period End
        if (electionData.endDate) {
          const votingEnded = new Date() > new Date(electionData.endDate);
          events.push({
            id: 'voting-end',
            title: 'Voting Period Ended',
            timestamp: new Date(electionData.endDate),
            icon: FiClock,
            color: votingEnded ? 'orange' : 'gray',
            description: 'No more votes can be cast',
            status: votingEnded ? 'completed' : 'pending'
          });
        }
        
        // 4. Tally Creation (fetch from tally_creation_status table)
        try {
          const tallyStatus = await electionApi.getTallyStatus(electionId);
          if (tallyStatus && tallyStatus.startedAt) {
            events.push({
              id: 'tally-start',
              title: 'Tally Creation Started',
              timestamp: new Date(tallyStatus.startedAt),
              icon: FiBox,
              color: 'purple',
              description: 'Started creating encrypted tally from all ballots',
              status: 'completed'
            });
          }
          
          if (tallyStatus && tallyStatus.completedAt) {
            events.push({
              id: 'tally-complete',
              title: 'Tally Creation Completed',
              timestamp: new Date(tallyStatus.completedAt),
              icon: FiBox,
              color: 'purple',
              description: `Processed ${tallyStatus.processedChunks || 0} chunks`,
              status: 'completed'
            });
          }
        } catch (err) {
          console.log('Could not fetch task logs, falling back to legacy data:', err);
        }
        
        // Add election metadata events for context
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
        if (electionData.startDate) {
          events.push({
            id: 'voting-start',
            title: 'Voting Period Started',
            timestamp: new Date(electionData.startDate),
            icon: FiUsers,
            color: 'green',
            description: 'Voters can now cast their encrypted ballots',
            status: 'completed'
          });
        }
        
        // 3. Voting Period End
        if (electionData.endDate) {
          const votingEnded = new Date() > new Date(electionData.endDate);
          events.push({
            id: 'voting-end',
            title: 'Voting Period Ended',
            timestamp: new Date(electionData.endDate),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (timelineData.length === 0) {
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
      red: 'bg-red-100 text-red-600 border-red-200',
      gray: 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return colors[color] || colors.blue;
  };

  const formatTimestamp = (timestamp) => {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FiClock className="h-5 w-5 mr-2 text-blue-600" />
          Election Process Timeline
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Complete timeline of all election processes with timestamps
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Timeline items */}
        <div className="space-y-6">
          {timelineData.map((event, index) => {
            const Icon = event.icon;
            const colorClasses = getColorClasses(event.color);

            return (
              <div key={event.id} className="relative flex items-start gap-4 pl-0">
                {/* Icon */}
                <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 ${colorClasses}`}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{event.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      <div className="flex items-center text-xs text-gray-500">
                        <FiClock className="h-3 w-3 mr-1" />
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                    
                    {event.status === 'completed' && (
                      <div className="flex-shrink-0 ml-4">
                        <div className="bg-green-100 text-green-600 rounded-full p-1">
                          <FiCheck className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                    
                    {event.status === 'failed' && (
                      <div className="flex-shrink-0 ml-4">
                        <div className="bg-red-100 text-red-600 rounded-full p-1">
                          <FiAlertCircle className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-2">Timeline Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Total Events</p>
            <p className="text-lg font-bold text-gray-900">{timelineData.length}</p>
          </div>
          <div>
            <p className="text-gray-600">Completed</p>
            <p className="text-lg font-bold text-green-600">
              {timelineData.filter(e => e.status === 'completed').length}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Failed</p>
            <p className="text-lg font-bold text-red-600">
              {timelineData.filter(e => e.status === 'failed').length}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Duration</p>
            <p className="text-lg font-bold text-blue-600">
              {timelineData.length >= 2 
                ? Math.round((timelineData[timelineData.length - 1].timestamp - timelineData[0].timestamp) / (1000 * 60 * 60)) + 'h'
                : 'N/A'}
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
