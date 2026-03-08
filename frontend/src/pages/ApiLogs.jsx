import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";

// icons
const Icon = ({ d, className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const ICONS = {
  refresh: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  download: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  filter: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  close: "M6 18L18 6M6 6l12 12",
  globe: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  ban: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
};

function formatDate(ds) {
  if (!ds) return "—";
  return new Date(ds).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function methodColor(m) {
  return m === "GET"    ? "bg-sky-100 text-sky-700 ring-sky-200"
       : m === "POST"   ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
       : m === "PUT"    ? "bg-amber-100 text-amber-700 ring-amber-200"
       : m === "DELETE" ? "bg-rose-100 text-rose-700 ring-rose-200"
       : m === "PATCH"  ? "bg-violet-100 text-violet-700 ring-violet-200"
       : "bg-gray-100 text-gray-700 ring-gray-200";
}

function statusColor(s) {
  if (!s) return "bg-gray-100 text-gray-500";
  if (s >= 200 && s < 300) return "bg-emerald-100 text-emerald-700";
  if (s >= 300 && s < 400) return "bg-amber-100 text-amber-700";
  if (s >= 400 && s < 500) return "bg-rose-100 text-rose-700";
  return "bg-red-200 text-red-800";
}

function responseTimeColor(ms) {
  if (!ms) return "text-gray-400";
  if (ms < 100) return "text-emerald-600";
  if (ms < 500) return "text-amber-600";
  return "text-rose-600";
}

function isInvalidToken(log) {
  return log.responseStatus === 401 || log.responseStatus === 403;
}

export default function ApiLogs({ userEmail }) {
  const [logs, setLogs]             = useState([]);
  const [stats, setStats]           = useState({ totalLogs: 0, errorLogs: 0 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [page, setPage]             = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [activeTab, setActiveTab]   = useState("all");

  const [filters, setFilters] = useState({
    email: "", ip: "", path: "", method: "",
    statusCode: "", dateFrom: "", dateTo: "", searchTerm: ""
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedLog, setSelectedLog]   = useState(null);
  const [viewMode, setViewMode]         = useState("table");
  const [sortBy, setSortBy]             = useState("requestTime");
  const [sortOrder, setSortOrder]       = useState("desc");
  const [autoRefresh, setAutoRefresh]   = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const refreshTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (userEmail !== "admin") navigate("/");
  }, [userEmail, navigate]);

  useEffect(() => {
    if (autoRefresh) {
      refreshTimer.current = setInterval(() => { fetchLogs(); fetchStats(); }, refreshInterval * 1000);
    }
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [autoRefresh, refreshInterval, page, filters, sortBy, sortOrder]);

  useEffect(() => { fetchLogs(); fetchStats(); }, [page, sortBy, sortOrder]);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/admin/logs?page=${page}&size=50`;
      if (filters.email)      url += `&email=${encodeURIComponent(filters.email)}`;
      if (filters.ip)         url += `&ip=${encodeURIComponent(filters.ip)}`;
      if (filters.path)       url += `&path=${encodeURIComponent(filters.path)}`;
      if (filters.method)     url += `&method=${encodeURIComponent(filters.method)}`;
      if (filters.statusCode) url += `&status=${encodeURIComponent(filters.statusCode)}`;
      if (filters.dateFrom)   url += `&dateFrom=${encodeURIComponent(filters.dateFrom)}`;
      if (filters.dateTo)     url += `&dateTo=${encodeURIComponent(filters.dateTo)}`;
      url += `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");

      const data = await res.json();
      let fetched = data.content || [];

      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        fetched = fetched.filter(l =>
          l.requestPath?.toLowerCase().includes(term)    ||
          l.extractedEmail?.toLowerCase().includes(term) ||
          l.requestIp?.toLowerCase().includes(term)      ||
          l.requestMethod?.toLowerCase().includes(term)
        );
      }
      setLogs(fetched);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/admin/logs/stats", { credentials: "include" });
      if (res.ok) setStats(await res.json());
    } catch (e) { /* silent */ }
  }

  const authenticatedLogs = useMemo(
    () => logs.filter(l => l.extractedEmail && l.extractedEmail.trim()),
    [logs]
  );
  const anonymousLogs = useMemo(
    () => logs.filter(l => !l.extractedEmail || !l.extractedEmail.trim()),
    [logs]
  );
  const invalidLogs = useMemo(
    () => logs.filter(l => isInvalidToken(l)),
    [logs]
  );

  const displayedLogs = useMemo(() => {
    switch (activeTab) {
      case "authenticated": return authenticatedLogs;
      case "anonymous":     return anonymousLogs;
      case "invalid":       return invalidLogs;
      default:              return logs;
    }
  }, [activeTab, logs, authenticatedLogs, anonymousLogs, invalidLogs]);

  function handleFilterChange(f, v) { setFilters(p => ({ ...p, [f]: v })); }
  function handleApplyFilters() { setPage(0); fetchLogs(); }
  function handleClearFilters() {
    setFilters({ email: "", ip: "", path: "", method: "", statusCode: "", dateFrom: "", dateTo: "", searchTerm: "" });
    setPage(0);
  }
  function handleSort(f) {
    if (sortBy === f) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortBy(f); setSortOrder("desc"); }
  }

  function exportToCSV() {
    const headers = ["Time", "Method", "Path", "Status", "IP", "Email", "Response Time", "Token Status"];
    const rows = displayedLogs.map(l => [
      formatDate(l.requestTime),
      l.requestMethod,
      l.requestPath,
      l.responseStatus || "N/A",
      l.requestIp || "N/A",
      l.extractedEmail || "Anonymous",
      l.responseTime ? `${l.responseTime}ms` : "-",
      isInvalidToken(l) ? "INVALID/EXPIRED" : "OK"
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `api-logs-${activeTab}-${new Date().toISOString()}.csv`;
    a.click();
  }

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  const TABS = [
    { id: "all",           label: "All Requests",    icon: ICONS.chart,   count: logs.length,             color: "blue",    desc: "Every API call logged" },
    { id: "authenticated", label: "With Email",       icon: ICONS.mail,    count: authenticatedLogs.length, color: "emerald", desc: "Requests from identified users" },
    { id: "anonymous",     label: "Anonymous",        icon: ICONS.user,    count: anonymousLogs.length,     color: "amber",   desc: "Requests without user identity" },
    { id: "invalid",       label: "Invalid / Expired",icon: ICONS.ban,     count: invalidLogs.length,       color: "rose",    desc: "401/403 — token invalid or expired" },
  ];

  const TAB_COLOR_MAP = {
    blue:    { active: "bg-blue-600 text-white shadow-blue-200",     inactive: "text-blue-600 hover:bg-blue-50",     badge: "bg-blue-100 text-blue-700" },
    emerald: { active: "bg-emerald-600 text-white shadow-emerald-200",inactive: "text-emerald-700 hover:bg-emerald-50",badge: "bg-emerald-100 text-emerald-700" },
    amber:   { active: "bg-amber-500 text-white shadow-amber-200",   inactive: "text-amber-700 hover:bg-amber-50",   badge: "bg-amber-100 text-amber-700" },
    rose:    { active: "bg-rose-600 text-white shadow-rose-200",     inactive: "text-rose-600 hover:bg-rose-50",     badge: "bg-rose-100 text-rose-700" },
  };

  const statCards = [
    { label: "Total Requests",    value: stats.totalLogs,              icon: ICONS.chart,   border: "border-blue-400",    bg: "bg-blue-50",    iconColor: "text-blue-500" },
    { label: "Error Requests",    value: stats.errorLogs,              icon: ICONS.warning, border: "border-rose-400",    bg: "bg-rose-50",    iconColor: "text-rose-500" },
    { label: "With Email",        value: authenticatedLogs.length,     icon: ICONS.mail,    border: "border-emerald-400", bg: "bg-emerald-50", iconColor: "text-emerald-500" },
    { label: "Anonymous",         value: anonymousLogs.length,         icon: ICONS.user,    border: "border-amber-400",   bg: "bg-amber-50",   iconColor: "text-amber-500" },
    { label: "Invalid / Expired", value: invalidLogs.length,           icon: ICONS.ban,     border: "border-rose-500",    bg: "bg-rose-50",    iconColor: "text-rose-600" },
    { label: "Success Rate",
      value: stats.totalLogs > 0 ? `${((stats.totalLogs - stats.errorLogs) / stats.totalLogs * 100).toFixed(1)}%` : "—",
      icon: ICONS.shield, border: "border-teal-400", bg: "bg-teal-50", iconColor: "text-teal-500" },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1700px] mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
                  <Icon d={ICONS.lock} className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-slate-800 via-blue-700 to-indigo-700 bg-clip-text text-transparent">
                  API Logs Analytics
                </h1>
              </div>
              <p className="text-sm text-slate-500 ml-1">Real-time monitoring · Security tracking · User activity</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-200 cursor-pointer select-none text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                Auto-refresh
                {autoRefresh && (
                  <select
                    value={refreshInterval}
                    onChange={e => setRefreshInterval(Number(e.target.value))}
                    className="ml-1 text-xs border border-gray-300 rounded-lg px-1 py-0.5 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>1m</option>
                  </select>
                )}
              </label>

              <button
                onClick={exportToCSV}
                disabled={displayedLogs.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon d={ICONS.download} className="w-4 h-4" />
                Export CSV
              </button>

              <button
                onClick={() => { fetchLogs(); fetchStats(); }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 text-sm font-semibold transition"
              >
                <Icon d={ICONS.refresh} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {statCards.map(({ label, value, icon, border, bg, iconColor }) => (
              <div key={label} className={`bg-white rounded-2xl shadow-sm border-l-4 ${border} p-4 hover:shadow-md transition-shadow`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
                  <div className={`${bg} rounded-xl p-1.5`}>
                    <Icon d={icon} className={`w-4 h-4 ${iconColor}`} />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-slate-800">{typeof value === "number" ? value.toLocaleString() : value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex flex-wrap gap-1">
            {TABS.map(tab => {
              const colors = TAB_COLOR_MAP[tab.color];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-1 min-w-[130px] justify-center
                    ${isActive ? `${colors.active} shadow-md` : `text-gray-500 ${colors.inactive}`}`}
                >
                  <Icon d={tab.icon} className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ml-1 ${isActive ? "bg-white/25 text-white" : colors.badge}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab contextual banner */}
          {activeTab === "invalid" && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.warning} className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-800">Invalid / Expired Token Requests</p>
                <p className="text-xs text-rose-600 mt-0.5">
                  These requests returned <strong>401 Unauthorized</strong> or <strong>403 Forbidden</strong>.
                  When an email is visible, it means that user&apos;s session token was no longer valid at the time of the request.
                </p>
              </div>
            </div>
          )}
          {activeTab === "authenticated" && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.mail} className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Authenticated Requests</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Requests where a user email was successfully extracted from the session or JWT token.
                </p>
              </div>
            </div>
          )}
          {activeTab === "anonymous" && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.user} className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Anonymous Requests</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Requests with no user identity — unauthenticated calls, public endpoints, or requests with missing tokens.
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-700 to-slate-800">
              <div className="flex items-center gap-2">
                <Icon d={ICONS.filter} className="w-4 h-4 text-slate-300" />
                <span className="text-sm font-semibold text-white">Filters &amp; Search</span>
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                    {activeFiltersCount} active
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAdvancedFilters(p => !p)}
                className="text-slate-300 hover:text-white text-xs font-medium transition"
              >
                {showAdvancedFilters ? "Hide advanced ↑" : "Show advanced ↓"}
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="relative">
                <Icon d={ICONS.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={e => handleFilterChange("searchTerm", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleApplyFilters()}
                  placeholder="Quick search: path, email, IP, method…"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              {showAdvancedFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
                  {[
                    { field: "email", label: "Email",      placeholder: "user@example.com" },
                    { field: "ip",    label: "IP Address", placeholder: "192.168.x.x" },
                    { field: "path",  label: "API Path",   placeholder: "/api/auth" },
                  ].map(({ field, label, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
                      <input
                        type="text"
                        value={filters[field]}
                        onChange={e => handleFilterChange(field, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">HTTP Method</label>
                    <select
                      value={filters.method}
                      onChange={e => handleFilterChange("method", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    >
                      <option value="">All Methods</option>
                      {["GET","POST","PUT","DELETE","PATCH"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Status Code</label>
                    <select
                      value={filters.statusCode}
                      onChange={e => handleFilterChange("statusCode", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    >
                      <option value="">All Statuses</option>
                      {[["200","200 – OK"],["201","201 – Created"],["400","400 – Bad Request"],
                        ["401","401 – Unauthorized"],["403","403 – Forbidden"],
                        ["404","404 – Not Found"],["500","500 – Server Error"]
                      ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Date Range</label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={filters.dateFrom} onChange={e => handleFilterChange("dateFrom", e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                      <span className="text-gray-400 text-xs">to</span>
                      <input type="date" value={filters.dateTo} onChange={e => handleFilterChange("dateTo", e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleApplyFilters}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition"
                >
                  <Icon d={ICONS.search} className="w-4 h-4" /> Apply
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex items-center gap-2 px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
                >
                  <Icon d={ICONS.close} className="w-4 h-4" /> Clear
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
              <Icon d={ICONS.warning} className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <p className="text-sm font-medium text-rose-700">{error}</p>
            </div>
          )}

          {/* View mode + count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm p-1">
              {[["table","Table"],["cards","Cards"],["compact","Compact"]].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                    viewMode === mode ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              Showing <span className="font-bold text-slate-800">{displayedLogs.length}</span>
              {activeTab !== "all" && (
                <span className="text-xs text-gray-400 ml-1">
                  ({TABS.find(t => t.id === activeTab)?.label})
                </span>
              )}
            </p>
          </div>

          {/* Logs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <svg className="animate-spin w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-500 font-medium">Loading logs…</p>
              </div>
            ) : displayedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <Icon d={ICONS.info} className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-semibold text-lg">No logs found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filters or switching tabs</p>
              </div>
            ) : viewMode === "table" ? (
              <TableView logs={displayedLogs} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} onSelect={setSelectedLog} activeTab={activeTab} />
            ) : viewMode === "cards" ? (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedLogs.map(log => <LogCard key={log.logId} log={log} onSelect={setSelectedLog} />)}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayedLogs.map(log => <CompactRow key={log.logId} log={log} onSelect={setSelectedLog} />)}
              </div>
            )}

            {!loading && displayedLogs.length > 0 && totalPages > 1 && (
              <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-between bg-gray-50/60">
                <p className="text-sm text-gray-600">
                  Page <span className="font-bold text-blue-600">{page + 1}</span> / <span className="font-bold text-blue-600">{totalPages}</span>
                </p>
                <div className="flex gap-1.5">
                  {[
                    ["First",   () => setPage(0),                              page === 0],
                    ["← Prev",  () => setPage(p => Math.max(0, p - 1)),        page === 0],
                    ["Next →",  () => setPage(p => Math.min(totalPages-1,p+1)),page >= totalPages-1],
                    ["Last",    () => setPage(totalPages - 1),                 page >= totalPages-1],
                  ].map(([label, handler, disabled]) => (
                    <button key={label} onClick={handler} disabled={disabled}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </Layout>
  );
}

function TableView({ logs, sortBy, sortOrder, onSort, onSelect, activeTab }) {
  const SortIcon = ({ field }) => sortBy === field ? (
    <span className="text-blue-500 font-bold text-base"> {sortOrder === "asc" ? "↑" : "↓"}</span>
  ) : null;

  const Th = ({ field, children }) => (
    <th
      onClick={() => field && onSort(field)}
      className={`px-4 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap
        ${field ? "cursor-pointer hover:bg-gray-100 select-none" : ""}`}
    >
      {children}{field && <SortIcon field={field} />}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
          <tr>
            <Th field="requestTime">Time</Th>
            <Th>Method</Th>
            <Th>Path</Th>
            <Th field="responseStatus">Status</Th>
            <Th>IP Address</Th>
            <Th>Email</Th>
            {activeTab === "invalid" && <Th>Token Status</Th>}
            <Th field="responseTime">Resp. Time</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map(log => (
            <tr key={log.logId} className={`hover:bg-blue-50/50 transition-colors ${isInvalidToken(log) ? "bg-rose-50/20" : ""}`}>
              <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap font-medium">{formatDate(log.requestTime)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ring-1 ${methodColor(log.requestMethod)}`}>{log.requestMethod}</span>
              </td>
              <td className="px-4 py-3 max-w-xs">
                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded truncate block">{log.requestPath}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusColor(log.responseStatus)}`}>{log.responseStatus || "—"}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-700">{log.requestIp || "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {log.extractedEmail ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon d={ICONS.user} className="w-3 h-3 text-blue-600" />
                    </div>
                    <span className="text-xs text-slate-800 font-medium max-w-[180px] truncate">{log.extractedEmail}</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">Anonymous</span>
                )}
              </td>
              {activeTab === "invalid" && (
                <td className="px-4 py-3 whitespace-nowrap">
                  {isInvalidToken(log) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">
                      <Icon d={ICONS.ban} className="w-3 h-3" />
                      {log.responseStatus === 401 ? "Expired/Invalid" : "Forbidden"}
                    </span>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
              )}
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`text-xs font-bold ${responseTimeColor(log.responseTime)}`}>
                  {log.responseTime ? `${log.responseTime}ms` : "—"}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <button onClick={() => onSelect(log)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogCard({ log, onSelect }) {
  const invalid = isInvalidToken(log);
  return (
    <div
      onClick={() => onSelect(log)}
      className={`rounded-2xl border-2 p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5
        ${invalid ? "border-rose-200 bg-rose-50/40 hover:border-rose-400" : "border-gray-100 bg-white hover:border-blue-300"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ring-1 ${methodColor(log.requestMethod)}`}>{log.requestMethod}</span>
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusColor(log.responseStatus)}`}>{log.responseStatus || "—"}</span>
      </div>
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
        <p className="text-xs font-mono text-slate-700 truncate">{log.requestPath}</p>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Icon d={ICONS.globe} className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="font-mono text-gray-600">{log.requestIp || "—"}</span>
        </div>
        {log.extractedEmail ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Icon d={ICONS.user} className="w-3 h-3 text-blue-600" />
            </div>
            <span className="text-slate-700 font-medium truncate">{log.extractedEmail}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon d={ICONS.user} className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            <span className="text-gray-400 italic">Anonymous</span>
          </div>
        )}
        {invalid && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-200">
            <Icon d={ICONS.ban} className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span className="text-rose-600 font-semibold">
              {log.responseStatus === 401 ? "Token expired / invalid" : "Access forbidden"}
              {log.extractedEmail && ` — ${log.extractedEmail}`}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-gray-400 text-xs">{formatDate(log.requestTime)}</span>
        <span className={`text-xs font-bold ${responseTimeColor(log.responseTime)}`}>
          {log.responseTime ? `${log.responseTime}ms` : "—"}
        </span>
      </div>
    </div>
  );
}

function CompactRow({ log, onSelect }) {
  const invalid = isInvalidToken(log);
  return (
    <div
      onClick={() => onSelect(log)}
      className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors
        ${invalid ? "hover:bg-rose-50 bg-rose-50/30" : "hover:bg-blue-50/50"}`}
    >
      <span className={`px-2 py-0.5 text-xs font-bold rounded ring-1 flex-shrink-0 ${methodColor(log.requestMethod)}`}>{log.requestMethod}</span>
      <span className="text-xs font-mono text-slate-700 flex-1 truncate">{log.requestPath}</span>
      {log.extractedEmail && (
        <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full hidden sm:block max-w-[180px] truncate">{log.extractedEmail}</span>
      )}
      {invalid && (
        <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full flex-shrink-0">
          {log.responseStatus === 401 ? "EXPIRED" : "FORBIDDEN"}
        </span>
      )}
      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full flex-shrink-0 ${statusColor(log.responseStatus)}`}>{log.responseStatus || "—"}</span>
      <span className="text-gray-400 text-xs flex-shrink-0 hidden md:block">{formatDate(log.requestTime)}</span>
    </div>
  );
}

function LogDetailModal({ log, onClose }) {
  const invalid = isInvalidToken(log);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className={`px-6 py-5 flex items-center justify-between flex-shrink-0 ${invalid ? "bg-gradient-to-r from-rose-600 to-red-600" : "bg-gradient-to-r from-blue-600 to-indigo-600"}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Icon d={invalid ? ICONS.warning : ICONS.info} className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Request Details</h3>
              {invalid && <p className="text-xs text-white/80 mt-0.5">{log.responseStatus === 401 ? "Token expired or invalid" : "Access was forbidden"}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <Icon d={ICONS.close} className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {invalid && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Icon d={ICONS.ban} className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-rose-800">
                    {log.responseStatus === 401 ? "Authentication Failed — Invalid or Expired Token" : "Authorization Failed — Access Forbidden"}
                  </p>
                  {log.extractedEmail ? (
                    <p className="text-xs text-rose-600 mt-1">
                      Email: <span className="font-bold">{log.extractedEmail}</span> — session token was no longer valid.
                    </p>
                  ) : (
                    <p className="text-xs text-rose-600 mt-1">No user identity was extracted from this request.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">HTTP Method</p>
              <span className={`px-3 py-1.5 text-sm font-bold rounded-full ring-1 ${methodColor(log.requestMethod)}`}>{log.requestMethod}</span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Status Code</p>
              <span className={`px-3 py-1.5 text-sm font-bold rounded-full ${statusColor(log.responseStatus)}`}>{log.responseStatus || "—"}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Request Path</p>
            <div className="bg-slate-900 rounded-xl px-4 py-3">
              <p className="font-mono text-sm text-green-400 break-all">{log.requestPath}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">User Identity</p>
            <div className="bg-slate-50 rounded-2xl p-4">
              {log.extractedEmail ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Icon d={ICONS.user} className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{log.extractedEmail}</p>
                    {invalid && <p className="text-xs text-rose-500 mt-0.5 font-semibold">Token was invalid/expired at request time</p>}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Icon d={ICONS.user} className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500">Anonymous</p>
                    <p className="text-xs text-gray-400 mt-0.5">No user identity extracted</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">IP Address</p>
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-2">
                <Icon d={ICONS.globe} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <p className="font-mono text-sm text-slate-800">{log.requestIp || "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Response Time</p>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className={`text-2xl font-extrabold ${responseTimeColor(log.responseTime)}`}>
                  {log.responseTime ? `${log.responseTime}ms` : "—"}
                </p>
                {log.responseTime && <p className="text-xs text-gray-400 mt-1">{log.responseTime < 100 ? "Excellent" : log.responseTime < 500 ? "Acceptable" : "Slow"}</p>}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Timestamp</p>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm text-slate-700 font-medium">{formatDate(log.requestTime)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Log ID</p>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="font-mono text-xs text-gray-500 break-all">{log.logId}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
