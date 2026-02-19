import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
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

  const tabs = [
    { id: 'tally', label: 'Tally Processing', icon: FiBarChart2, color: 'blue' },
    { id: 'partialDecryption', label: 'Partial Decryption', icon: FiActivity, color: 'purple' },
    { id: 'compensatedDecryption', label: 'Compensated Decryption', icon: FiZap, color: 'orange' },
    { id: 'combine', label: 'Combine Decryption', icon: FiPackage, color: 'green' }
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
    if (!milliseconds) return 'N/A';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTimeShort = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-800 p-4 md:p-8">
      {/* Modern Header with Glassmorphism */}
      <div className="mb-10 backdrop-blur-xl bg-white/70 dark:bg-gray-800/70 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-3 flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                <FiActivity className="text-3xl text-white" />
              </div>
              Worker Proceedings Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-lg ml-1">
              Real-time performance metrics and advanced processing insights
            </p>
          </div>
          <button
            onClick={() => fetchWorkerLogs()}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Modern Tabs with Pill Design */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-3 p-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold transition-all duration-300 transform flex-1 min-w-fit justify-center
                  ${isActive 
                    ? `bg-gradient-to-r ${
                        tab.color === 'blue' ? 'from-blue-500 to-blue-600' :
                        tab.color === 'purple' ? 'from-purple-500 to-purple-600' :
                        tab.color === 'orange' ? 'from-orange-500 to-orange-600' :
                        'from-green-500 to-green-600'
                      } text-white shadow-xl scale-105`
                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-102 shadow-md'
                  }
                `}
              >
                <Icon className="text-xl" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-6 p-12 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50">
            <div className="relative">
              <div className="w-24 h-24 border-8 border-blue-200 dark:border-blue-900 rounded-full"></div>
              <div className="absolute top-0 left-0 w-24 h-24 border-8 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Loading Worker Data
              </p>
              <p className="text-gray-500 dark:text-gray-400">Fetching processing analytics...</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-6 max-w-3xl p-12 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-red-200 dark:border-red-800">
            <div className="p-6 bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl shadow-xl">
              <FiAlertTriangle className="text-6xl text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-3">
                Error Loading Worker Logs
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-lg mb-6">{error.message}</p>
            </div>
            {error.details && (
              <details className="w-full">
                <summary className="cursor-pointer text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-white/50 dark:bg-gray-800/50 p-4 rounded-xl transition-colors">
                  Show technical details
                </summary>
                <pre className="mt-4 p-6 bg-gray-800 dark:bg-gray-900 text-green-400 rounded-2xl text-xs overflow-auto max-h-60 shadow-inner border border-gray-700">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </details>
            )}
            <button
              onClick={() => fetchWorkerLogs()}
              className="mt-4 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl font-black flex items-center gap-3 transition-all transform hover:scale-105 shadow-xl"
            >
              <FiRefreshCw className="text-xl" /> Retry
            </button>
            <div className="mt-6 p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl">
              <h4 className="font-black text-yellow-800 dark:text-yellow-200 mb-4 flex items-center gap-2 text-lg">
                💡 Troubleshooting Tips
              </h4>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 font-bold">•</span>
                  <span>Make sure the worker log tables exist in the database</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 font-bold">•</span>
                  <span>Run the table creation SQL script if tables are missing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 font-bold">•</span>
                  <span>Check backend logs for detailed error messages</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 font-bold">•</span>
                  <span>Verify the election ID is correct</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : !currentData ? (
        <div className="flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-6 p-12 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50">
            <div className="p-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl shadow-xl">
              <FiAlertTriangle className="text-6xl text-white" />
            </div>
            <p className="text-2xl font-black bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              No data available
            </p>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-6 max-w-3xl p-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-blue-200 dark:border-blue-800">
            <div className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-xl">
              <FiActivity className="text-6xl text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                No Processing Logs Yet
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-lg">
                This election hasn't gone through {activeTab === 'tally' ? 'tally processing' 
                  : activeTab === 'partialDecryption' ? 'partial decryption' 
                  : activeTab === 'compensatedDecryption' ? 'compensated decryption' 
                  : 'combine decryption'} yet.
              </p>
            </div>
            <div className="mt-4 p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-700 rounded-2xl">
              <h4 className="font-black text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                ℹ️ Information
              </h4>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span>Worker logs are created during election processing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span>Only new elections (after worker log tables were created) will have logs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                  <span>Logs appear after tally creation, guardian decryption, or result combining</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Modern Statistics Cards with Glassmorphism */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Total Processing Time */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl p-8 text-white shadow-2xl transform hover:scale-105 transition-all duration-500 hover:shadow-blue-500/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                    <FiClock className="text-4xl" />
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-bold">
                    TOTAL
                  </div>
                </div>
                <p className="text-4xl font-black mb-3 tracking-tight">
                  {formatDuration(statistics.totalProcessingTime)}
                </p>
                <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">Total Processing Time</p>
              </div>
            </div>

            {/* Average Time */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 rounded-3xl p-8 text-white shadow-2xl transform hover:scale-105 transition-all duration-500 hover:shadow-purple-500/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                    <FiTrendingUp className="text-4xl" />
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-bold">
                    AVG
                  </div>
                </div>
                <p className="text-4xl font-black mb-3 tracking-tight">
                  {formatDuration(statistics.averageProcessingTime)}
                </p>
                <p className="text-purple-100 text-sm font-medium uppercase tracking-wide">Average Per Chunk</p>
              </div>
            </div>

            {/* Total Elapsed Time */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-green-500 via-green-600 to-green-700 rounded-3xl p-8 text-white shadow-2xl transform hover:scale-105 transition-all duration-500 hover:shadow-green-500/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                    <FiZap className="text-4xl" />
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-bold">
                    ELAPSED
                  </div>
                </div>
                <p className="text-4xl font-black mb-3 tracking-tight">
                  {formatDuration(statistics.totalElapsedTime)}
                </p>
                <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Total Elapsed Time</p>
              </div>
            </div>

            {/* Completion Status */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-3xl p-8 text-white shadow-2xl transform hover:scale-105 transition-all duration-500 hover:shadow-orange-500/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                    <FiCheckCircle className="text-4xl" />
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-bold">
                    STATUS
                  </div>
                </div>
                <p className="text-4xl font-black mb-3 tracking-tight">
                  {statistics.completedCount || 0} / {logs.length}
                </p>
                <p className="text-orange-100 text-sm font-medium uppercase tracking-wide">
                  Completed Chunks
                  {statistics.failedCount > 0 && (
                    <span className="ml-2 bg-red-500/40 px-3 py-1 rounded-full text-xs font-bold">
                      {statistics.failedCount} Failed
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* NEW GRAPH 1: Cumulative Chunks Completed Over Time (Line Graph) */}
          {cumulativeData.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-10 border border-white/20 dark:border-gray-700/50">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                      <FiTrendingUp className="text-2xl text-white" />
                    </div>
                    Completion Progress Over Time
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 ml-1">Cumulative chunks completed as processing progresses</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={450}>
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" opacity={0.3} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#6B7280"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    label={{ value: 'Time', position: 'insideBottom', offset: -10, fill: '#374151', fontWeight: 600 }}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    label={{ value: 'Completed Chunks', angle: -90, position: 'insideLeft', fill: '#374151', fontWeight: 600 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(31, 41, 55, 0.95)', 
                      border: 'none', 
                      borderRadius: '16px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(10px)',
                      padding: '16px'
                    }}
                    labelStyle={{ color: '#F3F4F6', fontWeight: 'bold', marginBottom: '8px' }}
                    itemStyle={{ color: '#A78BFA', fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completedChunks" 
                    stroke="#8B5CF6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorCumulative)"
                    name="Completed Chunks"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* NEW GRAPH 2: Processing Schedule Timeline (Gantt-style) */}
          {timelineData.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-10 border border-white/20 dark:border-gray-700/50">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-3xl font-black bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl">
                      <FiCalendar className="text-2xl text-white" />
                    </div>
                    Processing Schedule Timeline
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 ml-1">Visual timeline showing when each chunk was processed</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Failed</span>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <div style={{ minWidth: `${Math.max(800, timelineData.length * 2)}px` }}>
                  <ResponsiveContainer width="100%" height={Math.max(400, Math.ceil(timelineData.length / 50) * 40 + 100)}>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" opacity={0.3} />
                      <XAxis 
                        type="number" 
                        dataKey="startOffset" 
                        name="Time" 
                        stroke="#6B7280"
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        label={{ 
                          value: 'Time from Start (seconds)', 
                          position: 'insideBottom', 
                          offset: -10,
                          fill: '#374151',
                          fontWeight: 600
                        }}
                        domain={[0, 'dataMax']}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="row" 
                        name="Row" 
                        stroke="#6B7280"
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        label={{ 
                          value: 'Chunk Groups (50 chunks per row)', 
                          angle: -90, 
                          position: 'insideLeft',
                          fill: '#374151',
                          fontWeight: 600
                        }}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ 
                          backgroundColor: 'rgba(31, 41, 55, 0.95)', 
                          border: 'none', 
                          borderRadius: '16px',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                          backdropFilter: 'blur(10px)',
                          padding: '16px'
                        }}
                        labelStyle={{ color: '#F3F4F6', fontWeight: 'bold' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-gray-900/95 backdrop-blur-sm text-white p-4 rounded-2xl shadow-2xl border border-gray-700">
                                <p className="font-bold text-lg mb-2 text-blue-400">Chunk #{data.chunkNumber}</p>
                                <p className="text-sm mb-1"><span className="text-gray-400">Start:</span> {formatTimeShort(data.startTime)}</p>
                                <p className="text-sm mb-1"><span className="text-gray-400">End:</span> {formatTimeShort(data.endTime)}</p>
                                <p className="text-sm mb-1"><span className="text-gray-400">Duration:</span> {formatDuration(data.duration * 1000)}</p>
                                <p className="text-sm">
                                  <span className="text-gray-400">Status:</span> 
                                  <span className={`ml-2 font-bold ${data.status === 'COMPLETED' ? 'text-green-400' : 'text-red-400'}`}>
                                    {data.status}
                                  </span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter 
                        data={timelineData} 
                        shape={(props) => {
                          const { cx, cy, payload } = props;
                          const width = Math.max(4, (payload.duration / 10)); // Scale width based on duration
                          const height = 20;
                          const color = payload.status === 'COMPLETED' ? '#10B981' : 
                                       payload.status === 'FAILED' ? '#EF4444' : '#F59E0B';
                          
                          return (
                            <g>
                              <rect
                                x={cx - width/2}
                                y={cy - height/2}
                                width={width}
                                height={height}
                                fill={color}
                                opacity={0.8}
                                rx={4}
                                className="hover:opacity-100 transition-opacity cursor-pointer"
                              />
                            </g>
                          );
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-bold text-blue-600 dark:text-blue-400">💡 Tip:</span> Each bar represents a chunk. 
                  The horizontal position shows when it started, and the width represents processing duration. 
                  Chunks are grouped into rows (50 chunks per row) for better visualization. Hover over bars for details.
                </p>
              </div>
            </div>
          )}

          {/* Timeline View */}
          {statistics.firstStartTime && statistics.lastEndTime && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-10 border border-white/20 dark:border-gray-700/50">
              <h3 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl">
                  <FiClock className="text-2xl text-white" />
                </div>
                Processing Duration Overview
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 p-6 rounded-2xl shadow-lg flex-1 mr-4">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">Start Time</span>
                  <span className="text-2xl font-black text-gray-800 dark:text-white">
                    {formatTime(statistics.firstStartTime)}
                  </span>
                </div>
                <div className="flex-1 mx-8">
                  <div className="relative h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-full shadow-lg animate-pulse"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <p className="text-center mt-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Total Duration: <span className="text-purple-600 dark:text-purple-400 font-bold">{formatDuration(statistics.totalElapsedTime)}</span>
                  </p>
                </div>
                <div className="flex flex-col bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 p-6 rounded-2xl shadow-lg flex-1 ml-4 text-right">
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2">End Time</span>
                  <span className="text-2xl font-black text-gray-800 dark:text-white">
                    {formatTime(statistics.lastEndTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Original Bar Chart - Modernized */}
          {logs.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-10 border border-white/20 dark:border-gray-700/50">
              <h3 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-8 flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                  <FiBarChart2 className="text-2xl text-white" />
                </div>
                Processing Time Distribution
              </h3>
              <ResponsiveContainer width="100%" height={450}>
                <BarChart data={logs.filter(log => log.duration)}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" opacity={0.3} />
                  <XAxis 
                    dataKey="chunkNumber" 
                    stroke="#6B7280"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    label={{ value: 'Chunk Number', position: 'insideBottom', offset: -10, fill: '#374151', fontWeight: 600 }}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(1)}s`}
                    label={{ value: 'Duration', angle: -90, position: 'insideLeft', fill: '#374151', fontWeight: 600 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(31, 41, 55, 0.95)', 
                      border: 'none', 
                      borderRadius: '16px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(10px)',
                      padding: '16px'
                    }}
                    labelStyle={{ color: '#F3F4F6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#A78BFA', fontWeight: 600 }}
                    formatter={(value) => [formatDuration(value), 'Duration']}
                  />
                  <Bar 
                    dataKey="duration" 
                    fill="url(#colorGradient)" 
                    radius={[12, 12, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed Logs Table - Modernized */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 dark:border-gray-700/50">
            <div className="bg-gradient-to-r from-green-500 to-teal-600 p-8">
              <h3 className="text-3xl font-black text-white flex items-center gap-3">
                <FiLayers className="text-3xl" />
                Detailed Chunk Logs
              </h3>
              <p className="text-green-50 mt-2">Complete processing details for every chunk</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
                  <tr>
                    <th className="px-8 py-5 text-left text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Chunk
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Start Time
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      End Time
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-8 py-5 text-left text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((log, index) => (
                    <tr 
                      key={log.id}
                      className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-200 group"
                    >
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-black shadow-lg group-hover:scale-110 transition-transform">
                            {log.chunkNumber}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {formatTime(log.startTime)}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {formatTime(log.endTime)}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900 text-purple-800 dark:text-purple-200 shadow-md">
                          <FiClock className="mr-2" />
                          {formatDuration(log.duration)}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        {log.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 text-green-800 dark:text-green-200 shadow-md">
                            <FiCheckCircle className="mr-2" />
                            Completed
                          </span>
                        ) : log.status === 'FAILED' ? (
                          <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 text-red-800 dark:text-red-200 shadow-md">
                            <FiXCircle className="mr-2" />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 text-yellow-800 dark:text-yellow-200 shadow-md">
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
            <div className="mt-10 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border-2 border-red-200 dark:border-red-800">
              <h3 className="text-3xl font-black bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl">
                  <FiAlertTriangle className="text-2xl text-white" />
                </div>
                Error Details
              </h3>
              <div className="space-y-4">
                {logs.filter(log => log.errorMessage).map(log => (
                  <div key={log.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-l-8 border-red-500 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-black rounded-xl shadow-md">
                        Chunk {log.chunkNumber}
                      </span>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        at {formatTime(log.endTime)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
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
