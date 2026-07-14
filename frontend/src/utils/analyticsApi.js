/**
 * User Analytics API — read-only traffic endpoints.
 * Auth: cookie session; admin/owner only (same gate as API Logs).
 */
export async function fetchAnalyticsLocations(scope = "today") {
  const res = await fetch(`/api/analytics/locations?scope=${encodeURIComponent(scope)}`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to load locations (${res.status})`);
  }
  return data;
}

export async function fetchAnalyticsTimeseries(scope = "today", ip = null) {
  const params = new URLSearchParams({ scope });
  if (ip) params.set("ip", ip);
  const res = await fetch(`/api/analytics/timeseries?${params}`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to load timeseries (${res.status})`);
  }
  return data;
}

export async function fetchAnalyticsSessions(scope = "today") {
  const res = await fetch(`/api/analytics/sessions?scope=${encodeURIComponent(scope)}`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to load sessions (${res.status})`);
  }
  return data;
}

export async function fetchAllAnalytics(scope = "today", ip = null) {
  const [locations, timeseries, sessions] = await Promise.all([
    fetchAnalyticsLocations(scope),
    fetchAnalyticsTimeseries(scope, ip),
    fetchAnalyticsSessions(scope),
  ]);
  return { locations, timeseries, sessions };
}
