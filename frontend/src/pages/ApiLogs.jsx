import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { deleteApiLogs } from "../utils/api";
import { timezoneUtils } from "../utils/timezoneUtils";

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
  if (!ds) return "�";
  return timezoneUtils.formatDateTime(ds);
}

function methodColor(m) {
  return m === "GET"    ? "bg-glacier text-brand-dark ring-brand/20"
       : m === "POST"   ? "bg-sage-soft text-sage ring-sage/20"
       : m === "PUT"    ? "bg-ceremonial-soft text-ink ring-amber-200"
       : m === "DELETE" ? "bg-rose-100 text-ember ring-rose-200"
       : m === "PATCH"  ? "bg-frost text-ink ring-ink/10"
       : "bg-frost text-dusk ring-ink/10";
}

function statusColor(s) {
  if (!s) return "bg-frost text-dusk";
  if (s >= 200 && s < 300) return "bg-sage-soft text-aurora-muted";
  if (s >= 300 && s < 400) return "bg-ceremonial-soft text-ink";
  if (s >= 400 && s < 500) return "bg-rose-100 text-ember";
  return "bg-red-200 text-ember";
}

function responseTimeColor(ms) {
  if (!ms) return "text-dusk";
  if (ms < 100) return "text-aurora-muted";
  if (ms < 500) return "text-ink";
  return "text-ember";
}

function isInvalidToken(log) {
  return log.responseStatus === 401 || log.responseStatus === 403;
}

const SERVER_VIEW_TABS = new Set(["unique-email", "unique-ip", "clusters"]);
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

function getApiViewForTab(activeTab) {
  return SERVER_VIEW_TABS.has(activeTab) ? activeTab : "all";
}

export default function ApiLogs() {
  const [logs, setLogs]             = useState([]);
  const [stats, setStats]           = useState({ totalLogs: 0, errorLogs: 0 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [page, setPage]             = useState(0);
  const [pageSize, setPageSize]     = useState(50);
  const [totalElements, setTotalElements] = useState(0);
  const [hasNext, setHasNext]       = useState(false);
  const [activeTab, setActiveTab]   = useState("all");
  const [tabTotals, setTabTotals]   = useState({
    "unique-email": null,
    "unique-ip": null,
    clusters: null,
  });

  const [searchType, setSearchType] = useState("email");
  const [searchValue, setSearchValue] = useState("");
  const [appliedSearch, setAppliedSearch] = useState({ type: "email", value: "" });
  const [selectedLogIds, setSelectedLogIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    method: "", statusCode: "", dateFrom: "", dateTo: "",
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedLog, setSelectedLog]   = useState(null);
  const [viewMode, setViewMode]         = useState(() => (
    typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "table"
  ));
  const [sortBy, setSortBy]             = useState("requestTime");
  const [sortOrder, setSortOrder]       = useState("desc");
  const [autoRefresh, setAutoRefresh]   = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const refreshTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function verifyAccess() {
      try {
        const res = await fetch("/api/admin/access-check", { credentials: "include" });
        const data = await res.json().catch(() => ({}));

        if (!mounted) return;

        if (res.ok && data.allowed) {
          setAccessAllowed(true);
          setAccessChecked(true);
          return;
        }

        setAccessAllowed(false);
        setAccessChecked(true);
        setError(data.message || "Not allowed to view API logs.");
      } catch {
        if (!mounted) return;
        setAccessAllowed(false);
        setAccessChecked(true);
        setError("Failed to verify API logs access.");
      }
    }

    verifyAccess();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!accessAllowed) return;
    if (autoRefresh) {
      refreshTimer.current = setInterval(() => { fetchLogs(); fetchStats(); }, refreshInterval * 1000);
    }
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [accessAllowed, autoRefresh, refreshInterval, page, pageSize, activeTab, appliedSearch, sortBy, sortOrder]);

  useEffect(() => {
    if (!accessAllowed) return;
    fetchLogs();
    fetchStats();
  }, [accessAllowed, page, pageSize, activeTab, appliedSearch, sortBy, sortOrder]);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const apiView = getApiViewForTab(activeTab);
      let url = `/api/admin/logs?page=${page}&size=${pageSize}&view=${encodeURIComponent(apiView)}`;
      const value = appliedSearch.value?.trim();
      if (value) {
        if (appliedSearch.type === "email") url += `&email=${encodeURIComponent(value)}`;
        else if (appliedSearch.type === "ip") url += `&ip=${encodeURIComponent(value)}`;
        else if (appliedSearch.type === "path") url += `&path=${encodeURIComponent(value)}`;
      }
      url += `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");

      const data = await res.json();
      let fetched = data.content || [];

      if (filters.method) {
        fetched = fetched.filter((l) => l.requestMethod === filters.method);
      }
      if (filters.statusCode) {
        fetched = fetched.filter((l) => String(l.responseStatus) === filters.statusCode);
      }

      setLogs(fetched);
      const total = data.totalElements ?? 0;
      setTotalElements(total);
      setHasNext(data.last === false);
      setSelectedLogIds(new Set());

      if (SERVER_VIEW_TABS.has(activeTab)) {
        setTabTotals((prev) => ({ ...prev, [activeTab]: total }));
      }
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
    } catch {
      /* silent */
    }
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
      case "unique-email":
      case "unique-ip":
      case "clusters":      return logs;
      default:              return logs;
    }
  }, [activeTab, logs, authenticatedLogs, anonymousLogs, invalidLogs]);

  function handleTabChange(tabId) {
    setPage(0);
    setActiveTab(tabId);
  }

  function handlePageSizeChange(nextSize) {
    setPage(0);
    setPageSize(Number(nextSize));
  }

  function handleFilterChange(f, v) { setFilters(p => ({ ...p, [f]: v })); }
  function handleApplySearch(e) {
    e?.preventDefault();
    setPage(0);
    setAppliedSearch({ type: searchType, value: searchValue.trim() });
  }
  function handleClearSearch() {
    setSearchValue("");
    setPage(0);
    setAppliedSearch({ type: searchType, value: "" });
  }
  function handleSort(f) {
    if (sortBy === f) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortBy(f); setSortOrder("desc"); }
  }

  const allDisplayedSelected = displayedLogs.length > 0
    && displayedLogs.every((log) => selectedLogIds.has(log.logId));

  function toggleLogSelection(logId) {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  }

  function toggleSelectAllLogs() {
    if (allDisplayedSelected) {
      setSelectedLogIds(new Set());
      return;
    }
    setSelectedLogIds(new Set(displayedLogs.map((log) => log.logId)));
  }

  async function handleBulkDeleteLogs() {
    if (selectedLogIds.size === 0) return;
    const confirmed = window.confirm(`Delete ${selectedLogIds.size} selected API log(s)?`);
    if (!confirmed) return;

    try {
      setDeleting(true);
      const result = await deleteApiLogs([...selectedLogIds]);
      setError(null);
      await fetchLogs();
      await fetchStats();
      if ((result.deleted || 0) === 0) {
        setError("No logs were deleted.");
      }
    } catch (err) {
      setError(err.message || "Failed to delete logs.");
    } finally {
      setDeleting(false);
    }
  }

  const rangeStart = totalElements === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min((page + 1) * pageSize, totalElements);

  function getTabCount(tabId) {
    if (SERVER_VIEW_TABS.has(tabId)) {
      if (activeTab === tabId) return totalElements;
      return tabTotals[tabId] ?? "�";
    }
    switch (tabId) {
      case "authenticated": return authenticatedLogs.length;
      case "anonymous": return anonymousLogs.length;
      case "invalid": return invalidLogs.length;
      case "all":
        return SERVER_VIEW_TABS.has(activeTab) ? stats.totalLogs : totalElements;
      default: return logs.length;
    }
  }

  function getExportTab() {
    if (["authenticated", "anonymous", "invalid"].includes(activeTab)) {
      return activeTab;
    }
    return "all";
  }

  async function exportToCSV() {
    setExporting(true);
    setError(null);
    try {
      const view = getApiViewForTab(activeTab);
      const tab = getExportTab();
      let url = `/api/admin/logs/export?view=${encodeURIComponent(view)}&tab=${encodeURIComponent(tab)}`;

      const value = appliedSearch.value?.trim();
      if (value) {
        if (appliedSearch.type === "email") url += `&email=${encodeURIComponent(value)}`;
        else if (appliedSearch.type === "ip") url += `&ip=${encodeURIComponent(value)}`;
        else if (appliedSearch.type === "path") url += `&path=${encodeURIComponent(value)}`;
      }
      if (filters.method) url += `&method=${encodeURIComponent(filters.method)}`;
      if (filters.statusCode) url += `&statusCode=${encodeURIComponent(filters.statusCode)}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to export logs");
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `api-logs-${activeTab}-${new Date().toISOString()}.csv`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message || "Failed to export logs.");
    } finally {
      setExporting(false);
    }
  }

  const activeFiltersCount = Object.values(filters).filter(Boolean).length
    + (appliedSearch.value ? 1 : 0);

  const TABS = [
    { id: "all",           label: "All Requests",    icon: ICONS.chart,   color: "blue",    desc: "Every API call logged" },
    { id: "authenticated", label: "With Email",       icon: ICONS.mail,    color: "emerald", desc: "Requests from identified users" },
    { id: "anonymous",     label: "Anonymous",        icon: ICONS.user,    color: "amber",   desc: "Requests without user identity" },
    { id: "invalid",       label: "Invalid / Expired",icon: ICONS.ban,     color: "rose",    desc: "401/403 � token invalid or expired" },
    { id: "unique-email",  label: "Unique Email",     icon: ICONS.mail,    color: "indigo",  desc: "Latest request per email, paginated across all logs" },
    { id: "unique-ip",     label: "Unique IP",        icon: ICONS.globe,   color: "cyan",    desc: "Latest request per IP, paginated across all logs" },
    { id: "clusters",      label: "Clusters",         icon: ICONS.shield,  color: "slate",  desc: "Visit sessions grouped by IP + email" },
  ];

  const TAB_COLOR_MAP = {
    blue:    { active: "bg-brand-dark text-paper shadow-brand-200",     inactive: "text-brand hover:bg-glacier",     badge: "bg-glacier text-brand-dark" },
    emerald: { active: "bg-aurora-muted text-paper shadow-emerald-200",inactive: "text-aurora-muted hover:bg-sage-soft",badge: "bg-sage-soft text-aurora-muted" },
    amber:   { active: "bg-ceremonial text-ink shadow-amber-200",   inactive: "text-ink hover:bg-ceremonial-soft",   badge: "bg-ceremonial-soft text-ink" },
    rose:    { active: "bg-ember text-paper shadow-rose-200",     inactive: "text-ember hover:bg-ember-soft",     badge: "bg-rose-100 text-ember" },
    indigo:  { active: "bg-brand-dark text-paper shadow-indigo-200", inactive: "text-ink hover:bg-glacier", badge: "bg-glacier text-ink" },
    cyan:    { active: "bg-cyan-600 text-paper shadow-cyan-200",     inactive: "text-aurora-muted hover:bg-sage-soft",     badge: "bg-cyan-100 text-aurora-muted" },
    slate:   { active: "bg-ink text-paper shadow-soft", inactive: "text-ink hover:bg-frost", badge: "bg-frost text-ink" },
  };

  const statCards = [
    { label: "Total Requests",    value: stats.totalLogs,              icon: ICONS.chart,   border: "border-brand",    bg: "bg-glacier",    iconColor: "text-brand" },
    { label: "Error Requests",    value: stats.errorLogs,              icon: ICONS.warning, border: "border-rose-400",    bg: "bg-ember-soft",    iconColor: "text-rose-500" },
    { label: "With Email",        value: authenticatedLogs.length,     icon: ICONS.mail,    border: "border-emerald-400", bg: "bg-sage-soft", iconColor: "text-emerald-500" },
    { label: "Anonymous",         value: anonymousLogs.length,         icon: ICONS.user,    border: "border-amber-400",   bg: "bg-ceremonial-soft",   iconColor: "text-amber-500" },
    { label: "Invalid / Expired", value: invalidLogs.length,           icon: ICONS.ban,     border: "border-rose-500",    bg: "bg-ember-soft",    iconColor: "text-ember" },
    { label: "Success Rate",
      value: stats.totalLogs > 0 ? `${((stats.totalLogs - stats.errorLogs) / stats.totalLogs * 100).toFixed(1)}%` : "�",
      icon: ICONS.shield, border: "border-teal-400", bg: "bg-teal-50", iconColor: "text-teal-500" },
  ];

  if (!accessChecked) {
    return (
      <div className="min-h-screen bg-frost-mesh flex items-center justify-center p-6 text-ink">Checking API logs access...</div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="min-h-screen bg-frost-mesh flex items-center justify-center p-6">
        <div className="glass-panel max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ember-soft text-ember">
            <Icon d={ICONS.lock} className="h-6 w-6" />
          </div>
          <p className="section-kicker">Restricted workspace</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">Access denied</h2>
          <p className="mt-2 text-sm text-dusk">{error || "You are not allowed to view API logs."}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn-ghost mt-5"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-frost-mesh py-4 sm:py-6">
        <div className="page-enter w-full mx-auto space-y-6">

          {/* Header */}
          <div className="relative overflow-hidden rounded-3xl bg-deep p-5 shadow-lift sm:p-7">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-24 w-80 rounded-full bg-glacier/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-11 h-11 bg-brand rounded-2xl flex items-center justify-center shadow-brand">
                  <Icon d={ICONS.lock} className="w-5 h-5 text-paper" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dusk-soft">Security observability</p>
                  <h1 className="font-display text-3xl font-bold text-paper">API Logs</h1>
                </div>
              </div>
              <p className="ml-14 mt-1 text-sm text-frost/75">Metadata-only access logs � No tokens or request bodies � 90-day retention</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 border border-white/15 bg-paper/10 px-3 py-2 rounded-xl cursor-pointer select-none text-sm font-medium text-frost backdrop-blur">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-brand rounded"
                />
                Auto-refresh
                {autoRefresh && (
                  <select
                    value={refreshInterval}
                    onChange={e => setRefreshInterval(Number(e.target.value))}
                    className="ml-1 rounded-lg border border-white/20 bg-deep px-1 py-0.5 text-xs text-paper focus:ring-2 focus:ring-brand"
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
                disabled={exporting || loading}
                className="btn-ghost flex items-center gap-2 border-white/20 bg-paper/10 text-paper hover:bg-paper/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon d={ICONS.download} className={`w-4 h-4 ${exporting ? "animate-pulse" : ""}`} />
                {exporting ? "Exporting all�" : "Export CSV"}
              </button>

              <button
                onClick={() => { fetchLogs(); fetchStats(); }}
                className="btn-brand flex items-center gap-2 shadow-brand"
              >
                <Icon d={ICONS.refresh} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {statCards.map(({ label, value, icon, border, bg, iconColor }) => (
              <div key={label} className={`surface-card border-l-4 ${border} p-4 hover:shadow-lift transition-shadow`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-dusk uppercase tracking-wide leading-tight">{label}</p>
                  <div className={`${bg} rounded-xl p-1.5`}>
                    <Icon d={icon} className={`w-4 h-4 ${iconColor}`} />
                  </div>
                </div>
                <p className="font-display text-2xl font-bold text-ink">{typeof value === "number" ? value.toLocaleString() : value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="glass-panel p-1.5 flex flex-wrap gap-1">
            {TABS.map(tab => {
              const colors = TAB_COLOR_MAP[tab.color];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-1 min-w-[130px] justify-center
                    ${isActive ? `${colors.active} shadow-md` : `text-dusk ${colors.inactive}`}`}
                >
                  <Icon d={tab.icon} className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-xl text-xs font-bold ml-1 ${isActive ? "bg-paper/25 text-paper" : colors.badge}`}>
                    {typeof getTabCount(tab.id) === "number" ? getTabCount(tab.id).toLocaleString() : getTabCount(tab.id)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab contextual banner */}
          {activeTab === "invalid" && (
            <div className="flex items-start gap-3 bg-ember-soft border border-rose-200 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.warning} className="w-4 h-4 text-ember" />
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-800">Invalid / Expired Token Requests</p>
                <p className="text-xs text-ember mt-0.5">
                  These requests returned <strong>401 Unauthorized</strong> or <strong>403 Forbidden</strong>.
                  When an email is visible, it means that user&apos;s session token was no longer valid at the time of the request.
                </p>
              </div>
            </div>
          )}
          {activeTab === "authenticated" && (
            <div className="flex items-start gap-3 bg-sage-soft border border-aurora/30 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-sage-soft rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.mail} className="w-4 h-4 text-aurora-muted" />
              </div>
              <div>
                <p className="text-sm font-semibold text-aurora-muted">Authenticated Requests</p>
                <p className="text-xs text-aurora-muted mt-0.5">
                  Requests where a user email was successfully extracted from the session or JWT token.
                </p>
              </div>
            </div>
          )}
          {activeTab === "anonymous" && (
            <div className="flex items-start gap-3 bg-ceremonial-soft border border-ceremonial/40 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-ceremonial-soft rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.user} className="w-4 h-4 text-ink" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Anonymous Requests</p>
                <p className="text-xs text-ink mt-0.5">
                  Requests with no user identity � unauthenticated calls, public endpoints, or requests with missing tokens.
                </p>
              </div>
            </div>
          )}
          {activeTab === "unique-email" && (
            <div className="flex items-start gap-3 bg-glacier border border-brand/25 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-glacier rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.mail} className="w-4 h-4 text-brand-dark" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Unique Email View</p>
                <p className="text-xs text-brand-dark mt-0.5">
                  Shows the <strong>latest request per email</strong> across the full log database.
                  Each page contains up to {pageSize} unique emails.
                </p>
              </div>
            </div>
          )}
          {activeTab === "unique-ip" && (
            <div className="flex items-start gap-3 bg-sage-soft border border-cyan-200 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.globe} className="w-4 h-4 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cyan-800">Unique IP View</p>
                <p className="text-xs text-cyan-600 mt-0.5">
                  Shows the <strong>latest request per IP address</strong> across the full log database.
                  Each page contains up to {pageSize} unique IPs.
                </p>
              </div>
            </div>
          )}
          {activeTab === "clusters" && (
            <div className="flex items-start gap-3 bg-glacier border border-brand/25 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 bg-paper rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon d={ICONS.shield} className="w-4 h-4 text-brand-dark" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Visit Clusters</p>
                <p className="text-xs text-brand-dark mt-0.5">
                  Groups requests from the same <strong>IP + email</strong> into visit sessions across the full log database.
                  A new cluster starts after 30 minutes of inactivity. Each page contains up to {pageSize} clusters.
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-deep">
              <div className="flex items-center gap-2">
                <Icon d={ICONS.filter} className="w-4 h-4 text-dusk-soft" />
                <span className="text-sm font-semibold text-paper">Filters &amp; Search</span>
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 bg-brand-dark text-paper text-xs font-bold rounded-xl">
                    {activeFiltersCount} active
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAdvancedFilters(p => !p)}
                className="text-dusk-soft hover:text-paper text-xs font-medium transition"
              >
                {showAdvancedFilters ? "Hide advanced ?" : "Show advanced ?"}
              </button>
            </div>

            <div className="p-5 space-y-4">
              <form onSubmit={handleApplySearch} className="flex flex-col lg:flex-row gap-2">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="input-field py-2.5 text-sm"
                >
                  <option value="email">Search by Email</option>
                  <option value="ip">Search by IP Address</option>
                  <option value="path">Search by API Call / Path</option>
                </select>
                <div className="relative flex-1">
                  <Icon d={ICONS.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dusk" />
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={
                      searchType === "email" ? "user@example.com"
                        : searchType === "ip" ? "192.168.x.x"
                          : "/api/auth/login"
                    }
                    className="input-field w-full py-2.5 pl-10 pr-4 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-brand flex items-center justify-center gap-2 px-5 py-2.5"
                >
                  <Icon d={ICONS.search} className="w-4 h-4" /> Search
                </button>
              </form>

              {showAdvancedFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-dusk mb-1.5 uppercase tracking-wide">HTTP Method</label>
                    <select
                      value={filters.method}
                      onChange={e => handleFilterChange("method", e.target.value)}
                      className="input-field w-full py-2 text-sm"
                    >
                      <option value="">All Methods</option>
                      {["GET","POST","PUT","DELETE","PATCH"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-dusk mb-1.5 uppercase tracking-wide">Status Code</label>
                    <select
                      value={filters.statusCode}
                      onChange={e => handleFilterChange("statusCode", e.target.value)}
                      className="input-field w-full py-2 text-sm"
                    >
                      <option value="">All Statuses</option>
                      {[["200","200 � OK"],["201","201 � Created"],["400","400 � Bad Request"],
                        ["401","401 � Unauthorized"],["403","403 � Forbidden"],
                        ["404","404 � Not Found"],["500","500 � Server Error"]
                      ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => { setPage(0); fetchLogs(); }}
                  className="btn-brand flex items-center gap-2 px-5 py-2"
                >
                  Apply client filters
                </button>
                <button
                  onClick={handleClearSearch}
                  className="btn-ghost flex items-center gap-2 px-5 py-2"
                >
                  <Icon d={ICONS.close} className="w-4 h-4" /> Clear search
                </button>
                <label className="inline-flex items-center gap-2 text-sm text-dusk ml-auto">
                  <input
                    type="checkbox"
                    checked={allDisplayedSelected}
                    onChange={toggleSelectAllLogs}
                    disabled={displayedLogs.length === 0 || deleting}
                    className="rounded border-ink/15"
                  />
                  Select all on page
                </label>
                <button
                  type="button"
                  onClick={handleBulkDeleteLogs}
                  disabled={selectedLogIds.size === 0 || deleting}
                  className="flex items-center gap-2 px-4 py-2 bg-ember text-paper rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-40"
                >
                  Delete selected ({selectedLogIds.size})
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-ember-soft border border-rose-200 rounded-2xl px-5 py-4">
              <Icon d={ICONS.warning} className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <p className="text-sm font-medium text-ember">{error}</p>
            </div>
          )}

          {/* View mode + count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-paper rounded-xl border border-ink/10 shadow-sm p-1">
              {[["table","Table"],["cards","Cards"],["compact","Compact"]].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                    viewMode === mode ? "bg-brand-dark text-paper shadow" : "text-dusk hover:bg-frost"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-sm text-dusk">
              Showing <span className="font-bold text-ink">{displayedLogs.length}</span>
              {activeTab !== "all" && (
                <span className="text-xs text-dusk ml-1">
                  ({TABS.find(t => t.id === activeTab)?.label})
                </span>
              )}
              <span className="text-xs text-dusk ml-2">� {pageSize} per page</span>
            </p>
          </div>

          {/* Logs */}
          <div className="surface-card overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <svg className="animate-spin w-12 h-12 text-brand" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-dusk font-medium">Loading logs�</p>
              </div>
            ) : displayedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-16 h-16 bg-frost rounded-2xl flex items-center justify-center">
                  <Icon d={ICONS.info} className="w-8 h-8 text-dusk" />
                </div>
                <p className="text-dusk font-semibold text-lg">No logs found</p>
                <p className="text-dusk text-sm">Try adjusting your filters or switching tabs</p>
              </div>
            ) : viewMode === "table" ? (
              <TableView
                logs={displayedLogs}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                onSelect={setSelectedLog}
                activeTab={activeTab}
                selectedLogIds={selectedLogIds}
                onToggleSelect={toggleLogSelection}
                onToggleSelectAll={toggleSelectAllLogs}
                allSelected={allDisplayedSelected}
                deleting={deleting}
                showClusterInfo={activeTab === "clusters"}
              />
            ) : viewMode === "cards" ? (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedLogs.map(log => <LogCard key={log.logId} log={log} onSelect={setSelectedLog} showClusterInfo={activeTab === "clusters"} />)}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayedLogs.map(log => <CompactRow key={log.logId} log={log} onSelect={setSelectedLog} showClusterInfo={activeTab === "clusters"} />)}
              </div>
            )}

            {!loading && displayedLogs.length > 0 && (
              <div className="border-t border-ink/10 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-frost/60">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-dusk">
                    Showing {rangeStart}�{rangeEnd} of {totalElements.toLocaleString()}
                  </p>
                  <label className="flex items-center gap-2 text-sm text-dusk">
                    <span className="text-xs font-semibold uppercase tracking-wide text-dusk">Per page</span>
                    <select
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-ink/10 rounded-lg bg-paper focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    className="px-4 py-2 text-sm font-semibold text-dusk bg-paper border border-ink/10 rounded-xl hover:bg-frost disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    ? Previous {pageSize}
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNext || loading}
                    className="px-4 py-2 text-sm font-semibold text-paper bg-brand-dark rounded-xl hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next {pageSize} ?
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </>
  );
}

function ClusterBadge({ log }) {
  if (!log?.clusterCount || log.clusterCount <= 1) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10px] font-bold bg-glacier text-brand-dark">
      {log.clusterCount} requests
    </span>
  );
}

function TableView({ logs, sortBy, sortOrder, onSort, onSelect, activeTab, selectedLogIds, onToggleSelect, onToggleSelectAll, allSelected, deleting, showClusterInfo = false }) {
  const SortIcon = ({ field }) => sortBy === field ? (
    <span className="text-brand font-bold text-base"> {sortOrder === "asc" ? "?" : "?"}</span>
  ) : null;

  const Th = ({ field, children }) => (
    <th
      onClick={() => field && onSort(field)}
      className={`px-4 py-3.5 text-left text-xs font-bold text-dusk uppercase tracking-wide whitespace-nowrap
        ${field ? "cursor-pointer hover:bg-frost select-none" : ""}`}
    >
      {children}{field && <SortIcon field={field} />}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1280px] w-full">
        <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-ink/10">
          <tr>
            <th className="px-4 py-3.5 text-left text-xs font-bold text-dusk uppercase tracking-wide w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                disabled={logs.length === 0 || deleting}
                className="rounded border-ink/15"
              />
            </th>
            <Th field="requestTime">Time</Th>
            <Th>Method</Th>
            <Th>Path</Th>
            <Th field="responseStatus">Status</Th>
            <Th>IP Address</Th>
            <Th>Email</Th>
            {showClusterInfo && <Th>Cluster</Th>}
            {activeTab === "invalid" && <Th>Token Status</Th>}
            <Th field="responseTime">Resp. Time</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map(log => (
            <tr key={log.logId} className={`hover:bg-glacier/50 transition-colors ${isInvalidToken(log) ? "bg-ember-soft/20" : ""}`}>
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedLogIds.has(log.logId)}
                  onChange={() => onToggleSelect(log.logId)}
                  disabled={deleting}
                  className="rounded border-ink/15"
                />
              </td>
              <td className="px-4 py-3 text-xs text-dusk whitespace-nowrap font-medium">{formatDate(log.requestTime)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ring-1 ${methodColor(log.requestMethod)}`}>{log.requestMethod}</span>
              </td>
              <td className="px-4 py-3 min-w-[320px] max-w-lg">
                <span className="text-xs font-mono bg-frost text-ink px-2 py-1 rounded break-all">{log.requestPath}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusColor(log.responseStatus)}`}>{log.responseStatus || "�"}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-dusk">{log.requestIp || "�"}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {log.extractedEmail ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 bg-glacier rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon d={ICONS.user} className="w-3 h-3 text-brand" />
                    </div>
                    <span className="text-xs text-ink font-medium max-w-[280px] truncate">{log.extractedEmail}</span>
                  </div>
                ) : (
                  <span className="text-xs text-dusk italic">Anonymous</span>
                )}
              </td>
              {showClusterInfo && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <ClusterBadge log={log} />
                  {!log.isCluster && <span className="text-xs text-dusk">Single</span>}
                </td>
              )}
              {activeTab === "invalid" && (
                <td className="px-4 py-3 whitespace-nowrap">
                  {isInvalidToken(log) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-ember text-xs font-bold rounded-full">
                      <Icon d={ICONS.ban} className="w-3 h-3" />
                      {log.responseStatus === 401 ? "Expired/Invalid" : "Forbidden"}
                    </span>
                  ) : <span className="text-xs text-dusk">�</span>}
                </td>
              )}
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`text-xs font-bold ${responseTimeColor(log.responseTime)}`}>
                  {log.responseTime ? `${log.responseTime}ms` : "�"}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <button onClick={() => onSelect(log)}
                  className="text-xs font-semibold text-brand hover:text-ink bg-glacier hover:bg-glacier px-3 py-1.5 rounded-lg transition">
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

function LogCard({ log, onSelect, showClusterInfo = false }) {
  const invalid = isInvalidToken(log);
  return (
    <div
      onClick={() => onSelect(log)}
      className={`surface-card border-2 p-5 cursor-pointer transition-all hover:shadow-lift hover:-translate-y-0.5
        ${invalid ? "border-rose-200 bg-ember-soft/40 hover:border-rose-400" : "border-ink/10 hover:border-brand/40"}`}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ring-1 ${methodColor(log.requestMethod)}`}>{log.requestMethod}</span>
        <div className="flex items-center gap-2">
          {showClusterInfo && <ClusterBadge log={log} />}
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusColor(log.responseStatus)}`}>{log.responseStatus || "�"}</span>
        </div>
      </div>
      <div className="bg-frost rounded-lg px-3 py-2 mb-3">
        <p className="text-xs font-mono text-ink truncate">{log.requestPath}</p>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Icon d={ICONS.globe} className="w-3.5 h-3.5 text-dusk flex-shrink-0" />
          <span className="font-mono text-dusk">{log.requestIp || "�"}</span>
        </div>
        {log.extractedEmail ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-glacier rounded-full flex items-center justify-center flex-shrink-0">
              <Icon d={ICONS.user} className="w-3 h-3 text-brand" />
            </div>
            <span className="text-ink font-medium truncate">{log.extractedEmail}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon d={ICONS.user} className="w-3.5 h-3.5 text-dusk-soft flex-shrink-0" />
            <span className="text-dusk italic">Anonymous</span>
          </div>
        )}
        {invalid && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-200">
            <Icon d={ICONS.ban} className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span className="text-ember font-semibold">
              {log.responseStatus === 401 ? "Token expired / invalid" : "Access forbidden"}
              {log.extractedEmail && ` � ${log.extractedEmail}`}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-ink/10 flex items-center justify-between">
        <span className="text-dusk text-xs">{formatDate(log.requestTime)}</span>
        <span className={`text-xs font-bold ${responseTimeColor(log.responseTime)}`}>
          {log.responseTime ? `${log.responseTime}ms` : "�"}
        </span>
      </div>
    </div>
  );
}

function CompactRow({ log, onSelect, showClusterInfo = false }) {
  const invalid = isInvalidToken(log);
  return (
    <div
      onClick={() => onSelect(log)}
      className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors
        ${invalid ? "hover:bg-ember-soft bg-ember-soft/30" : "hover:bg-glacier/50"}`}
    >
      <span className={`px-2 py-0.5 text-xs font-bold rounded ring-1 flex-shrink-0 ${methodColor(log.requestMethod)}`}>{log.requestMethod}</span>
      <span className="text-xs font-mono text-ink flex-1 truncate">{log.requestPath}</span>
      {showClusterInfo && <ClusterBadge log={log} />}
      {log.extractedEmail && (
        <span className="text-xs text-brand-dark bg-glacier px-2 py-0.5 rounded-full hidden sm:block max-w-[180px] truncate">{log.extractedEmail}</span>
      )}
      {invalid && (
        <span className="text-xs font-bold text-ember bg-rose-100 px-2 py-0.5 rounded-full flex-shrink-0">
          {log.responseStatus === 401 ? "EXPIRED" : "FORBIDDEN"}
        </span>
      )}
      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full flex-shrink-0 ${statusColor(log.responseStatus)}`}>{log.responseStatus || "�"}</span>
      <span className="text-dusk text-xs flex-shrink-0 hidden md:block">{formatDate(log.requestTime)}</span>
    </div>
  );
}

function LogDetailModal({ log, onClose }) {
  const invalid = isInvalidToken(log);
  return (
    <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-panel rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className={`px-6 py-5 flex items-center justify-between flex-shrink-0 ${invalid ? "bg-gradient-to-r from-ember to-ember" : "bg-gradient-to-r from-brand to-brand-dark"}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-paper/20 rounded-xl flex items-center justify-center">
              <Icon d={invalid ? ICONS.warning : ICONS.info} className="w-5 h-5 text-paper" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-paper">Request Details</h3>
              {invalid && <p className="text-xs text-paper/80 mt-0.5">{log.responseStatus === 401 ? "Token expired or invalid" : "Access was forbidden"}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-paper/70 hover:text-paper transition">
            <Icon d={ICONS.close} className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {invalid && (
            <div className="bg-ember-soft border border-rose-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Icon d={ICONS.ban} className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-rose-800">
                    {log.responseStatus === 401 ? "Authentication Failed � Invalid or Expired Token" : "Authorization Failed � Access Forbidden"}
                  </p>
                  {log.extractedEmail ? (
                    <p className="text-xs text-ember mt-1">
                      Email: <span className="font-bold">{log.extractedEmail}</span> � session token was no longer valid.
                    </p>
                  ) : (
                    <p className="text-xs text-ember mt-1">No user identity was extracted from this request.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-frost rounded-2xl p-4">
              <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">HTTP Method</p>
              <span className={`px-3 py-1.5 text-sm font-bold rounded-full ring-1 ${methodColor(log.requestMethod)}`}>{log.requestMethod}</span>
            </div>
            <div className="bg-frost rounded-2xl p-4">
              <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">Status Code</p>
              <span className={`px-3 py-1.5 text-sm font-bold rounded-full ${statusColor(log.responseStatus)}`}>{log.responseStatus || "�"}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">Request Path</p>
            <div className="bg-deep rounded-xl px-4 py-3">
              <p className="font-mono text-sm text-aurora break-all">{log.requestPath}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">User Identity</p>
            <div className="bg-frost rounded-2xl p-4">
              {log.extractedEmail ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-glacier rounded-full flex items-center justify-center">
                    <Icon d={ICONS.user} className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">{log.extractedEmail}</p>
                    {invalid && <p className="text-xs text-rose-500 mt-0.5 font-semibold">Token was invalid/expired at request time</p>}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-frost rounded-full flex items-center justify-center">
                    <Icon d={ICONS.user} className="w-5 h-5 text-dusk" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-dusk">Anonymous</p>
                    <p className="text-xs text-dusk mt-0.5">No user identity extracted</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">IP Address</p>
              <div className="bg-frost rounded-2xl p-4 flex items-center gap-2">
                <Icon d={ICONS.globe} className="w-4 h-4 text-dusk flex-shrink-0" />
                <p className="font-mono text-sm text-ink">{log.requestIp || "�"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">Response Time</p>
              <div className="bg-frost rounded-2xl p-4">
                <p className={`text-2xl font-extrabold ${responseTimeColor(log.responseTime)}`}>
                  {log.responseTime ? `${log.responseTime}ms` : "�"}
                </p>
                {log.responseTime && <p className="text-xs text-dusk mt-1">{log.responseTime < 100 ? "Excellent" : log.responseTime < 500 ? "Acceptable" : "Slow"}</p>}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">Timestamp</p>
            <div className="bg-frost rounded-2xl p-4">
              <p className="text-sm text-ink font-medium">{formatDate(log.requestTime)}</p>
            </div>
          </div>

          {log.clusterCount > 1 && (
            <div>
              <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">Visit Cluster</p>
            <div className="bg-glacier border border-brand/20 rounded-2xl p-4 space-y-2">
                <p className="text-sm font-bold text-ink">{log.clusterCount} requests in this visit</p>
                <p className="text-xs text-brand-dark">
                  Started: {formatDate(log.clusterStart)}
                </p>
                <p className="text-xs text-brand-dark">
                  Latest: {formatDate(log.clusterEnd || log.requestTime)}
                </p>
                <p className="text-xs text-brand">
                  Grouped by matching IP and email with up to 30 minutes between requests.
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-dusk uppercase tracking-widest mb-2">Log ID</p>
            <div className="bg-frost rounded-2xl p-4">
              <p className="font-mono text-xs text-dusk break-all">{log.logId}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-ink/10 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-deep text-paper rounded-xl text-sm font-semibold hover:bg-ink transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
