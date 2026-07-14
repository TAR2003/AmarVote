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
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiGlobe,
  FiLayers,
  FiMaximize2,
  FiMinimize2,
  FiRefreshCw,
  FiSearch,
  FiServer,
  FiShield,
  FiX,
} from "react-icons/fi";
import { fetchAllAnalytics, fetchAnalyticsTimeseries } from "../utils/analyticsApi";
import { timezoneUtils } from "../utils/timezoneUtils";
import { colorForLocation } from "../components/analytics/markerColors";

const AnalyticsGlobe = lazy(() => import("../components/analytics/AnalyticsGlobe"));

const POLL_MS = 60_000;

function formatRate(rate) {
  if (rate == null) return "0%";
  return `${(rate * 100).toFixed(1)}%`;
}

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ScopeToggle({ scope, onChange, disabled, rangeFrom, rangeTo, onRangeChange, onApplyRange }) {
  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <div
        className="inline-flex flex-wrap rounded-full bg-deep p-1 shadow-soft"
        role="tablist"
        aria-label="Time scope"
      >
        {[
          { id: "today", label: "Today" },
          { id: "all", label: "All Time" },
          { id: "range", label: "Custom" },
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
              className={`rounded-full px-4 py-2.5 text-base font-semibold outline-none transition-colors duration-200 ring-brand focus-visible:ring-2 disabled:opacity-50 sm:px-5 ${
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

      {scope === "range" ? (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-paper/15 bg-deep-soft/90 p-3">
          <label className="flex flex-col gap-1 text-sm text-dusk-soft">
            From
            <input
              type="date"
              value={rangeFrom}
              max={rangeTo || isoToday()}
              onChange={(e) => onRangeChange({ from: e.target.value, to: rangeTo })}
              className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-base text-ink outline-none ring-brand focus-visible:ring-2"
              disabled={disabled}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-dusk-soft">
            To
            <input
              type="date"
              value={rangeTo}
              min={rangeFrom || undefined}
              max={isoToday()}
              onChange={(e) => onRangeChange({ from: rangeFrom, to: e.target.value })}
              className="rounded-xl border border-ink/10 bg-paper px-3 py-2 text-base text-ink outline-none ring-brand focus-visible:ring-2"
              disabled={disabled}
            />
          </label>
          <button
            type="button"
            onClick={onApplyRange}
            disabled={disabled || !rangeFrom || !rangeTo}
            className="rounded-xl bg-brand-dark px-4 py-2.5 text-base font-semibold text-paper outline-none ring-brand transition hover:bg-brand disabled:opacity-50 focus-visible:ring-2"
          >
            Apply range
          </button>
        </div>
      ) : null}
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

function LocationBreakdownTable({
  locations = [],
  localBucket = null,
  filterIp,
  textFilter,
  onTextFilterChange,
  sortKey,
  sortDir,
  onSort,
  selectedIp,
  onSelectLocation,
}) {
  const rows = useMemo(() => {
    const mapped = (locations || []).map((loc) => {
      const success = loc.success_count ?? Math.max((loc.requests || 0) - (loc.failed_auth_count || 0), 0);
      const failed = loc.failed_auth_count || 0;
      const verified = loc.verified_events || 0;
      const unverified = Math.max(success - verified, 0);
      return {
        ...loc,
        success,
        failed,
        verified,
        unverified,
        locationLabel: `${loc.city || "Unknown"}, ${loc.country || "Unknown"}`,
        region: loc.region || "",
        isp: loc.isp || "",
        isLocal: false,
      };
    });

    if (localBucket && localBucket.requests > 0) {
      const success =
        localBucket.success_count ??
        Math.max((localBucket.requests || 0) - (localBucket.failed_auth_count || 0), 0);
      const failed = localBucket.failed_auth_count || 0;
      const verified = localBucket.verified_events || 0;
      mapped.push({
        ip: "local",
        city: "Local / Internal",
        country: "—",
        requests: localBucket.requests || 0,
        unique_emails: localBucket.unique_emails || 0,
        emails: localBucket.emails || [],
        last_seen: localBucket.last_seen,
        success,
        failed,
        verified,
        unverified: Math.max(success - verified, 0),
        locationLabel: "Local / Internal",
        isLocal: true,
        lat: null,
        lon: null,
      });
    }

    let filtered = mapped;
    if (filterIp) {
      filtered = filtered.filter((r) => r.ip === filterIp);
    }
    const q = (textFilter || "").trim().toLowerCase();
    if (q) {
          filtered = filtered.filter((r) => {
        const emails = (r.emails || []).join(" ").toLowerCase();
        return (
          (r.ip || "").toLowerCase().includes(q) ||
          (r.locationLabel || "").toLowerCase().includes(q) ||
          (r.region || "").toLowerCase().includes(q) ||
          (r.isp || "").toLowerCase().includes(q) ||
          emails.includes(q)
        );
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [locations, localBucket, filterIp, textFilter, sortKey, sortDir]);

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
    <section className="dash-panel overflow-hidden" aria-labelledby="locations-breakdown-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 p-4 sm:p-6">
        <div>
          <p className="section-kicker">Locations</p>
          <h2
            id="locations-breakdown-heading"
            className="font-display text-xl font-semibold text-ink sm:text-2xl"
          >
            Location breakdown
          </h2>
          <p className="mt-1 max-w-prose text-base text-dusk">
            Per-IP success, failed auth, and verified crypto/auth activity. Sort by any column; click a row to filter the globe and chart.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dusk" aria-hidden />
          <input
            type="search"
            value={textFilter}
            onChange={(e) => onTextFilterChange(e.target.value)}
            placeholder="Filter by city, country, IP, or email"
            className="w-full rounded-xl border border-ink/15 bg-paper py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-dusk outline-none ring-brand focus-visible:ring-2"
            aria-label="Filter locations"
          />
        </div>
      </div>

      <div
        className="flex flex-wrap gap-4 border-b border-ink/10 px-4 py-3 text-base text-dusk sm:px-6"
        aria-label="Metric legend"
      >
        <span className="inline-flex items-center gap-2">
          <FiCheckCircle className="h-4 w-4 text-brand" aria-hidden />
          Successful = non–failed-auth requests
        </span>
        <span className="inline-flex items-center gap-2">
          <FiShield className="h-4 w-4 text-ember" aria-hidden />
          Failed = 401 / 403 auth failures
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-aurora" aria-hidden />
          Verified = cast ballot / key ceremony / MFA
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
          Other success = successful but not verified
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink/10 text-base">
          <thead className="bg-frost/60">
            <tr>
              <SortTh field="locationLabel">Location</SortTh>
              <SortTh field="ip">IP</SortTh>
              <SortTh field="requests">Total</SortTh>
              <SortTh field="success">Successful</SortTh>
              <SortTh field="failed">Failed auth</SortTh>
              <SortTh field="verified">Verified</SortTh>
              <SortTh field="unverified">Other success</SortTh>
              <SortTh field="unique_emails">Users</SortTh>
              <SortTh field="last_seen">Last seen</SortTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-dusk">
                  No locations match this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const selected = selectedIp === row.ip;
                return (
                  <tr
                    key={row.ip}
                    className={`cursor-pointer transition-colors duration-150 ${
                      selected ? "bg-brand/10" : "hover:bg-frost/40"
                    }`}
                    onClick={() => {
                      if (row.isLocal) return;
                      onSelectLocation?.(row);
                    }}
                    onKeyDown={(e) => {
                      if (row.isLocal) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectLocation?.(row);
                      }
                    }}
                    tabIndex={row.isLocal ? undefined : 0}
                    aria-selected={selected}
                  >
                    <td className="px-3 py-3 text-ink">
                      {row.isLocal ? (
                        <span className="inline-flex items-center gap-1.5">
                          <FiServer className="h-4 w-4 text-ceremonial" aria-hidden />
                          Local / Internal
                        </span>
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: colorForLocation(row) }}
                              aria-hidden
                            />
                            {row.locationLabel}
                          </span>
                          {(row.region || row.isp) ? (
                            <span className="pl-4 text-sm text-dusk">
                              {[row.region, row.isp].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {row.isLocal ? (
                        <span className="text-dusk">—</span>
                      ) : (
                        <span className="inline-block rounded-md bg-frost px-2 py-1 font-mono text-sm text-ink">
                          {row.ip}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink">{row.requests.toLocaleString()}</td>
                    <td className="px-3 py-3 text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        <FiCheckCircle className="h-4 w-4 text-brand" aria-hidden />
                        {row.success.toLocaleString()}
                        <span className="sr-only">successful</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        <FiShield className="h-4 w-4 text-ember" aria-hidden />
                        <span className={row.failed > 0 ? "text-ember font-semibold" : ""}>
                          {row.failed.toLocaleString()}
                        </span>
                        <span className="sr-only">failed auth</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-aurora" aria-hidden />
                        {row.verified.toLocaleString()}
                        <span className="sr-only">verified</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
                        {row.unverified.toLocaleString()}
                        <span className="sr-only">other successful</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink">{(row.unique_emails || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-ink whitespace-nowrap">
                      {row.last_seen ? timezoneUtils.formatDateTime(row.last_seen) : "—"}
                    </td>
                  </tr>
                );
              })
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
  const [rangeFrom, setRangeFrom] = useState(() => isoDaysAgo(7));
  const [rangeTo, setRangeTo] = useState(() => isoToday());
  const [appliedRange, setAppliedRange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [locationsData, setLocationsData] = useState(null);
  const [timeseriesData, setTimeseriesData] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [textFilter, setTextFilter] = useState("");
  const [sortKey, setSortKey] = useState("success");
  const [sortDir, setSortDir] = useState("desc");
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [spinEnabled, setSpinEnabled] = useState(true);

  const queryOpts = useMemo(() => {
    if (scope === "range" && appliedRange?.from && appliedRange?.to) {
      return { scope: "range", from: appliedRange.from, to: appliedRange.to };
    }
    return { scope: scope === "range" ? "today" : scope };
  }, [scope, appliedRange]);

  const load = useCallback(async (opts, { quiet, ip } = {}) => {
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
      const data = await fetchAllAnalytics({ ...opts, ip: ip || null });
      setLocationsData(data.locations);
      setTimeseriesData(data.timeseries);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (scope === "range" && !appliedRange) return;
    load(queryOpts, { ip: selectedLocation?.ip });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryOpts, load]);

  // When globe filter changes, refetch timeseries for that IP only (keep locations/sessions)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!locationsData) return;
      try {
        const ts = await fetchAnalyticsTimeseries({
          ...queryOpts,
          ip: selectedLocation?.ip || null,
        });
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
      () => load({ scope: "today" }, { quiet: true, ip: selectedLocation?.ip }),
      POLL_MS
    );
    return () => clearInterval(id);
  }, [scope, load, selectedLocation?.ip]);

  const handleScopeChange = (next) => {
    setSelectedLocation(null);
    setScope(next);
    if (next === "range" && !appliedRange) {
      // Wait for Apply — do not auto-fetch until user confirms dates
      return;
    }
    if (next !== "range") {
      setAppliedRange(null);
    }
  };

  const handleApplyRange = () => {
    if (!rangeFrom || !rangeTo) return;
    let from = rangeFrom;
    let to = rangeTo;
    if (from > to) {
      from = rangeTo;
      to = rangeFrom;
      setRangeFrom(from);
      setRangeTo(to);
    }
    setSelectedLocation(null);
    setAppliedRange({ from, to });
    setScope("range");
  };

  const handleSelectLocation = (loc) => {
    if (!loc) {
      setSelectedLocation(null);
      return;
    }
    // Maps-style: click always opens the place card (does not toggle closed)
    setSelectedLocation(loc);
  };

  const handleUserInteract = useCallback(() => {
    setSpinEnabled(false);
  }, []);

  const handleSort = (field) => {
    if (sortKey === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(field);
      setSortDir("desc");
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
        thirdLabel: "Active Clusters",
      };
    }
    const failed = selectedLocation.failed_auth_count || 0;
    const reqs = selectedLocation.requests || 0;
    return {
      totalLocations: 1,
      totalRequests: reqs,
      activeClusters: selectedLocation.unique_emails || 0,
      failedAuthRate: reqs === 0 ? 0 : failed / reqs,
      avgResponseTimeMs: selectedLocation.avg_response_time_ms ?? summary?.avg_response_time_ms ?? 0,
      thirdLabel: "Unique Users",
    };
  }, [selectedLocation, summary]);

  const filteredLabel = selectedLocation
    ? `${selectedLocation.city}, ${selectedLocation.country}`
    : "";

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
    <div className="relative h-full w-full overflow-hidden bg-deep text-paper">
      {/* Full-bleed globe */}
      <div className="absolute inset-0">
        {loading && !locationsData ? (
          <div className="flex h-full items-center justify-center">
            <FiRefreshCw className="h-8 w-8 animate-spin text-brand" aria-hidden />
            <span className="sr-only">Loading map</span>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <FiRefreshCw className="h-8 w-8 animate-spin text-brand" aria-hidden />
              </div>
            }
          >
            <AnalyticsGlobe
              locations={locations}
              scope={scope}
              selectedIp={selectedLocation?.ip || null}
              onSelectLocation={handleSelectLocation}
              onUserInteract={handleUserInteract}
              spinEnabled={spinEnabled}
            />
          </Suspense>
        )}
      </div>

      {/* Top chrome — Maps-like floating controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-md rounded-2xl border border-paper/15 bg-deep/90 px-4 py-3 shadow-lift backdrop-blur-md">
            <p className="section-kicker text-dusk-soft">Observatory</p>
            <h1 className="font-display text-2xl font-bold text-paper sm:text-3xl">User Analytics</h1>
            <p className="mt-0.5 text-base text-dusk-soft">{locationsData?.scope_label || "Loading…"}</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="rounded-2xl border border-paper/15 bg-deep/90 p-2 shadow-lift backdrop-blur-md">
              <ScopeToggle
                scope={scope}
                onChange={handleScopeChange}
                disabled={loading}
                rangeFrom={rangeFrom}
                rangeTo={rangeTo}
                onRangeChange={({ from, to }) => {
                  setRangeFrom(from);
                  setRangeTo(to);
                }}
                onApplyRange={handleApplyRange}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setSpinEnabled((v) => !v)}
                className="rounded-xl border border-paper/20 bg-deep/90 px-3 py-2 text-base text-paper outline-none ring-brand backdrop-blur-md focus-visible:ring-2"
                aria-pressed={spinEnabled}
              >
                {spinEnabled ? "Pause spin" : "Spin globe"}
              </button>
              <button
                type="button"
                onClick={() => load(queryOpts)}
                className="inline-flex items-center gap-2 rounded-xl border border-paper/20 bg-deep/90 px-3 py-2 text-base text-paper outline-none ring-brand backdrop-blur-md focus-visible:ring-2"
                aria-label="Refresh analytics"
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setInsightsOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-dark px-3 py-2 text-base font-semibold text-paper outline-none ring-brand focus-visible:ring-2"
                aria-expanded={insightsOpen}
              >
                {insightsOpen ? <FiMinimize2 className="h-4 w-4" aria-hidden /> : <FiMaximize2 className="h-4 w-4" aria-hidden />}
                Insights
                {insightsOpen ? <FiChevronDown className="h-4 w-4" aria-hidden /> : <FiChevronUp className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="pointer-events-auto mt-3 max-w-lg rounded-2xl border border-ember/40 bg-ember-soft/90 p-3 text-ink shadow-lift">
            <p className="font-semibold">Could not load analytics</p>
            <p className="mt-1 text-base text-dusk">{error}</p>
          </div>
        ) : null}

        {localBucket && localBucket.requests > 0 ? (
          <div className="pointer-events-auto mt-3 inline-flex items-center gap-2 rounded-xl border border-ceremonial/40 bg-deep/90 px-3 py-2 text-base text-paper shadow-soft backdrop-blur-md">
            <FiServer className="h-4 w-4 text-ceremonial" aria-hidden />
            Local / Internal · {localBucket.requests} requests
            {localBucket.unique_emails > 0 ? ` · ${localBucket.unique_emails} users` : ""}
          </div>
        ) : null}
      </div>

      {/* Place card — Google Maps style */}
      {selectedLocation ? (
        <aside
          className="absolute right-3 top-28 z-40 w-[min(100%-1.5rem,22rem)] overflow-hidden rounded-2xl border border-ink/10 bg-paper text-ink shadow-lift sm:right-4 sm:top-32"
          aria-label="Selected location"
        >
          <div className="flex items-start justify-between gap-2 border-b border-ink/10 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-display text-lg font-semibold">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: colorForLocation(selectedLocation) }}
                  aria-hidden
                />
                <span className="truncate">
                  {selectedLocation.city}, {selectedLocation.country}
                </span>
              </p>
              {(selectedLocation.region || selectedLocation.isp) ? (
                <p className="mt-0.5 truncate text-sm text-dusk">
                  {[selectedLocation.region, selectedLocation.isp].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSelectedLocation(null)}
              className="rounded-lg p-1.5 text-dusk outline-none ring-brand hover:bg-frost hover:text-ink focus-visible:ring-2"
              aria-label="Close location card"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-3 px-4 py-3 text-base">
            <div className="flex justify-between gap-3">
              <span className="text-dusk">IP</span>
              <span className="rounded-md bg-frost px-2 py-0.5 font-mono text-sm">{selectedLocation.ip}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-dusk">Requests</span>
              <span className="font-semibold">{(selectedLocation.requests || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-dusk">
                <FiCheckCircle className="h-4 w-4 text-brand" aria-hidden />
                Successful
              </span>
              <span>
                {(
                  selectedLocation.success_count ??
                  Math.max((selectedLocation.requests || 0) - (selectedLocation.failed_auth_count || 0), 0)
                ).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-dusk">
                <FiShield className="h-4 w-4 text-ember" aria-hidden />
                Failed auth
              </span>
              <span className={selectedLocation.failed_auth_count > 0 ? "font-semibold text-ember" : ""}>
                {(selectedLocation.failed_auth_count || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-dusk">
                <span className="h-2.5 w-2.5 rounded-full bg-aurora" aria-hidden />
                Verified
              </span>
              <span>{(selectedLocation.verified_events || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-dusk">Unique users</span>
              <span>{(selectedLocation.unique_emails || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-ink/10 pt-3">
              <span className="text-dusk">Last seen</span>
              <span className="text-right text-sm">
                {selectedLocation.last_seen
                  ? timezoneUtils.formatDateTime(selectedLocation.last_seen)
                  : "—"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setInsightsOpen(true)}
              className="btn-brand mt-1 w-full"
            >
              Open insights for this location
            </button>
          </div>
        </aside>
      ) : null}

      {/* Insights drawer — minimized by default */}
      <div
        className={`absolute inset-x-0 bottom-0 z-40 transition-transform duration-200 ease-out ${
          insightsOpen ? "translate-y-0" : "translate-y-[calc(100%-3.25rem)]"
        }`}
      >
        <div className="mx-auto max-h-[min(72vh,760px)] overflow-hidden rounded-t-3xl border border-ink/10 bg-frost-mesh shadow-lift">
          <button
            type="button"
            onClick={() => setInsightsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 border-b border-ink/10 bg-paper px-4 py-3 text-left outline-none ring-brand focus-visible:ring-2"
            aria-expanded={insightsOpen}
          >
            <span className="font-display text-lg font-semibold text-ink">
              Insights
              {filteredLabel ? (
                <span className="ml-2 text-base font-sans font-normal text-dusk">· {filteredLabel}</span>
              ) : null}
            </span>
            <span className="inline-flex items-center gap-2 text-base text-dusk">
              {insightsOpen ? "Minimize" : "Expand"}
              {insightsOpen ? <FiChevronDown className="h-5 w-5" /> : <FiChevronUp className="h-5 w-5" />}
            </span>
          </button>

          {insightsOpen ? (
            <div className="max-h-[min(64vh,680px)] space-y-4 overflow-y-auto p-3 sm:p-4">
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
                  label={filteredStats.thirdLabel || "Active Clusters"}
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

              <LocationBreakdownTable
                locations={locations}
                localBucket={localBucket}
                filterIp={selectedLocation?.ip}
                textFilter={textFilter}
                onTextFilterChange={setTextFilter}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                selectedIp={selectedLocation?.ip}
                onSelectLocation={handleSelectLocation}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
