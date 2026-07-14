import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Scatter,
  ComposedChart,
} from "recharts";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiGlobe,
  FiLayers,
  FiRefreshCw,
  FiSearch,
  FiServer,
  FiShield,
  FiX,
} from "react-icons/fi";
import { fetchAllAnalytics, fetchAnalyticsTimeseries } from "../utils/analyticsApi";
import { timezoneUtils } from "../utils/timezoneUtils";

const AnalyticsGlobe = lazy(() => import("../components/analytics/AnalyticsGlobe"));

const POLL_MS = 60_000;

function formatDuration(seconds) {
  if (seconds == null || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatRate(rate) {
  if (rate == null) return "0%";
  return `${(rate * 100).toFixed(1)}%`;
}

function ScopeToggle({ scope, onChange, disabled }) {
  return (
    <div
      className="inline-flex rounded-full bg-deep p-1 shadow-soft"
      role="tablist"
      aria-label="Time scope"
    >
      {[
        { id: "today", label: "Today" },
        { id: "all", label: "All Time" },
      ].map((opt) => {
        const active = scope === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={`rounded-full px-5 py-2.5 text-base font-semibold outline-none transition-colors duration-200 ring-brand focus-visible:ring-2 disabled:opacity-50 ${
              active
                ? "bg-brand text-paper"
                : "bg-paper text-ink hover:bg-paper/90"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, emberValue = false, hint }) {
  return (
    <div className="dash-stat p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base text-dusk">{label}</p>
          <p
            className={`mt-1 font-display text-2xl font-bold sm:text-3xl ${
              emberValue ? "text-ember" : "text-ink"
            }`}
          >
            {value}
          </p>
          {hint ? <p className="mt-1 text-sm text-dusk">{hint}</p> : null}
        </div>
        <span className="rounded-xl bg-frost p-2.5 text-brand" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function TimeseriesChart({ buckets = [], filterIp, filteredLabel }) {
  const data = useMemo(
    () =>
      (buckets || []).map((b) => ({
        t: b.t,
        label: b.t
          ? new Date(b.t).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        requests: b.requests || 0,
        verified_events: b.verified_events || 0,
        hasVerified: (b.verified_events || 0) > 0,
      })),
    [buckets]
  );

  const verifiedPoints = useMemo(
    () => data.filter((d) => d.hasVerified),
    [data]
  );

  return (
    <section className="dash-panel p-4 sm:p-6" aria-labelledby="timeseries-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-kicker">Traffic over time</p>
          <h2 id="timeseries-heading" className="font-display text-xl font-semibold text-ink sm:text-2xl">
            Request volume
          </h2>
          <p className="mt-1 max-w-prose text-base text-dusk">
            Violet area shows requests. Teal markers flag buckets with verified crypto or auth events.
            {filterIp ? ` Filtered view: ${filteredLabel}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-base text-dusk" aria-label="Chart legend">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
            Requests
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-aurora" aria-hidden />
            <FiCheckCircle className="h-4 w-4 text-aurora" aria-hidden />
            Verified events
          </span>
        </div>
      </div>
      <div className="h-72 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-base text-dusk">
            No traffic in this scope yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="requestsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B7FE8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8B7FE8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1B1D2E18" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#5B5D74", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#1B1D2E22" }}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "#5B5D74", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "#F7F4EC",
                  border: "1px solid rgba(27,29,46,0.12)",
                  borderRadius: 12,
                  color: "#1B1D2E",
                  fontSize: 16,
                }}
                formatter={(value, name) => {
                  if (name === "requests") return [value, "Requests"];
                  if (name === "verified_events") return [value, "Verified events"];
                  return [value, name];
                }}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#8B7FE8"
                strokeWidth={2}
                fill="url(#requestsFill)"
                name="requests"
                isAnimationActive={false}
              />
              <Scatter
                data={verifiedPoints}
                dataKey="verified_events"
                fill="#3FC7B8"
                name="verified_events"
                shape={(props) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null || !payload?.hasVerified) return null;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={6} fill="#3FC7B8" stroke="#F7F4EC" strokeWidth={2} />
                      <title>
                        {payload.verified_events} verified event(s) — cast ballot, key ceremony, or MFA verify
                      </title>
                    </g>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function SessionsTable({
  sessions = [],
  filterIp,
  textFilter,
  onTextFilterChange,
  sortKey,
  sortDir,
  onSort,
}) {
  const filtered = useMemo(() => {
    let rows = sessions;
    if (filterIp) {
      rows = rows.filter((s) => s.ip === filterIp);
    }
    const q = (textFilter || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter((s) => {
        const loc = `${s.city || ""} ${s.country || ""}`.toLowerCase();
        return (
          (s.ip || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          loc.includes(q)
        );
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [sessions, filterIp, textFilter, sortKey, sortDir]);

  const SortTh = ({ field, children }) => {
    const active = sortKey === field;
    return (
      <th scope="col" className="px-3 py-3 text-left text-base font-semibold text-ink">
        <button
          type="button"
          onClick={() => onSort(field)}
          className="inline-flex items-center gap-1 rounded-lg outline-none ring-brand focus-visible:ring-2"
        >
          {children}
          <span className="text-sm text-dusk" aria-hidden>
            {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <section className="dash-panel overflow-hidden" aria-labelledby="sessions-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 p-4 sm:p-6">
        <div>
          <p className="section-kicker">Sessions</p>
          <h2 id="sessions-heading" className="font-display text-xl font-semibold text-ink sm:text-2xl">
            Cluster activity
          </h2>
          <p className="mt-1 max-w-prose text-base text-dusk">
            One row per IP + email visit cluster (30-minute idle gap). Status mix uses icons and labels — not color alone.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dusk" aria-hidden />
          <input
            type="search"
            value={textFilter}
            onChange={(e) => onTextFilterChange(e.target.value)}
            placeholder="Filter by email, IP, or location"
            className="w-full rounded-xl border border-ink/15 bg-paper py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-dusk outline-none ring-brand focus-visible:ring-2"
            aria-label="Filter sessions"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-ink/10 px-4 py-3 text-base text-dusk sm:px-6" aria-label="Status legend">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
          Violet = OK
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-ember" aria-hidden />
          Ember = failed auth
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-aurora" aria-hidden />
          Teal = verified crypto/auth
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink/10 text-base">
          <thead className="bg-frost/60">
            <tr>
              <SortTh field="city">Location</SortTh>
              <SortTh field="ip">IP</SortTh>
              <SortTh field="email">User</SortTh>
              <SortTh field="cluster_requests">Cluster Requests</SortTh>
              <SortTh field="cluster_started">Started</SortTh>
              <SortTh field="cluster_duration_seconds">Duration</SortTh>
              <th scope="col" className="px-3 py-3 text-left text-base font-semibold text-ink">
                Status mix
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-dusk">
                  No sessions match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr key={`${row.ip}-${row.email}-${row.cluster_started}-${idx}`} className="hover:bg-frost/40">
                  <td className="px-3 py-3 text-ink">
                    {row.local ? (
                      <span className="inline-flex items-center gap-1.5">
                        <FiServer className="h-4 w-4 text-ceremonial" aria-hidden />
                        Local / Internal
                      </span>
                    ) : (
                      `${row.city || "Unknown"}, ${row.country || "Unknown"}`
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-block rounded-md bg-frost px-2 py-1 font-mono text-sm text-ink">
                      {row.ip}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {row.email === "Anonymous" || !row.email ? (
                      <span className="text-dusk">Anonymous</span>
                    ) : (
                      <span className="text-ink">{row.email}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-ink">{row.cluster_requests}</td>
                  <td className="px-3 py-3 text-ink whitespace-nowrap">
                    {row.cluster_started ? timezoneUtils.formatDateTime(row.cluster_started) : "—"}
                  </td>
                  <td className="px-3 py-3 text-ink">
                    {formatDuration(row.cluster_duration_seconds)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex flex-wrap items-center gap-2" aria-label={`OK ${row.violet_count}, failed ${row.ember_count}, verified ${row.teal_count}`}>
                      <span className="inline-flex items-center gap-1 text-sm text-ink" title="OK">
                        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
                        {row.violet_count}
                        <span className="sr-only">OK</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-ink" title="Failed auth">
                        <span className="h-2 w-2 rounded-full bg-ember" aria-hidden />
                        {row.ember_count}
                        <span className="sr-only">failed auth</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-ink" title="Verified">
                        <span className="h-2 w-2 rounded-full bg-aurora" aria-hidden />
                        {row.teal_count}
                        <span className="sr-only">verified</span>
                      </span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function UserAnalytics() {
  const navigate = useNavigate();
  const [scope, setScope] = useState("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [locationsData, setLocationsData] = useState(null);
  const [timeseriesData, setTimeseriesData] = useState(null);
  const [sessionsData, setSessionsData] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [textFilter, setTextFilter] = useState("");
  const [sortKey, setSortKey] = useState("cluster_started");
  const [sortDir, setSortDir] = useState("desc");

  const load = useCallback(async (nextScope, { quiet, ip } = {}) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const accessRes = await fetch("/api/admin/access-check", {
        method: "GET",
        credentials: "include",
      });
      const access = await accessRes.json().catch(() => ({}));
      if (!accessRes.ok || !access.allowed) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      setAccessDenied(false);
      const data = await fetchAllAnalytics(nextScope, ip || null);
      setLocationsData(data.locations);
      setTimeseriesData(data.timeseries);
      setSessionsData(data.sessions);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(scope, { ip: selectedLocation?.ip });
    // Scope changes reload everything; location filter handled separately for timeseries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, load]);

  // When globe filter changes, refetch timeseries for that IP only (keep locations/sessions)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!locationsData) return;
      try {
        const ts = await fetchAnalyticsTimeseries(scope, selectedLocation?.ip || null);
        if (!cancelled) setTimeseriesData(ts);
      } catch {
        /* keep previous chart on soft failure */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation?.ip]);

  // Poll in Today scope for recent-activity flares
  useEffect(() => {
    if (scope !== "today") return undefined;
    const id = setInterval(
      () => load("today", { quiet: true, ip: selectedLocation?.ip }),
      POLL_MS
    );
    return () => clearInterval(id);
  }, [scope, load, selectedLocation?.ip]);

  const handleScopeChange = (next) => {
    setSelectedLocation(null);
    setScope(next);
  };

  const handleSelectLocation = (loc) => {
    if (!loc) {
      setSelectedLocation(null);
      return;
    }
    setSelectedLocation((prev) => (prev?.ip === loc.ip ? null : loc));
  };

  const handleSort = (field) => {
    if (sortKey === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(field);
      setSortDir(field === "cluster_started" ? "desc" : "asc");
    }
  };

  const summary = locationsData?.summary;
  const localBucket = locationsData?.local;
  const locations = locationsData?.locations || [];

    const filteredStats = useMemo(() => {
    if (!selectedLocation) {
      return {
        totalLocations: summary?.total_locations ?? 0,
        totalRequests: summary?.total_requests ?? 0,
        activeClusters: summary?.active_clusters ?? 0,
        failedAuthRate: summary?.failed_auth_rate ?? 0,
        avgResponseTimeMs: summary?.avg_response_time_ms ?? 0,
      };
    }
    const sessionsForIp = (sessionsData?.sessions || []).filter((s) => s.ip === selectedLocation.ip);
    const failed = selectedLocation.failed_auth_count || 0;
    const reqs = selectedLocation.requests || 0;
    return {
      totalLocations: 1,
      totalRequests: reqs,
      activeClusters: sessionsForIp.length,
      failedAuthRate: reqs === 0 ? 0 : failed / reqs,
      avgResponseTimeMs: selectedLocation.avg_response_time_ms ?? summary?.avg_response_time_ms ?? 0,
    };
  }, [selectedLocation, summary, sessionsData]);

  const filteredLabel = selectedLocation
    ? `${selectedLocation.city}, ${selectedLocation.country}`
    : "";

  // Chart: when filtered, we keep full timeseries (server has no per-IP series) but note the filter;
  // table and stats update. Spec: "filters the stat cards, chart, and table" — for chart we
  // approximate by scaling isn't honest; better show full series with a note, OR empty when
  // filtered. Spec says they stay in sync — I'll show sessions-derived bucket if we can't.
  // Simplest honest approach: keep global timeseries, filter chip explains location filter on table/stats.

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="dash-panel p-8">
          <FiShield className="mx-auto h-10 w-10 text-ember" aria-hidden />
          <h1 className="font-display mt-4 text-2xl font-bold text-ink">Access denied</h1>
          <p className="mt-2 text-base text-dusk">
            User Analytics requires admin or owner privileges — the same gate as API Logs.
          </p>
          <button type="button" className="btn-brand mt-6" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter min-h-screen bg-deep pb-16 text-paper">
      <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* Header + scope */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4 sm:mb-6">
          <div>
            <p className="section-kicker text-dusk-soft">Observatory</p>
            <h1 className="font-display text-3xl font-bold text-paper sm:text-4xl">User Analytics</h1>
            <p className="mt-1 max-w-prose text-base text-dusk-soft">
              Live traffic from API logs on a globe — {locationsData?.scope_label || "…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ScopeToggle scope={scope} onChange={handleScopeChange} disabled={loading} />
            <button
              type="button"
              onClick={() => load(scope)}
              className="inline-flex items-center gap-2 rounded-xl border border-paper/20 bg-deep-soft px-4 py-2.5 text-base font-medium text-paper outline-none ring-brand transition hover:bg-paper/10 focus-visible:ring-2"
              aria-label="Refresh analytics"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          </div>
        </header>

        {selectedLocation ? (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setSelectedLocation(null)}
              className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/15 px-4 py-2 text-base text-paper outline-none ring-brand focus-visible:ring-2"
            >
              Filtered: {filteredLabel}
              <FiX className="h-4 w-4" aria-hidden />
              <span className="sr-only">Clear location filter</span>
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-ember/40 bg-ember-soft/20 p-4 text-paper">
            <FiAlertTriangle className="mt-0.5 h-5 w-5 text-ember" aria-hidden />
            <div>
              <p className="font-semibold">Could not load analytics</p>
              <p className="mt-1 text-base text-dusk-soft">{error}</p>
            </div>
          </div>
        ) : null}

        {/* Globe hero — full-bleed indigo, not a boxed card */}
        <section className="relative -mx-3 overflow-hidden sm:-mx-6 lg:-mx-8" aria-label="Traffic globe">
          {localBucket && localBucket.requests > 0 ? (
            <div className="absolute left-4 top-4 z-20 sm:left-8">
              <div className="inline-flex items-center gap-2 rounded-xl border border-ceremonial/40 bg-deep-soft/95 px-3 py-2 text-base text-paper shadow-soft">
                <FiServer className="h-4 w-4 text-ceremonial" aria-hidden />
                <span>
                  Local / Internal · {localBucket.requests} requests
                  {localBucket.unique_emails > 0 ? ` · ${localBucket.unique_emails} users` : ""}
                </span>
              </div>
            </div>
          ) : null}
          {loading && !locationsData ? (
            <div className="flex min-h-[420px] items-center justify-center bg-deep">
              <FiRefreshCw className="h-8 w-8 animate-spin text-brand" aria-hidden />
              <span className="sr-only">Loading globe</span>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex min-h-[420px] items-center justify-center bg-deep">
                  <FiRefreshCw className="h-8 w-8 animate-spin text-brand" aria-hidden />
                </div>
              }
            >
              <AnalyticsGlobe
                locations={locations}
                scope={scope}
                selectedIp={selectedLocation?.ip || null}
                onSelectLocation={handleSelectLocation}
              />
            </Suspense>
          )}
        </section>

        {/* Ivory content band */}
        <div className="relative z-10 -mt-2 space-y-5 rounded-t-3xl bg-frost-mesh px-1 pt-6 sm:px-2">
          <section aria-label="Summary statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="Total Locations"
              value={filteredStats.totalLocations.toLocaleString()}
              icon={FiGlobe}
            />
            <StatCard
              label="Total Requests"
              value={filteredStats.totalRequests.toLocaleString()}
              icon={FiActivity}
            />
            <StatCard
              label="Active Clusters"
              value={filteredStats.activeClusters.toLocaleString()}
              icon={FiLayers}
            />
            <StatCard
              label="Failed-Auth Rate"
              value={formatRate(filteredStats.failedAuthRate)}
              icon={FiShield}
              emberValue
              hint="401 / 403 responses"
            />
            <StatCard
              label="Avg Response Time"
              value={`${filteredStats.avgResponseTimeMs} ms`}
              icon={FiClock}
            />
          </section>

          <TimeseriesChart
            buckets={timeseriesData?.buckets || []}
            filterIp={selectedLocation?.ip}
            filteredLabel={filteredLabel}
          />

          <SessionsTable
            sessions={sessionsData?.sessions || []}
            filterIp={selectedLocation?.ip}
            textFilter={textFilter}
            onTextFilterChange={setTextFilter}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>
      </div>
    </div>
  );
}
