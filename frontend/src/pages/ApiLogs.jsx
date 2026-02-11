import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

export default function ApiLogs({ userEmail }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalLogs: 0, errorLogs: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Advanced filtering state
  const [filters, setFilters] = useState({
    email: "",
    ip: "",
    path: "",
    method: "",
    statusCode: "",
    dateFrom: "",
    dateTo: "",
    searchTerm: ""
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // table, cards, compact
  const [sortBy, setSortBy] = useState("requestTime");
  const [sortOrder, setSortOrder] = useState("desc");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const refreshTimer = useRef(null);
  
  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    if (userEmail !== "admin") {
      navigate("/");
    }
  }, [userEmail, navigate]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      refreshTimer.current = setInterval(() => {
        fetchLogs();
        fetchStats();
      }, refreshInterval * 1000);
    }
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [autoRefresh, refreshInterval, page, filters, sortBy, sortOrder]);

  // Fetch logs
  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, sortBy, sortOrder]);

  async function fetchLogs() {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/admin/logs?page=${page}&size=50`;
      
      // Apply all active filters
      if (filters.email) url += `&email=${encodeURIComponent(filters.email)}`;
      if (filters.ip) url += `&ip=${encodeURIComponent(filters.ip)}`;
      if (filters.path) url += `&path=${encodeURIComponent(filters.path)}`;
      if (filters.method) url += `&method=${encodeURIComponent(filters.method)}`;
      if (filters.statusCode) url += `&status=${encodeURIComponent(filters.statusCode)}`;
      if (filters.dateFrom) url += `&dateFrom=${encodeURIComponent(filters.dateFrom)}`;
      if (filters.dateTo) url += `&dateTo=${encodeURIComponent(filters.dateTo)}`;
      
      // Add sorting
      url += `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch logs");
      }

      const data = await res.json();
      let fetchedLogs = data.content || [];
      
      // Client-side search if searchTerm exists
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        fetchedLogs = fetchedLogs.filter(log => 
          log.requestPath?.toLowerCase().includes(term) ||
          log.extractedEmail?.toLowerCase().includes(term) ||
          log.requestIp?.toLowerCase().includes(term) ||
          log.requestMethod?.toLowerCase().includes(term)
        );
      }
      
      setLogs(fetchedLogs);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/admin/logs/stats", {
        method: "GET",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }

  function handleFilterChange(field, value) {
    setFilters(prev => ({ ...prev, [field]: value }));
  }

  function handleApplyFilters() {
    setPage(0);
    fetchLogs();
  }

  function handleClearFilters() {
    setFilters({
      email: "",
      ip: "",
      path: "",
      method: "",
      statusCode: "",
      dateFrom: "",
      dateTo: "",
      searchTerm: ""
    });
    setPage(0);
  }

  function handleSort(field) {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  }

  function exportToCSV() {
    const headers = ["Time", "Method", "Path", "Status", "IP", "Email", "Response Time"];
    const rows = logs.map(log => [
      formatDate(log.requestTime),
      log.requestMethod,
      log.requestPath,
      log.responseStatus || "N/A",
      log.requestIp || "N/A",
      log.extractedEmail || "-",
      log.responseTime ? `${log.responseTime}ms` : "-"
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  function getStatusColor(status) {
    if (status >= 200 && status < 300) return "text-green-600 bg-green-100";
    if (status >= 300 && status < 400) return "text-yellow-600 bg-yellow-100";
    if (status >= 400 && status < 500) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1600px] mx-auto">
          {/* Modern Header with Actions */}
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  API Logs Analytics
                </h1>
                <p className="text-gray-600 flex items-center gap-2">
                  <span className="inline-flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Real-time monitoring and security tracking
                  </span>
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Auto-refresh Toggle */}
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                  <input
                    type="checkbox"
                    id="autoRefresh"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="autoRefresh" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Auto-refresh
                  </label>
                  {autoRefresh && (
                    <select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="ml-2 text-xs border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={5}>5s</option>
                      <option value={10}>10s</option>
                      <option value={30}>30s</option>
                      <option value={60}>1m</option>
                    </select>
                  )}
                </div>

                {/* Export Button */}
                <button
                  onClick={exportToCSV}
                  disabled={logs.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>

                {/* Refresh Button */}
                <button
                  onClick={() => { fetchLogs(); fetchStats(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
                >
                  <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Requests</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalLogs.toLocaleString()}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Error Requests</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.errorLogs.toLocaleString()}</p>
                </div>
                <div className="bg-red-100 rounded-full p-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Success Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.totalLogs > 0
                      ? ((stats.totalLogs - stats.errorLogs) / stats.totalLogs * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Unique IPs</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {new Set(logs.map(l => l.requestIp)).size}
                  </p>
                </div>
                <div className="bg-indigo-100 rounded-full p-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Search and Filters */}
          <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Smart Filters
                </h2>
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="text-white hover:text-blue-100 transition-colors text-sm font-medium"
                >
                  {showAdvancedFilters ? "Hide Advanced" : "Show Advanced"}
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Quick Search */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
                    placeholder="🔍 Quick search across all fields (path, email, IP, method)..."
                    className="w-full px-4 py-3 pl-12 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">📧 Email</label>
                    <input
                      type="text"
                      value={filters.email}
                      onChange={(e) => handleFilterChange("email", e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">🌐 IP Address</label>
                    <input
                      type="text"
                      value={filters.ip}
                      onChange={(e) => handleFilterChange("ip", e.target.value)}
                      placeholder="192.168.1.1"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">🔗 API Path</label>
                    <input
                      type="text"
                      value={filters.path}
                      onChange={(e) => handleFilterChange("path", e.target.value)}
                      placeholder="/api/auth"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">⚡ Method</label>
                    <select
                      value={filters.method}
                      onChange={(e) => handleFilterChange("method", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Methods</option>
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">📊 Status Code</label>
                    <select
                      value={filters.statusCode}
                      onChange={(e) => handleFilterChange("statusCode", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="200">200 - OK</option>
                      <option value="201">201 - Created</option>
                      <option value="400">400 - Bad Request</option>
                      <option value="401">401 - Unauthorized</option>
                      <option value="403">403 - Forbidden</option>
                      <option value="404">404 - Not Found</option>
                      <option value="500">500 - Server Error</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">📅 Date Range</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                        className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-500 self-center">to</span>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                        className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Filter Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleApplyFilters}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Apply Filters
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear All
                </button>
                
                {/* Active Filters Count */}
                {Object.values(filters).filter(v => v).length > 0 && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {Object.values(filters).filter(v => v).length} active filter(s)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl bg-red-50 p-4 mb-6 border-l-4 border-red-500 shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* View Mode Selector */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">View Mode:</span>
              <div className="inline-flex rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === "table"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  📋 Table
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-4 py-2 text-sm font-medium border-l transition-colors ${
                    viewMode === "cards"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  🗂️ Cards
                </button>
                <button
                  onClick={() => setViewMode("compact")}
                  className={`px-4 py-2 text-sm font-medium border-l transition-colors ${
                    viewMode === "compact"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  📝 Compact
                </button>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{logs.length}</span> entries
            </div>
          </div>

          {/* Logs Display */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex flex-col justify-center items-center p-16">
                <svg
                  className="animate-spin h-12 w-12 text-blue-600 mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="text-gray-600 font-medium">Loading logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 font-medium text-lg">No logs found</p>
                <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th 
                        onClick={() => handleSort("requestTime")}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Time
                          {sortBy === "requestTime" && (
                            <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Path
                      </th>
                      <th 
                        onClick={() => handleSort("responseStatus")}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {sortBy === "responseStatus" && (
                            <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        IP Address
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Email
                      </th>
                      <th 
                        onClick={() => handleSort("responseTime")}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Response Time
                          {sortBy === "responseTime" && (
                            <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log, index) => (
                      <tr 
                        key={log.logId} 
                        className="hover:bg-blue-50 transition-colors cursor-pointer"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatDate(log.requestTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                            log.requestMethod === "GET" ? "bg-blue-100 text-blue-700" :
                            log.requestMethod === "POST" ? "bg-green-100 text-green-700" :
                            log.requestMethod === "PUT" ? "bg-yellow-100 text-yellow-700" :
                            log.requestMethod === "DELETE" ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {log.requestMethod}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                          <div className="truncate font-mono text-xs bg-gray-50 px-2 py-1 rounded">
                            {log.requestPath}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(
                              log.responseStatus
                            )}`}
                          >
                            {log.responseStatus || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            <span className="text-sm text-gray-900 font-mono">
                              {log.requestIp || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {log.extractedEmail ? (
                              <>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-sm text-gray-900">{log.extractedEmail}</span>
                              </>
                            ) : (
                              <span className="text-sm text-gray-400">Anonymous</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-semibold ${
                            log.responseTime < 100 ? "text-green-600" :
                            log.responseTime < 500 ? "text-yellow-600" :
                            "text-red-600"
                          }`}>
                            {log.responseTime ? `${log.responseTime}ms` : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : viewMode === "cards" ? (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {logs.map((log, index) => (
                  <div
                    key={log.logId}
                    className="bg-gradient-to-br from-white to-gray-50 rounded-lg p-5 border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        log.requestMethod === "GET" ? "bg-blue-100 text-blue-700" :
                        log.requestMethod === "POST" ? "bg-green-100 text-green-700" :
                        log.requestMethod === "PUT" ? "bg-yellow-100 text-yellow-700" :
                        log.requestMethod === "DELETE" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {log.requestMethod}
                      </span>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(
                          log.responseStatus
                        )}`}
                      >
                        {log.responseStatus || "N/A"}
                      </span>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Path</p>
                      <p className="text-sm font-mono font-semibold text-gray-900 truncate bg-gray-100 px-2 py-1 rounded">
                        {log.requestPath}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500 mb-1">IP Address</p>
                        <p className="font-mono font-semibold text-gray-900">{log.requestIp || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Response Time</p>
                        <p className={`font-semibold ${
                          log.responseTime < 100 ? "text-green-600" :
                          log.responseTime < 500 ? "text-yellow-600" :
                          "text-red-600"
                        }`}>
                          {log.responseTime ? `${log.responseTime}ms` : "-"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        {formatDate(log.requestTime)}
                      </p>
                      {log.extractedEmail && (
                        <p className="text-xs text-gray-700 font-medium mt-1">
                          👤 {log.extractedEmail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {logs.map((log, index) => (
                  <div
                    key={log.logId}
                    className="px-6 py-4 hover:bg-blue-50 transition-colors cursor-pointer flex items-center justify-between"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className={`px-2 py-1 text-xs font-bold rounded ${
                        log.requestMethod === "GET" ? "bg-blue-100 text-blue-700" :
                        log.requestMethod === "POST" ? "bg-green-100 text-green-700" :
                        log.requestMethod === "PUT" ? "bg-yellow-100 text-yellow-700" :
                        log.requestMethod === "DELETE" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {log.requestMethod}
                      </span>
                      <span className="text-sm font-mono text-gray-900 flex-1">{log.requestPath}</span>
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded ${getStatusColor(
                          log.responseStatus
                        )}`}
                      >
                        {log.responseStatus}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(log.requestTime)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Enhanced Pagination */}
            {!loading && logs.length > 0 && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex items-center justify-between border-t-2 border-gray-200">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-700">
                    Page <span className="font-bold text-blue-600">{page + 1}</span> of{" "}
                    <span className="font-bold text-blue-600">{totalPages}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Log Detail Modal */}
          {selectedLog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLog(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                  <h3 className="text-xl font-bold text-white">Request Details</h3>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Method</p>
                      <span className={`px-3 py-1 text-sm font-bold rounded-full inline-block ${
                        selectedLog.requestMethod === "GET" ? "bg-blue-100 text-blue-700" :
                        selectedLog.requestMethod === "POST" ? "bg-green-100 text-green-700" :
                        selectedLog.requestMethod === "PUT" ? "bg-yellow-100 text-yellow-700" :
                        selectedLog.requestMethod === "DELETE" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {selectedLog.requestMethod}
                      </span>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Status Code</p>
                      <span className={`px-3 py-1 text-sm font-bold rounded-full inline-block ${getStatusColor(selectedLog.responseStatus)}`}>
                        {selectedLog.responseStatus || "N/A"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Request Path</p>
                    <p className="font-mono text-sm bg-white px-3 py-2 rounded border border-gray-200">{selectedLog.requestPath}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">IP Address</p>
                      <p className="font-mono text-sm">{selectedLog.requestIp || "N/A"}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Response Time</p>
                      <p className={`font-semibold text-sm ${
                        selectedLog.responseTime < 100 ? "text-green-600" :
                        selectedLog.responseTime < 500 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {selectedLog.responseTime ? `${selectedLog.responseTime}ms` : "-"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">User Email</p>
                    <p className="text-sm">{selectedLog.extractedEmail || "Anonymous"}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Timestamp</p>
                    <p className="text-sm">{formatDate(selectedLog.requestTime)}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Log ID</p>
                    <p className="font-mono text-xs text-gray-600">{selectedLog.logId}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
