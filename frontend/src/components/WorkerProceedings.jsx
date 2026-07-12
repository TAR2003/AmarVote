import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

axios.defaults.withCredentials = true;
import {
  FiClock,
  FiActivity,
  FiCheckCircle,
  FiXCircle,
  FiBarChart2,
  FiTrendingUp,
  FiZap,
  FiPackage,
  FiRefreshCw,
  FiAlertTriangle,
  FiCalendar,
  FiLayers
} from 'react-icons/fi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Scatter,
  ScatterChart,
  Cell,
  ComposedChart
} from 'recharts';
import { timezoneUtils } from '../utils/timezoneUtils';

const WorkerProceedings = ({ electionId }) => {
  const [activeTab, setActiveTab] = useState('tally');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workerData, setWorkerData] = useState({
    tally: null,
    partialDecryption: null,
    compensatedDecryption: null,
    combine: null
  });

  const labelColor = '#334155';
  const tickColor = '#64748B';
  const gridColor = '#D9EAF0';

  const tabs = [
    { id: 'tally', label: 'Tally Processing', icon: FiBarChart2, color: 'brand' },
    { id: 'partialDecryption', label: 'Partial Decryption', icon: FiActivity, color: 'brand' },
    { id: 'compensatedDecryption', label: 'Compensated Decryption', icon: FiZap, color: 'amber' },
    { id: 'combine', label: 'Combine Decryption', icon: FiPackage, color: 'sage' }
  ];

  const getEndpointForTab = useCallback((tab) => {
    const endpoints = {
      tally: '/api/worker-logs/tally',
      partialDecryption: '/api/worker-logs/decryption/partial',
      compensatedDecryption: '/api/worker-logs/decryption/compensated',
      combine: '/api/worker-logs/combine'
    };
    return endpoints[tab];
  }, []);

  const fetchWorkerLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = getEndpointForTab(activeTab);
      const fullUrl = `${endpoint}/${electionId}`;
      console.log(`📡 [WorkerProceedings] Fetching from: ${fullUrl}`);
      console.log(`📡 [WorkerProceedings] Active Tab: ${activeTab}`);
      console.log(`📡 [WorkerProceedings] Election ID: ${electionId}`);
      
      const response = await axios.get(fullUrl);
      
      console.log(`✅ [WorkerProceedings] Response received:`, response);
      console.log(`✅ [WorkerProceedings] Response data:`, response.data);
      console.log(`✅ [WorkerProceedings] Logs array:`, response.data?.logs);
      console.log(`✅ [WorkerProceedings] Logs length:`, response.data?.logs?.length);
      console.log(`✅ [WorkerProceedings] Statistics:`, response.data?.statistics);
      
      if (!response.data) {
        console.warn(`⚠️ [WorkerProceedings] Empty response data received`);
        setError({ message: 'API returned empty response', details: response });
        return;
      }
      
      if (!response.data.logs) {
        console.warn(`⚠️ [WorkerProceedings] Response missing logs array:`, response.data);
        setError({ message: 'API response missing logs array', details: response.data });
        return;
      }
      
      setWorkerData(prev => {
        const newData = {
          ...prev,
          [activeTab]: response.data
        };
        console.log(`✅ [WorkerProceedings] Updated workerData:`, newData);
        return newData;
      });
      setError(null);
    } catch (error) {
      console.error('❌ Error fetching worker logs:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Failed to fetch worker logs';
      if (error.response?.status === 404) {
        errorMessage = 'Worker log tables may not exist in database';
      } else if (error.response?.status === 500) {
        errorMessage = `Server error: ${error.response?.data?.message || 'Internal server error'}`;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // Clear the data for this tab on error
      setWorkerData(prev => ({
        ...prev,
        [activeTab]: null
      }));
      setError({ message: errorMessage, details: error.response?.data });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [activeTab, electionId, getEndpointForTab]);

  useEffect(() => {
    console.log(`🔄 [WorkerProceedings] useEffect triggered`, { electionId, activeTab });
    if (electionId) {
      setError(null); // Clear previous errors when switching tabs
      fetchWorkerLogs();
    }
  }, [electionId, activeTab, fetchWorkerLogs]);

  // Debug: Log when workerData changes
  useEffect(() => {
    console.log(`📊 [WorkerProceedings] workerData updated:`, workerData);
  }, [workerData]);

  const formatDuration = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return 'N/A';
    const totalSeconds = milliseconds / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${Math.round(secs)}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs.toFixed(3)}s`;
    } else {
      return `${secs.toFixed(3)}s`;
    }
  };

  // Returns ordinal string: 1 → '1st', 2 → '2nd', 3 → '3rd', 4 → '4th', etc.
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    return timezoneUtils.formatDateTime(dateTimeString);
  };

  const formatTimeShort = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    return timezoneUtils.formatTimeOnly(dateTimeString);
  };

  const getColorForTab = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    return tab ? tab.color : 'blue';
  };

  const currentData = workerData[activeTab];
  const statistics = currentData?.statistics || {};
  const logs = currentData?.logs || [];

  // Prepare cumulative completion data for line chart
  const cumulativeData = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    
    const sortedLogs = [...logs]
      .filter(log => log.endTime && log.status === 'COMPLETED')
      .sort((a, b) => new Date(a.endTime) - new Date(b.endTime));
    
    let completed = 0;
    const startTime = sortedLogs[0] ? new Date(sortedLogs[0].startTime) : new Date();
    
    return sortedLogs.map((log) => {
      completed++;
      const endTime = new Date(log.endTime);
      const elapsedMinutes = (endTime - startTime) / (1000 * 60);
      
      return {
        time: formatTimeShort(log.endTime),
        elapsedMinutes: elapsedMinutes.toFixed(2),
        completedChunks: completed,
        chunkNumber: log.chunkNumber,
        timestamp: endTime.getTime()
      };
    });
  }, [logs]);

  // Prepare timeline/Gantt chart data
  const timelineData = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    
    const validLogs = logs.filter(log => log.startTime && log.endTime);
    if (validLogs.length === 0) return [];
    
    const firstStart = new Date(Math.min(...validLogs.map(l => new Date(l.startTime))));
    
    return validLogs.map(log => {
      const startTime = new Date(log.startTime);
      const endTime = new Date(log.endTime);
      const startOffset = (startTime - firstStart) / 1000; // seconds from start
      const duration = (endTime - startTime) / 1000; // duration in seconds
      
      return {
        chunkNumber: log.chunkNumber,
        startOffset: startOffset,
        endOffset: startOffset + duration,
        duration: duration,
        startTime: log.startTime,
        endTime: log.endTime,
        status: log.status,
        row: Math.floor(log.chunkNumber / 50) // Group chunks into rows for better visualization
      };
    }).sort((a, b) => a.startOffset - b.startOffset);
  }, [logs]);

  // Prepare data for Processing Time Distribution sorted by completion order
  const completionOrderedData = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    return [...logs]
      .filter(log => log.duration && log.endTime)
      .sort((a, b) => new Date(a.endTime) - new Date(b.endTime))
      .map((log, index) => ({
        ...log,
        completionRank: index + 1,   // 1-based rank: 1st, 2nd, 3rd…
      }));
  }, [logs]);

  // Debug logging
  console.log(`🔍 [WorkerProceedings] Render state:`, {
    activeTab,
    electionId,
    hasCurrentData: !!currentData,
    currentData,
    statisticsKeys: Object.keys(statistics),
    logsLength: logs.length,
    logs,
    loading,
    error
  });

  return (
    <div className="w-full space-y-5 p-1 sm:p-2">
      <header className="surface-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div>
            <p className="section-kicker">Operations analytics</p>
            <h1 className="font-display mt-1 text-2xl font-semibold text-deep sm:text-3xl">Worker proceedings</h1>
            <p className="mt-1 text-sm text-dusk">Monitor each processing stage, throughput, and worker outcomes.</p>
          </div>
          <button
            onClick={() => fetchWorkerLogs()}
            className="btn-brand inline-flex items-center gap-2"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
      </header>

      <nav className="glass-panel p-1.5" aria-label="Worker process">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-deep text-paper shadow-sm' : 'text-dusk hover:bg-frost hover:text-deep'
                }`}
              >
                <Icon className="text-xl" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {loading ? (
        <div className="glass-panel flex min-h-64 items-center justify-center p-8">
          <div className="flex items-center gap-3 text-dusk">
            <FiRefreshCw className="animate-spin text-xl text-brand" />
            <div><p className="font-semibold text-deep">Loading proceedings</p><p className="text-sm">Fetching processing analytics.</p></div>
          </div>
        </div>
      ) : error ? (
        <section className="surface-card mx-auto max-w-3xl p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-ember-soft p-3 text-ember"><FiAlertTriangle className="text-xl" /></div>
            <div className="flex-1"><p className="font-display text-xl font-semibold text-deep">Unable to load worker logs</p><p className="mt-1 text-dusk">{error.message}</p></div>
          </div>
            {error.details && (
              <details className="mt-5">
                <summary className="cursor-pointer rounded-lg bg-frost px-4 py-3 text-sm font-medium text-dusk">
                  Show technical details
                </summary>
                <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-deep p-4 text-xs text-frost">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </details>
            )}
            <button
              onClick={() => fetchWorkerLogs()}
              className="btn-brand mt-5 inline-flex items-center gap-2"
            >
              <FiRefreshCw /> Retry
            </button>
            <div className="mt-6 rounded-xl border border-ceremonial/40 bg-ceremonial-soft/70 p-5">
              <h4 className="mb-3 font-semibold text-ink">Troubleshooting</h4>
              <ul className="space-y-2 text-sm text-ink">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-ink">•</span>
                  <span>Make sure the worker log tables exist in the database</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-ink">•</span>
                  <span>Run the table creation SQL script if tables are missing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-ink">•</span>
                  <span>Check backend logs for detailed error messages</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-ink">•</span>
                  <span>Verify the election ID is correct</span>
                </li>
              </ul>
            </div>
        </section>
      ) : !currentData ? (
        <div className="glass-panel flex min-h-64 items-center justify-center p-8 text-center">
          <div><FiAlertTriangle className="mx-auto mb-3 text-2xl text-amber-500" /><p className="font-display text-lg font-semibold text-deep">No data available</p></div>
        </div>
      ) : logs.length === 0 ? (
        <section className="surface-card mx-auto max-w-3xl p-8 text-center">
            <div className="mx-auto mb-4 w-fit rounded-xl bg-glacier p-3 text-brand"><FiActivity className="text-2xl" /></div>
            <h3 className="font-display text-2xl font-semibold text-deep">No processing logs yet</h3>
              <p className="mt-2 text-dusk">
                This election hasn't gone through {activeTab === 'tally' ? 'tally processing' 
                  : activeTab === 'partialDecryption' ? 'partial decryption' 
                  : activeTab === 'compensatedDecryption' ? 'compensated decryption' 
                  : 'combine decryption'} yet.
              </p>
            <div className="mt-6 rounded-xl bg-frost p-5 text-left">
              <h4 className="mb-3 font-semibold text-deep">What to expect</h4>
              <ul className="space-y-2 text-sm text-dusk">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">•</span>
                  <span>Worker logs are created during election processing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">•</span>
                  <span>Only new elections (after worker log tables were created) will have logs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand">•</span>
                  <span>Logs appear after tally creation, guardian decryption, or result combining</span>
                </li>
              </ul>
            </div>
        </section>
      ) : (
        <>
          {/* Initiator Email Banner */}
          {statistics.initiatorEmail && (
            <div className="surface-card flex items-center gap-3 p-4">
              <div className="rounded-lg bg-glacier p-2 text-brand">
                <FiActivity className="text-lg" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-dusk">
                  {activeTab === 'tally' ? 'Tally Creation' : 'Combine Decryption'} Initiated By
                </span>
                <p className="text-base font-semibold text-deep">
                  {statistics.initiatorEmail}
                </p>
              </div>
            </div>
          )}

          {/* Modern Statistics Cards with Glassmorphism */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Total Processing Time */}
            <div className="surface-card border-t-4 border-brand p-5">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-glacier p-3 text-brand"><FiClock className="text-xl" /></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-dusk">Total</span>
                </div>
                <p className="mt-5 text-2xl font-semibold tracking-tight text-deep">
                  {formatDuration(statistics.totalProcessingTime)}
                </p>
                <p className="mt-1 text-sm text-dusk">Total processing time</p>
            </div>

            {/* Average Time */}
            <div className="surface-card border-t-4 border-deep p-5">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-frost p-3 text-deep"><FiTrendingUp className="text-xl" /></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-dusk">Average</span>
                </div>
                <p className="mt-5 text-2xl font-semibold tracking-tight text-deep">
                  {formatDuration(statistics.averageProcessingTime)}
                </p>
                <p className="mt-1 text-sm text-dusk">Average per chunk</p>
            </div>

            {/* Total Elapsed Time */}
            <div className="surface-card border-t-4 border-sage p-5">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-sage/15 p-3 text-sage"><FiZap className="text-xl" /></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-dusk">Elapsed</span>
                </div>
                <p className="mt-5 text-2xl font-semibold tracking-tight text-deep">
                  {formatDuration(statistics.totalElapsedTime)}
                </p>
                <p className="mt-1 text-sm text-dusk">Total elapsed time</p>
            </div>

            {/* Completion Status */}
            <div className="surface-card border-t-4 border-amber-400 p-5">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-ceremonial-soft p-3 text-ink"><FiCheckCircle className="text-xl" /></div>
                  <span className="text-xs font-bold uppercase tracking-wider text-dusk">Status</span>
                </div>
                <p className="mt-5 text-2xl font-semibold tracking-tight text-deep">
                  {statistics.completedCount || 0} / {logs.length}
                </p>
                <p className="mt-1 text-sm text-dusk">
                  Completed chunks
                  {statistics.failedCount > 0 && (
                    <span className="ml-2 rounded-full bg-ember-soft px-2 py-1 text-xs font-semibold text-ember">
                      {statistics.failedCount} Failed
                    </span>
                  )}
                </p>
            </div>
          </div>

          {/* NEW GRAPH 1: Cumulative Chunks Completed Over Time (Line Graph) */}
          {cumulativeData.length > 0 && (
            <div className="surface-card p-5 sm:p-6">
              <div className="mb-5">
                <div>
                  <h3 className="font-display flex items-center gap-2 text-xl font-semibold text-deep">
                    <div className="rounded-lg bg-glacier p-2 text-brand">
                      <FiTrendingUp className="text-lg" />
                    </div>
                    Completion Progress Over Time
                  </h3>
                  <p className="mt-1 text-sm text-dusk">Cumulative chunks completed as processing progresses</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={450}>
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B7FE8" stopOpacity={0.45}/>
                      <stop offset="95%" stopColor="#8B7FE8" stopOpacity={0.03}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                  <XAxis 
                    dataKey="time" 
                    stroke={tickColor}
                    tick={{ fill: tickColor, fontSize: 12 }}
                    label={{ value: 'Time', position: 'insideBottom', offset: -10, fill: labelColor, fontWeight: 600 }}
                  />
                  <YAxis 
                    stroke={tickColor}
                    tick={{ fill: tickColor, fontSize: 12 }}
                    label={{ value: 'Completed Chunks', angle: -90, position: 'insideLeft', fill: labelColor, fontWeight: 600 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#073B4C',
                      border: '1px solid #8B7FE8',
                      borderRadius: '10px',
                      padding: '12px'
                    }}
                    labelStyle={{ color: '#F8FCFC', fontWeight: 'bold', marginBottom: '8px' }}
                    itemStyle={{ color: '#8FD6C2', fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completedChunks" 
                    stroke="#8B7FE8" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorCumulative)"
                    name="Completed Chunks"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* NEW GRAPH 2: Processing Schedule Timeline (Gantt-style, chunk on X / time on Y) */}
          {timelineData.length > 0 && (() => {
            const ganttData = timelineData.map(item => ({
              name: `${item.chunkNumber}`,
              spacer: parseFloat(item.startOffset.toFixed(3)),
              duration: parseFloat(item.duration.toFixed(3)),
              status: item.status,
              startTime: item.startTime,
              endTime: item.endTime,
              chunkNumber: item.chunkNumber,
            }));
            const barWidth = Math.max(6, Math.min(24, Math.floor(900 / (ganttData.length || 1))));
            const chartWidth = Math.max(900, ganttData.length * (barWidth + 4) + 100);
            return (
              <div className="surface-card p-5 sm:p-6">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-display flex items-center gap-2 text-xl font-semibold text-deep">
                      <div className="rounded-lg bg-sage/15 p-2 text-sage">
                        <FiCalendar className="text-lg" />
                      </div>
                      Processing Schedule Timeline
                    </h3>
                    <p className="mt-1 text-sm text-dusk">
                      Each bar shows the time-span (start → end) of a chunk — chunk on X-axis, time on Y-axis
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-aurora"></div>
                      <span className="font-medium text-dusk">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-ember"></div>
                      <span className="font-medium text-dusk">Failed</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div style={{ minWidth: `${chartWidth}px` }}>
                    <ResponsiveContainer width="100%" height={Math.max(400, 300)}>
                      <BarChart
                        data={ganttData}
                        margin={{ top: 20, right: 30, bottom: 60, left: 70 }}
                        barCategoryGap="10%"
                      >
                        <defs>
                          <pattern id="completedPattern" patternUnits="userSpaceOnUse" width="6" height="6">
                            <rect width="6" height="6" fill="#10B981" opacity={0.9} />
                          </pattern>
                          <pattern id="failedPattern" patternUnits="userSpaceOnUse" width="6" height="6">
                            <rect width="6" height="6" fill="#EF4444" opacity={0.9} />
                          </pattern>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke={tickColor}
                          tick={{ fill: tickColor, fontSize: 10 }}
                          interval={ganttData.length > 50 ? Math.floor(ganttData.length / 20) : 0}
                          label={{
                            value: 'Chunk Number',
                            position: 'insideBottom',
                            offset: -10,
                            fill: labelColor,
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        />
                        <YAxis
                          stroke={tickColor}
                          tick={{ fill: tickColor, fontSize: 11 }}
                          tickFormatter={(v) => `${v.toFixed(1)}s`}
                          label={{
                            value: 'Time from Start (s)',
                            angle: -90,
                            position: 'insideLeft',
                            offset: -10,
                            fill: labelColor,
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(17, 24, 39, 0.97)',
                            border: 'none',
                            borderRadius: '14px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            padding: '14px',
                          }}
                          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const entry = payload[0]?.payload;
                            if (!entry) return null;
                            return (
                              <div className="bg-deep/98 text-paper p-4 rounded-2xl shadow-2xl border border-gray-700 min-w-[180px]">
                                <p className="font-bold text-lg mb-2 text-brand">Chunk #{entry.chunkNumber}</p>
                                <p className="text-sm mb-1"><span className="text-dusk">Starts at:</span> <span className="text-paper font-semibold">{entry.spacer.toFixed(3)}s</span></p>
                                <p className="text-sm mb-1"><span className="text-dusk">Duration:</span> <span className="text-paper font-semibold">{entry.duration.toFixed(3)}s</span></p>
                                <p className="text-sm mb-1"><span className="text-dusk">Ends at:</span> <span className="text-paper font-semibold">{(entry.spacer + entry.duration).toFixed(3)}s</span></p>
                                <p className="text-sm"><span className="text-dusk">Status:</span>
                                  <span className={`ml-2 font-bold ${entry.status === 'COMPLETED' ? 'text-aurora' : 'text-ember'}`}>
                                    {entry.status}
                                  </span>
                                </p>
                              </div>
                            );
                          }}
                        />
                        {/* Invisible spacer bar to push the real bar to the correct Y start */}
                        <Bar dataKey="spacer" stackId="a" fill="transparent" isAnimationActive={false} />
                        {/* Actual duration bar colored by status */}
                        <Bar dataKey="duration" stackId="a" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          {ganttData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.status === 'COMPLETED' ? '#10B981' : '#EF4444'}
                              opacity={0.9}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-brand/20 bg-glacier p-4">
                  <p className="text-sm text-ink">
                    <span className="font-bold text-brand">Tip:</span> Each bar spans from its
                    <strong> start time</strong> to its <strong>end time</strong> on the Y-axis.
                    Chunks are sorted by start time left-to-right. Hover for details.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Timeline View */}
          {statistics.firstStartTime && statistics.lastEndTime && (
            <div className="surface-card p-5 sm:p-6">
              <h3 className="font-display mb-5 flex items-center gap-2 text-xl font-semibold text-deep">
                <div className="rounded-lg bg-glacier p-2 text-brand">
                  <FiClock className="text-lg" />
                </div>
                Processing Duration Overview
              </h3>
              <div className="flex items-center justify-between">
                <div className="mr-4 flex flex-1 flex-col rounded-xl bg-glacier p-5">
                  <span className="mb-2 text-sm font-bold uppercase tracking-wide text-brand">Start Time</span>
                  <span className="text-xl font-semibold text-deep">
                    {formatTime(statistics.firstStartTime)}
                  </span>
                </div>
                <div className="flex-1 mx-8">
                  <div className="relative h-3 overflow-hidden rounded-full bg-frost">
                    <div 
                      className="absolute inset-y-0 left-0 rounded-full bg-brand"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <p className="mt-3 text-center text-sm font-semibold text-dusk">
                    Total Duration: <span className="font-bold text-deep">{formatDuration(statistics.totalElapsedTime)}</span>
                  </p>
                </div>
                <div className="ml-4 flex flex-1 flex-col rounded-xl bg-frost p-5 text-right">
                  <span className="mb-2 text-sm font-bold uppercase tracking-wide text-deep">End Time</span>
                  <span className="text-xl font-semibold text-deep">
                    {formatTime(statistics.lastEndTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Original Bar Chart - Modernized with completion order */}
          {logs.length > 0 && completionOrderedData.length > 0 && (
            <div className="surface-card p-5 sm:p-6">
              <h3 className="font-display mb-2 flex items-center gap-2 text-xl font-semibold text-deep">
                <div className="rounded-lg bg-glacier p-2 text-brand">
                  <FiBarChart2 className="text-lg" />
                </div>
                Processing Time Distribution
              </h3>
              <p className="mb-5 text-sm text-dusk">
                Bars sorted by <strong>completion order</strong>. The top label is the chunk number; the bottom label shows when it finished (1st, 2nd, 3rd…).
              </p>
              <div className="overflow-x-auto">
                <div style={{ minWidth: `${Math.max(700, completionOrderedData.length * 28)}px` }}>
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart
                      data={completionOrderedData}
                      margin={{ top: 20, right: 30, bottom: 80, left: 70 }}
                    >
                      <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B7FE8" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#0077B6" stopOpacity={0.8}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                      <XAxis
                        dataKey="completionRank"
                        stroke={tickColor}
                        interval={completionOrderedData.length > 50 ? Math.floor(completionOrderedData.length / 25) : 0}
                        tick={(props) => {
                          const { x, y, payload } = props;
                          const item = completionOrderedData.find(d => d.completionRank === payload.value);
                          const ordinal = getOrdinal(payload.value);
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={18} textAnchor="middle" fill={labelColor} fontSize={11} fontWeight={700}>
                                #{item?.chunkNumber ?? payload.value}
                              </text>
                              <text x={0} y={0} dy={34} textAnchor="middle" fill={tickColor} fontSize={9} opacity={0.8}>
                                {ordinal}
                              </text>
                            </g>
                          );
                        }}
                        height={60}
                        label={{
                          value: 'Chunk  (completion order below)',
                          position: 'insideBottom',
                          offset: -55,
                          fill: labelColor,
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      />
                      <YAxis
                        stroke={tickColor}
                        tick={{ fill: tickColor, fontSize: 12 }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(3)}s`}
                        label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft', offset: -10, fill: labelColor, fontWeight: 600, fontSize: 13 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(17, 24, 39, 0.97)',
                          border: 'none',
                          borderRadius: '14px',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                          padding: '14px',
                        }}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const entry = payload[0]?.payload;
                          if (!entry) return null;
                          return (
                            <div className="bg-deep/98 text-paper p-4 rounded-2xl shadow-2xl border border-gray-700">
                              <p className="mb-1 text-base font-bold text-brand">Chunk #{entry.chunkNumber}</p>
                              <p className="text-sm mb-1"><span className="text-dusk">Completion order:</span> <span className="text-paper font-semibold">{getOrdinal(entry.completionRank)} to finish</span></p>
                              <p className="text-sm"><span className="text-dusk">Duration:</span> <span className="text-paper font-semibold">{formatDuration(entry.duration)}</span></p>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="duration"
                        fill="url(#colorGradient)"
                        radius={[10, 10, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Logs Table - Modernized */}
          <div className="surface-card overflow-hidden">
            <div className="border-b border-brand/15 bg-glacier px-5 py-5 sm:px-6">
              <h3 className="font-display flex items-center gap-2 text-xl font-semibold text-deep">
                <FiLayers className="text-brand" />
                Detailed Chunk Logs
              </h3>
              <p className="mt-1 text-sm text-dusk">Complete processing details for every chunk</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-frost">
                  <tr>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 text-left text-xs font-black text-dusk uppercase tracking-wider">
                      Chunk
                    </th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 text-left text-xs font-black text-dusk uppercase tracking-wider">
                      Start Time
                    </th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 text-left text-xs font-black text-dusk uppercase tracking-wider">
                      End Time
                    </th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 text-left text-xs font-black text-dusk uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 sm:px-8 py-4 sm:py-5 text-left text-xs font-black text-dusk uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {logs.map((log, index) => (
                    <tr 
                      key={log.id}
                      className="group transition-colors hover:bg-glacier/50"
                    >
                      <td className="px-4 sm:px-8 py-4 sm:py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-deep text-sm font-semibold text-paper transition-transform group-hover:scale-105 sm:h-12 sm:w-12">
                            {log.chunkNumber}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5 whitespace-nowrap text-sm font-semibold text-dusk">
                        {formatTime(log.startTime)}
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5 whitespace-nowrap text-sm font-semibold text-dusk">
                        {formatTime(log.endTime)}
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-lg bg-glacier px-3 py-2 text-sm font-semibold text-deep">
                          <FiClock className="mr-2" />
                          {formatDuration(log.duration)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5 whitespace-nowrap">
                        {log.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-sage-soft to-sage-soft text-aurora-muted shadow-md">
                            <FiCheckCircle className="mr-2" />
                            Completed
                          </span>
                        ) : log.status === 'FAILED' ? (
                          <span className="inline-flex items-center rounded-lg bg-ember-soft px-3 py-2 text-sm font-semibold text-ember">
                            <FiXCircle className="mr-2" />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-ceremonial-soft to-ceremonial-soft text-ink shadow-md">
                            <FiActivity className="mr-2 animate-pulse" />
                            In Progress
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error Messages Section - Modernized */}
          {logs.some(log => log.errorMessage) && (
            <div className="surface-card mt-6 border-l-4 border-l-red-500 p-5 sm:p-6">
              <h3 className="font-display mb-5 flex items-center gap-2 text-xl font-semibold text-deep">
                <div className="rounded-lg bg-ember-soft p-2 text-ember">
                  <FiAlertTriangle className="text-lg" />
                </div>
                Error Details
              </h3>
              <div className="space-y-4">
                {logs.filter(log => log.errorMessage).map(log => (
                  <div key={log.id} className="rounded-xl border border-red-100 bg-ember-soft/30 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="rounded-lg bg-ember px-3 py-2 text-sm font-semibold text-paper">
                        Chunk {log.chunkNumber}
                      </span>
                      <span className="text-sm font-semibold text-dusk">
                        at {formatTime(log.endTime)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-dusk bg-frost p-4 rounded-xl">
                      {log.errorMessage}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkerProceedings;
