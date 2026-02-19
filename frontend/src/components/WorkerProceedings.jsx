import React, { useState, useEffect, useCallback } from 'react';
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
  FiAlertTriangle
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
  AreaChart
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

  const getColorForTab = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    return tab ? tab.color : 'blue';
  };

  const currentData = workerData[activeTab];
  const statistics = currentData?.statistics || {};
  const logs = currentData?.logs || [];

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
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-3">
          <FiActivity className="text-blue-500" />
          Worker Proceedings Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time performance metrics and detailed worker processing insights
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform
                  ${isActive 
                    ? `bg-${tab.color}-500 text-white shadow-lg shadow-${tab.color}-500/50 scale-105`
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-102'
                  }
                `}
              >
                <Icon className="text-xl" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <FiRefreshCw className="text-6xl text-blue-500 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">Loading worker data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4 max-w-2xl p-8 bg-red-50 dark:bg-red-900/20 rounded-2xl border-2 border-red-200 dark:border-red-800">
            <FiAlertTriangle className="text-6xl text-red-500" />
            <h3 className="text-xl font-bold text-red-800 dark:text-red-200">Error Loading Worker Logs</h3>
            <p className="text-gray-700 dark:text-gray-300 text-center">{error.message}</p>
            {error.details && (
              <details className="mt-4 w-full">
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                  Show technical details
                </summary>
                <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </details>
            )}
            <button
              onClick={() => fetchWorkerLogs()}
              className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <FiRefreshCw /> Retry
            </button>
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">💡 Troubleshooting Tips:</h4>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                <li>Make sure the worker log tables exist in the database</li>
                <li>Run the table creation SQL script if tables are missing</li>
                <li>Check backend logs for detailed error messages</li>
                <li>Verify the election ID is correct</li>
              </ul>
            </div>
          </div>
        </div>
      ) : !currentData ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <FiAlertTriangle className="text-6xl text-yellow-500" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">No data available</p>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4 max-w-2xl p-8 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
            <FiActivity className="text-6xl text-blue-500" />
            <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200">No Processing Logs Yet</h3>
            <p className="text-gray-700 dark:text-gray-300 text-center">
              This election hasn't gone through {activeTab === 'tally' ? 'tally processing' 
                : activeTab === 'partialDecryption' ? 'partial decryption' 
                : activeTab === 'compensatedDecryption' ? 'compensated decryption' 
                : 'combine decryption'} yet.
            </p>
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">ℹ️ Information:</h4>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                <li>Worker logs are created during election processing</li>
                <li>Only new elections (after worker log tables were created) will have logs</li>
                <li>Logs appear after tally creation, guardian decryption, or result combining</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Processing Time */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <FiClock className="text-4xl opacity-80" />
                <div className="bg-white/20 rounded-full px-3 py-1 text-sm font-semibold">
                  Total
                </div>
              </div>
              <p className="text-3xl font-bold mb-2">
                {formatDuration(statistics.totalProcessingTime)}
              </p>
              <p className="text-blue-100 text-sm">Total Processing Time</p>
            </div>

            {/* Average Time */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <FiTrendingUp className="text-4xl opacity-80" />
                <div className="bg-white/20 rounded-full px-3 py-1 text-sm font-semibold">
                  Average
                </div>
              </div>
              <p className="text-3xl font-bold mb-2">
                {formatDuration(statistics.averageProcessingTime)}
              </p>
              <p className="text-purple-100 text-sm">Average Per Chunk</p>
            </div>

            {/* Total Elapsed Time */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <FiZap className="text-4xl opacity-80" />
                <div className="bg-white/20 rounded-full px-3 py-1 text-sm font-semibold">
                  Elapsed
                </div>
              </div>
              <p className="text-3xl font-bold mb-2">
                {formatDuration(statistics.totalElapsedTime)}
              </p>
              <p className="text-green-100 text-sm">Total Elapsed Time</p>
            </div>

            {/* Completion Status */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <FiCheckCircle className="text-4xl opacity-80" />
                <div className="bg-white/20 rounded-full px-3 py-1 text-sm font-semibold">
                  Status
                </div>
              </div>
              <p className="text-3xl font-bold mb-2">
                {statistics.completedCount || 0} / {logs.length}
              </p>
              <p className="text-orange-100 text-sm">
                Completed Chunks
                {statistics.failedCount > 0 && (
                  <span className="ml-2 bg-red-500/30 px-2 py-0.5 rounded-full text-xs">
                    {statistics.failedCount} Failed
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Timeline View */}
          {statistics.firstStartTime && statistics.lastEndTime && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <FiClock className="text-blue-500" />
                Processing Timeline
              </h3>
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Start Time</span>
                  <span className="text-lg font-semibold text-gray-800 dark:text-white">
                    {formatTime(statistics.firstStartTime)}
                  </span>
                </div>
                <div className="flex-1 mx-8">
                  <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse`}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-sm text-gray-500 dark:text-gray-400">End Time</span>
                  <span className="text-lg font-semibold text-gray-800 dark:text-white">
                    {formatTime(statistics.lastEndTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Chart */}
          {logs.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                <FiBarChart2 className="text-purple-500" />
                Processing Time Distribution
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={logs.filter(log => log.duration)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis 
                    dataKey="chunkNumber" 
                    stroke="#9CA3AF"
                    label={{ value: 'Chunk Number', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tickFormatter={(value) => `${(value / 1000).toFixed(1)}s`}
                    label={{ value: 'Duration', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none', 
                      borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                    }}
                    labelStyle={{ color: '#F3F4F6' }}
                    formatter={(value) => [formatDuration(value), 'Duration']}
                  />
                  <Bar 
                    dataKey="duration" 
                    fill="url(#colorGradient)" 
                    radius={[8, 8, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed Logs Table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FiPackage className="text-green-500" />
                Detailed Chunk Logs
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Chunk
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Start Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      End Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((log, index) => (
                    <tr 
                      key={log.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                            {log.chunkNumber}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {formatTime(log.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {formatTime(log.endTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                          <FiClock className="mr-2" />
                          {formatDuration(log.duration)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            <FiCheckCircle className="mr-2" />
                            Completed
                          </span>
                        ) : log.status === 'FAILED' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                            <FiXCircle className="mr-2" />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
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

          {/* Error Messages Section */}
          {logs.some(log => log.errorMessage) && (
            <div className="mt-8 bg-red-50 dark:bg-red-900/20 rounded-2xl shadow-xl p-6">
              <h3 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4 flex items-center gap-2">
                <FiAlertTriangle className="text-red-500" />
                Error Details
              </h3>
              <div className="space-y-3">
                {logs.filter(log => log.errorMessage).map(log => (
                  <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-800 dark:text-white">
                        Chunk {log.chunkNumber}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        at {formatTime(log.endTime)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
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
