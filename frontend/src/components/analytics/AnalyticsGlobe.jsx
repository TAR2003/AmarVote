import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";
import { colorForLocation } from "./markerColors";

const INDIGO = "#12142B";
const TEAL = "#3FC7B8";
const PAPER = "#F7F4EC";

const RECENT_MS = 5 * 60 * 1000;
const FLARE_DURATION_MS = 1800;
const REF_ALTITUDE = 2.4;

function relativeRadius(requests, maxRequests) {
  if (!requests || requests <= 0) return 0.2;
  const logMax = Math.log10(Math.max(maxRequests, 2));
  const logVal = Math.log10(requests + 1);
  return 0.2 + (logVal / logMax) * 1.05;
}

function zoomScale(altitude) {
  const a = Number.isFinite(altitude) ? altitude : REF_ALTITUDE;
  return Math.min(1.35, Math.max(0.07, a / REF_ALTITUDE));
}

function roughCentroid(feat) {
  const coords = [];
  const walk = (c) => {
    if (!c) return;
    if (typeof c[0] === "number") {
      coords.push(c);
      return;
    }
    c.forEach(walk);
  };
  walk(feat?.geometry?.coordinates);
  if (!coords.length) return { lat: 0, lng: 0 };
  let lon = 0;
  let lat = 0;
  for (const [x, y] of coords) {
    lon += x;
    lat += y;
  }
  return { lat: lat / coords.length, lng: lon / coords.length };
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
 * Immersive traffic globe — political borders, named countries, multi-color markers.
 * Auto-rotation stops as soon as the user interacts (Maps-like explore mode).
 */
export default function AnalyticsGlobe({
  locations = [],
  scope = "today",
  selectedIp = null,
  onSelectLocation,
  onUserInteract,
  spinEnabled = false,
  reducedMotionFallbackList = true,
}) {
  const globeRef = useRef(null);
  const containerRef = useRef(null);
  const altitudeRafRef = useRef(null);
  const interactedRef = useRef(false);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [altitude, setAltitude] = useState(REF_ALTITUDE);
  const [countries, setCountries] = useState([]);
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
  const showCountryLabels = altitude < 1.55;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/globe/countries-110m.json");
        const topo = await res.json();
        const geo = feature(topo, topo.objects.countries);
        if (!cancelled) setCountries(geo.features || []);
      } catch {
        if (!cancelled) setCountries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      if (age >= 0 && age <= RECENT_MS) newlyFlaring.push(loc.ip);
    }
    if (!newlyFlaring.length) return undefined;
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
      setDims({ w: Math.max(320, Math.floor(width)), h: Math.max(320, Math.floor(height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const markInteracted = useCallback(() => {
    if (!interactedRef.current) {
      interactedRef.current = true;
      onUserInteract?.();
    }
  }, [onUserInteract]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return undefined;
    const controls = globe.controls?.();
    if (!controls) return undefined;

    controls.autoRotate = !!spinEnabled && !prefersReduced;
    controls.autoRotateSpeed = 0.32;
    controls.enableZoom = true;
    controls.minDistance = 110;
    controls.maxDistance = 900;

    const onChange = () => {
      markInteracted();
      if (altitudeRafRef.current != null) return;
      altitudeRafRef.current = requestAnimationFrame(() => {
        altitudeRafRef.current = null;
        const pov = globe.pointOfView?.();
        if (pov?.altitude != null && Number.isFinite(pov.altitude)) {
          setAltitude((prev) => (Math.abs(prev - pov.altitude) > 0.008 ? pov.altitude : prev));
        }
      });
    };

    controls.addEventListener("change", onChange);
    controls.addEventListener("start", markInteracted);
    onChange();
    return () => {
      controls.removeEventListener("change", onChange);
      controls.removeEventListener("start", markInteracted);
      if (altitudeRafRef.current != null) cancelAnimationFrame(altitudeRafRef.current);
    };
  }, [spinEnabled, prefersReduced, dims, markInteracted]);

  // Keep controls.autoRotate in sync when spinEnabled flips
  useEffect(() => {
    const globe = globeRef.current;
    const controls = globe?.controls?.();
    if (!controls) return;
    controls.autoRotate = !!spinEnabled && !prefersReduced;
  }, [spinEnabled, prefersReduced]);

  // Fly to selected location (Maps-like)
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !selectedIp) return;
    const loc = plottable.find((l) => l.ip === selectedIp);
    if (!loc) return;
    markInteracted();
    globe.pointOfView({ lat: loc.lat, lng: loc.lon, altitude: Math.min(altitude, 0.85) }, 900);
  }, [selectedIp]); // eslint-disable-line react-hooks/exhaustive-deps

  const pointsData = useMemo(
    () =>
      plottable.map((loc) => {
        const flaring = flaringIps.has(loc.ip);
        const selected = selectedIp === loc.ip;
        const base = relativeRadius(loc.requests, maxRequests);
        return {
          ...loc,
          color: colorForLocation(loc),
          size: base * zScale * (flaring ? 1.4 : selected ? 1.25 : 1),
          altitude: flaring ? 0.03 : selected ? 0.018 : 0.008,
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
          maxR: Math.max(0.3, 1.6 * zScale),
          propagationSpeed: prefersReduced ? 0 : 1.1,
          repeatPeriod: prefersReduced ? 0 : 1500,
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
        endLat: Math.min(90, l.lat + 6),
        endLng: l.lon,
        color: [colorForLocation(l), TEAL],
      }));
  }, [plottable, flaringIps, scope, prefersReduced]);

  const labelsData = useMemo(() => {
    if (!showCountryLabels || !countries.length) return [];
    return countries
      .map((f) => {
        const name = f.properties?.name;
        if (!name) return null;
        const c = roughCentroid(f);
        return { ...c, name };
      })
      .filter(Boolean);
  }, [countries, showCountryLabels]);

  if (prefersReduced && reducedMotionFallbackList) {
    return (
      <div ref={containerRef} className="relative h-full min-h-[320px] w-full bg-deep">
        <div className="relative z-10 h-full overflow-y-auto p-4 sm:p-6">
          <p className="font-display text-lg font-semibold text-paper">Locations</p>
          <p className="mt-1 max-w-prose text-base text-dusk-soft">
            Motion reduced — pick a location from the list.
          </p>
          <ul className="mt-4 space-y-1" role="listbox" aria-label="Traffic locations">
            {plottable.map((loc) => (
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
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorForLocation(loc) }} aria-hidden />
                    {loc.city}, {loc.country}
                  </span>
                  <span className="font-mono text-sm">{loc.requests}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full min-h-[320px] w-full">
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor={INDIGO}
        globeImageUrl="/globe/earth-blue-marble.jpg"
        bumpImageUrl="/globe/earth-topology.png"
        atmosphereColor="#8B7FE8"
        atmosphereAltitude={0.16}
        polygonsData={countries}
        polygonAltitude={0.004}
        polygonCapColor={() => "rgba(18, 20, 43, 0.05)"}
        polygonSideColor={() => "rgba(18, 20, 43, 0.15)"}
        polygonStrokeColor={() => "rgba(247, 244, 236, 0.45)"}
        polygonsTransitionDuration={0}
        labelsData={labelsData}
        labelLat="lat"
        labelLng="lng"
        labelText="name"
        labelSize={() => Math.max(0.35, 0.9 * zScale)}
        labelDotRadius={0}
        labelColor={() => "rgba(247, 244, 236, 0.88)"}
        labelAltitude={0.012}
        labelResolution={2}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lon"
        pointAltitude="altitude"
        pointRadius="size"
        pointColor="color"
        pointLabel={() => null}
        onPointHover={(p, event) => {
          setHover(p);
          if (p) {
            markInteracted();
            if (event) setPointer({ x: event.clientX, y: event.clientY });
          }
        }}
        onPointClick={(p) => {
          markInteracted();
          if (p) onSelectLocation?.(p);
        }}
        onGlobeClick={() => markInteracted()}
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
        arcAltitude={0.18}
        arcStroke={1.1}
      />

      {hover ? (
        <div
          className="pointer-events-none fixed z-[60] max-w-xs rounded-xl border border-ink/10 bg-paper p-3 shadow-lift"
          style={{
            left: Math.min(pointer.x + 14, window.innerWidth - 280),
            top: Math.min(pointer.y + 14, window.innerHeight - 180),
          }}
          role="tooltip"
        >
          <p className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorForLocation(hover) }} aria-hidden />
            {hover.city}, {hover.country}
          </p>
          {(hover.region || hover.isp) ? (
            <p className="mt-0.5 text-sm text-dusk">{[hover.region, hover.isp].filter(Boolean).join(" · ")}</p>
          ) : null}
          <p className="mt-2 text-base text-ink">{hover.requests} requests · {hover.unique_emails} users</p>
          <p className="mt-1 text-sm text-dusk">Click to open details</p>
        </div>
      ) : null}

      <span className="sr-only" aria-hidden>{PAPER}</span>
    </div>
  );
}
