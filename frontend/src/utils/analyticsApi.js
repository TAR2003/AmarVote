/**
 * User Analytics API — read-only traffic endpoints.
 * Auth: cookie session; admin/owner only (same gate as API Logs).
 *
 * @param {{ scope?: string, from?: string, to?: string, ip?: string|null }} opts
 */
function buildQuery({ scope = "today", from, to, ip } = {}) {
  const params = new URLSearchParams({ scope });
  if (scope === "range") {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  if (ip) params.set("ip", ip);
  return params.toString();
}

export async function fetchAnalyticsLocations({ scope = "today", from, to } = {}) {
  const res = await fetch(`/api/analytics/locations?${buildQuery({ scope, from, to })}`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to load locations (${res.status})`);
  }
  return data;
}

export async function fetchAnalyticsTimeseries({ scope = "today", from, to, ip = null } = {}) {
  const res = await fetch(`/api/analytics/timeseries?${buildQuery({ scope, from, to, ip })}`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to load timeseries (${res.status})`);
  }
  return data;
}

/** Locations + timeseries only — sessions cluster table is not loaded on the analytics page. */
export async function fetchAllAnalytics({ scope = "today", from, to, ip = null } = {}) {
  const opts = { scope, from, to, ip };
  const [locations, timeseries] = await Promise.all([
    fetchAnalyticsLocations(opts),
    fetchAnalyticsTimeseries(opts),
  ]);
  return { locations, timeseries };
}
