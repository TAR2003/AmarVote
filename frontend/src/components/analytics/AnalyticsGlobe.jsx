import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";

const INDIGO = "#12142B";
const VIOLET = "#8B7FE8";
const TEAL = "#3FC7B8";
const IVORY = "#F7F4EC";
const INK = "#1B1D2E";
const MUTED_LIGHT = "#5B5D74";

const RECENT_MS = 5 * 60 * 1000;
const FLARE_DURATION_MS = 1800;
/** Typical default camera altitude for a full-earth view. */
const REF_ALTITUDE = 2.4;

/**
 * Relative size from request volume (kept constant across zoom).
 * Absolute on-screen size is then scaled by camera altitude so nearby
 * cities (Dhaka vs Rajshahi) separate when zoomed in.
 */
function relativeRadius(requests, maxRequests) {
  if (!requests || requests <= 0) return 0.22;
  const logMax = Math.log10(Math.max(maxRequests, 2));
  const logVal = Math.log10(requests + 1);
  return 0.22 + (logVal / logMax) * 1.15;
}

/** Shrink angular radius as the camera moves closer (altitude ↓). */
function zoomScale(altitude) {
  const a = Number.isFinite(altitude) ? altitude : REF_ALTITUDE;
  // floors keep dots clickable; ceiling avoids huge blobs when pulled way out
  return Math.min(1.35, Math.max(0.08, a / REF_ALTITUDE));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/**
 * 3D globe of traffic locations. Ambient rotation + Today-only flare for recent activity.
 * Point radius scales with camera altitude so relative volumes stay clear when zoomed in.
 */
export default function AnalyticsGlobe({
  locations = [],
  scope = "today",
  selectedIp = null,
  onSelectLocation,
  reducedMotionFallbackList = true,
}) {
  const globeRef = useRef(null);
  const containerRef = useRef(null);
  const altitudeRafRef = useRef(null);
  const [dims, setDims] = useState({ w: 640, h: 420 });
  const [hover, setHover] = useState(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(true);
  const [altitude, setAltitude] = useState(REF_ALTITUDE);
  const [flaringIps, setFlaringIps] = useState(() => new Set());
  const seenKeysRef = useRef(new Set());
  const prefersReduced = usePrefersReducedMotion();

  const plottable = useMemo(
    () =>
      (locations || []).filter(
        (l) => l.lat != null && l.lon != null && Number.isFinite(l.lat) && Number.isFinite(l.lon)
      ),
    [locations]
  );

  const maxRequests = useMemo(
    () => plottable.reduce((m, l) => Math.max(m, l.requests || 0), 1),
    [plottable]
  );

  const zScale = zoomScale(altitude);

  // Detect genuinely new recent activity in Today scope (not on every re-render of same data)
  useEffect(() => {
    if (scope !== "today" || prefersReduced) return undefined;

    const now = Date.now();
    const newlyFlaring = [];
    for (const loc of plottable) {
      if (!loc.last_seen) continue;
      const seenKey = `${loc.ip}|${loc.last_seen}`;
      if (seenKeysRef.current.has(seenKey)) continue;
      seenKeysRef.current.add(seenKey);
      const age = now - new Date(loc.last_seen).getTime();
      if (age >= 0 && age <= RECENT_MS) {
        newlyFlaring.push(loc.ip);
      }
    }
    if (newlyFlaring.length === 0) return undefined;

    setFlaringIps((prev) => {
      const next = new Set(prev);
      newlyFlaring.forEach((ip) => next.add(ip));
      return next;
    });
    const timer = setTimeout(() => {
      setFlaringIps((prev) => {
        const next = new Set(prev);
        newlyFlaring.forEach((ip) => next.delete(ip));
        return next;
      });
    }, FLARE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [plottable, scope, prefersReduced]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.max(320, width), h: Math.max(320, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return undefined;
    const controls = globe.controls?.();
    if (!controls) return undefined;

    controls.autoRotate = autoRotate && !prefersReduced;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = true;
    controls.minDistance = 120;
    controls.maxDistance = 800;

    const syncAltitude = () => {
      if (altitudeRafRef.current != null) return;
      altitudeRafRef.current = requestAnimationFrame(() => {
        altitudeRafRef.current = null;
        const pov = globe.pointOfView?.();
        if (pov?.altitude != null && Number.isFinite(pov.altitude)) {
          setAltitude((prev) => (Math.abs(prev - pov.altitude) > 0.01 ? pov.altitude : prev));
        }
      });
    };

    controls.addEventListener("change", syncAltitude);
    syncAltitude();
    return () => {
      controls.removeEventListener("change", syncAltitude);
      if (altitudeRafRef.current != null) {
        cancelAnimationFrame(altitudeRafRef.current);
        altitudeRafRef.current = null;
      }
    };
  }, [autoRotate, prefersReduced, dims]);

  const pointsData = useMemo(
    () =>
      plottable.map((loc) => {
        const flaring = flaringIps.has(loc.ip);
        const selected = selectedIp === loc.ip;
        const base = relativeRadius(loc.requests, maxRequests);
        return {
          ...loc,
          size: base * zScale * (flaring ? 1.45 : selected ? 1.2 : 1),
          altitude: flaring ? 0.03 : 0.008,
        };
      }),
    [plottable, maxRequests, flaringIps, selectedIp, zScale]
  );

  const ringsData = useMemo(
    () =>
      plottable
        .filter((l) => l.verified_events > 0)
        .map((l) => ({
          lat: l.lat,
          lon: l.lon,
          maxR: Math.max(0.35, 1.8 * zScale),
          propagationSpeed: prefersReduced ? 0 : 1.2,
          repeatPeriod: prefersReduced ? 0 : 1400,
        })),
    [plottable, prefersReduced, zScale]
  );

  const arcsData = useMemo(() => {
    if (scope !== "today" || prefersReduced) return [];
    return plottable
      .filter((l) => flaringIps.has(l.ip))
      .map((l) => ({
        startLat: l.lat,
        startLng: l.lon,
        endLat: Math.min(90, l.lat + 8),
        endLng: l.lon,
        color: [VIOLET, TEAL],
      }));
  }, [plottable, flaringIps, scope, prefersReduced]);

  const pauseRotation = useCallback(() => setAutoRotate(false), []);
  const resumeRotation = useCallback(() => {
    if (!prefersReduced) setAutoRotate(true);
  }, [prefersReduced]);

  const recentList = useMemo(() => {
    const now = Date.now();
    return plottable
      .filter((l) => l.last_seen && now - new Date(l.last_seen).getTime() <= RECENT_MS)
      .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
      .slice(0, 8);
  }, [plottable]);

  if (prefersReduced && reducedMotionFallbackList) {
    return (
      <div ref={containerRef} className="relative min-h-[320px] w-full">
        <div className="absolute inset-0 bg-deep" aria-hidden />
        <div className="relative z-10 p-4 sm:p-6">
          <p className="font-display text-lg font-semibold text-paper">Locations</p>
          <p className="mt-1 max-w-prose text-base text-dusk-soft">
            Motion reduced — select a location from the list. Same data as the globe view.
          </p>
          {scope === "today" && recentList.length > 0 ? (
            <div className="mt-4 rounded-xl border border-paper/15 bg-deep-soft/80 p-4">
              <p className="flex items-center gap-2 text-base font-semibold text-paper">
                <span className="inline-block h-2 w-2 rounded-full bg-aurora" aria-hidden />
                Recent activity
              </p>
              <ul className="mt-3 space-y-2">
                {recentList.map((loc) => (
                  <li key={loc.ip}>
                    <button
                      type="button"
                      onClick={() => onSelectLocation?.(loc)}
                      className="w-full rounded-lg px-3 py-2 text-left text-base text-paper outline-none ring-brand focus-visible:ring-2 hover:bg-paper/10"
                    >
                      {loc.city}, {loc.country} · {loc.requests} requests
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto" role="listbox" aria-label="Traffic locations">
            {pointsData.map((loc) => (
              <li key={loc.ip}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedIp === loc.ip}
                  onClick={() => onSelectLocation?.(loc)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-base outline-none ring-brand focus-visible:ring-2 ${
                    selectedIp === loc.ip ? "bg-brand/20 text-paper" : "text-dusk-soft hover:bg-paper/10 hover:text-paper"
                  }`}
                >
                  <span>
                    {loc.city}, {loc.country}
                    {loc.verified_events > 0 ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-sm text-aurora">
                        <span aria-hidden>●</span> Verified
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-sm text-dusk-soft">{loc.requests}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-[380px] w-full overflow-hidden sm:min-h-[480px]"
      onMouseLeave={() => {
        setHover(null);
        resumeRotation();
      }}
    >
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor={INDIGO}
        globeImageUrl="/globe/earth-night.jpg"
        bumpImageUrl="/globe/earth-topology.png"
        atmosphereColor={VIOLET}
        atmosphereAltitude={0.18}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lon"
        pointAltitude="altitude"
        pointRadius="size"
        pointColor={() => VIOLET}
        pointLabel={() => null}
        onPointHover={(p, event) => {
          setHover(p);
          if (p) {
            pauseRotation();
            if (event) setPointer({ x: event.clientX, y: event.clientY });
          } else {
            resumeRotation();
          }
        }}
        onPointClick={(p) => {
          if (p) onSelectLocation?.(p);
        }}
        onGlobeClick={() => resumeRotation()}
        ringsData={ringsData}
        ringColor={() => TEAL}
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={FLARE_DURATION_MS}
        arcAltitude={0.2}
        arcStroke={1.2}
      />

      <div className="absolute bottom-3 left-3 right-3 z-10 sm:left-auto sm:right-4 sm:w-72">
        <label htmlFor="globe-location-select" className="sr-only">
          Select location on globe
        </label>
        <select
          id="globe-location-select"
          className="w-full rounded-xl border border-paper/20 bg-deep-soft/95 px-3 py-2.5 text-base text-paper outline-none ring-brand focus-visible:ring-2"
          value={selectedIp || ""}
          onChange={(e) => {
            const ip = e.target.value;
            if (!ip) {
              onSelectLocation?.(null);
              return;
            }
            const loc = plottable.find((l) => l.ip === ip);
            if (loc) onSelectLocation?.(loc);
          }}
        >
          <option value="">All locations</option>
          {plottable.map((loc) => (
            <option key={loc.ip} value={loc.ip}>
              {loc.city}, {loc.country} ({loc.requests})
              {loc.verified_events > 0 ? " · verified" : ""}
            </option>
          ))}
        </select>
      </div>

      {hover ? (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-xl border border-ink/10 bg-paper p-3 shadow-lift"
          style={{
            left: Math.min(pointer.x + 12, window.innerWidth - 280),
            top: Math.min(pointer.y + 12, window.innerHeight - 160),
          }}
          role="tooltip"
        >
          <p className="font-display text-base font-semibold text-ink">
            {hover.city}, {hover.country}
          </p>
          {(hover.region || hover.isp) ? (
            <p className="mt-0.5 text-sm text-dusk">
              {[hover.region, hover.isp].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <dl className="mt-2 space-y-1 text-base text-ink">
            <div className="flex justify-between gap-4">
              <dt className="text-dusk">IP</dt>
              <dd className="font-mono text-sm">{hover.ip}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dusk">Requests</dt>
              <dd>{hover.requests}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dusk">Unique users</dt>
              <dd>{hover.unique_emails}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dusk">Last seen</dt>
              <dd className="text-right text-sm">{hover.last_seen ? new Date(hover.last_seen).toLocaleString() : "—"}</dd>
            </div>
            {hover.verified_events > 0 ? (
              <div className="flex items-center justify-between gap-4 border-t border-ink/10 pt-1">
                <dt className="flex items-center gap-1.5 text-dusk">
                  <span className="inline-block h-2 w-2 rounded-full bg-aurora" aria-hidden />
                  Verified events
                </dt>
                <dd className="font-semibold text-ink">{hover.verified_events}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <span className="sr-only" aria-hidden>
        {IVORY}
        {INK}
        {MUTED_LIGHT}
      </span>
    </div>
  );
}
