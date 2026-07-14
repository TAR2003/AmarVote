import { feature } from "topojson-client";
import { saveAs } from "file-saver";
import { colorForLocation } from "../components/analytics/markerColors";

const WIDTH = 2400;
const HEIGHT = 1200;

function project(lon, lat) {
  return [((Number(lon) + 180) / 360) * WIDTH, ((90 - Number(lat)) / 180) * HEIGHT];
}

function circleRadius(requests, maxRequests) {
  const minR = 10;
  const maxR = 48;
  if (!requests || requests <= 0 || maxRequests <= 0) return minR;
  const t = Math.log10(requests + 1) / Math.log10(Math.max(maxRequests, 2) + 1);
  return minR + Math.min(1, Math.max(0, t)) * (maxR - minR);
}

function drawRing(ctx, ring) {
  ring.forEach((coord, i) => {
    const [x, y] = project(coord[0], coord[1]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawPolygonCoords(ctx, coordinates) {
  ctx.beginPath();
  coordinates.forEach((ring) => drawRing(ctx, ring));
  ctx.fill();
  ctx.stroke();
}

function drawGeometry(ctx, geometry) {
  if (!geometry) return;
  if (geometry.type === "Polygon") {
    drawPolygonCoords(ctx, geometry.coordinates);
    return;
  }
  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => drawPolygonCoords(ctx, polygon));
  }
}

function stampFilename(scopeLabel) {
  const stamp = new Date().toISOString().slice(0, 10);
  const scope = String(scopeLabel || "map")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `amarvote-analytics-map-${scope || "map"}-${stamp}.png`;
}

/**
 * Export a flat equirectangular world map PNG with location circles.
 * @param {{ locations?: Array, scopeLabel?: string }} opts
 */
export async function downloadAnalyticsMap({ locations = [], scopeLabel } = {}) {
  const plottable = (locations || []).filter(
    (l) => l?.lat != null && l?.lon != null && Number.isFinite(l.lat) && Number.isFinite(l.lon)
  );

  const res = await fetch("/globe/countries-110m.json");
  if (!res.ok) throw new Error("Failed to load world map data");
  const topo = await res.json();
  const countries = feature(topo, topo.objects.countries);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // Deep map plane — bright markers stay readable
  ctx.fillStyle = "#0B1026";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Soft latitude/longitude grid
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const [x] = project(lon, 0);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = project(0, lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#1E2A4A";
  ctx.strokeStyle = "#3A4D78";
  ctx.lineWidth = 1.25;
  for (const f of countries.features || []) {
    drawGeometry(ctx, f.geometry);
  }

  const maxRequests = plottable.reduce((m, l) => Math.max(m, l.requests || 0), 1);

  // Draw smaller first so large hotspots stay on top
  const ordered = [...plottable].sort((a, b) => (a.requests || 0) - (b.requests || 0));
  for (const loc of ordered) {
    const [x, y] = project(loc.lon, loc.lat);
    const r = circleRadius(loc.requests, maxRequests);
    const color = colorForLocation(loc);

    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(247,244,236,0.95)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Title bar
  ctx.fillStyle = "rgba(11,16,38,0.82)";
  ctx.fillRect(0, 0, WIDTH, 110);
  ctx.fillStyle = "#F7F4EC";
  ctx.font = "600 40px Fraunces, Georgia, serif";
  ctx.fillText("AmarVote · User Analytics", 48, 52);
  ctx.font = "500 24px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#A8B4D4";
  ctx.fillText(scopeLabel || "Traffic map", 48, 88);
  ctx.fillText(`${plottable.length} locations`, WIDTH - 280, 88);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode map PNG"))), "image/png");
  });

  saveAs(blob, stampFilename(scopeLabel));
}
