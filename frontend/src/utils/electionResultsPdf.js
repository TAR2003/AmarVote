import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatOrdinal, isWinnerByRank } from './electionRankings';

/**
 * AmarVote — Official Election Results report (Ink & Indigo design system).
 *
 * Flowing, page-break-aware document:
 *   • Page 1  — Cover: indigo header band, wrapped title, winners + photos, stats
 *   • Page 2  — Election Overview: metadata, guardian quorum viz, guardian table
 *   • Page 3+ — Visual Analytics: violet/teal/gold charts with photo legends
 *   • Page 4+ — Detailed Standings Ledger
 *
 * Charts rasterized at ~300 DPI; atomic blocks never split across pages.
 */

const CHART_SCALE = 4;

/** Ink & Indigo tokens — exact app palette, adapted for print. */
const C = {
  deep: [18, 20, 43],       // #12142B
  ink: [27, 29, 46],        // #1B1D2E
  paper: [247, 244, 236],   // #F7F4EC
  white: [255, 255, 255],
  brand: [139, 127, 232],   // #8B7FE8 Guardian Violet
  brandDark: [92, 82, 196], // #5C52C4
  brandSoft: [239, 235, 248], // #EFEBF8 glacier
  aurora: [63, 199, 184],   // #3FC7B8
  auroraSoft: [232, 247, 245],
  gold: [212, 165, 72],     // #D4A548 — winner accent only
  dusk: [91, 93, 116],      // #5B5D74
  lavender: [160, 162, 180],
  line: [226, 224, 216],
  lineSoft: [238, 235, 226],
  surface: [252, 250, 245],
};

const HEX = {
  deep: '#12142B',
  ink: '#1B1D2E',
  paper: '#F7F4EC',
  white: '#FFFFFF',
  brand: '#8B7FE8',
  brandDark: '#5C52C4',
  brandSoft: '#EFEBF8',
  aurora: '#3FC7B8',
  gold: '#D4A548',
  dusk: '#5B5D74',
  lavender: '#A0A2B4',
  line: '#E2E0D8',
  neutral: '#9B9DB0',
  neutralSoft: '#C5C6D4',
};

/** Chart series: violet primary, teal secondary, gold winners, lavender others. */
const SERIES_PRIMARY = HEX.brand;
const SERIES_PRIMARY_LIGHT = '#A89EF0';
const SERIES_SECONDARY = HEX.aurora;
const SERIES_WINNER = HEX.gold;
const SERIES_WINNER_LIGHT = '#E0C078';
const SERIES_NEUTRAL = [
  HEX.neutral, '#8E90A4', '#B0B2C0', '#7A7C90', HEX.neutralSoft,
  '#6E7084', '#A8AABC', '#9496A8', '#828496', '#BCBECC',
];

const FONT_SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_SERIF = 'Fraunces, Georgia, "Times New Roman", serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

const MARGIN = 16;
const FOOTER_RESERVE = 16;
const CANDIDATE_IMG_MM = 10;
const WINNER_IMG_MM = 16;

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

export function truncateChartLabel(name, maxLen = 16) {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(4, maxLen - 1))}…`;
}

function createHiDPICanvas(logicalW, logicalH, scale = CHART_SCALE) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalW * scale);
  canvas.height = Math.round(logicalH * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function canvasToPng(canvas) {
  return canvas.toDataURL('image/png', 1.0);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function roundRectTopPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, Math.max(h, 0.01));
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function fmtDate(value) {
  if (!value) return '—';
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function fmtNum(v) {
  if (v == null || v === '—') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-US');
}

function candidateInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function buildCandidateMetaMap(electionData) {
  const map = new Map();
  (electionData?.electionChoices || []).forEach((choice) => {
    map.set(choice.optionTitle, {
      title: choice.optionTitle,
      description: choice.optionDescription || '',
      candidatePic: choice.candidatePic || '',
    });
  });
  return map;
}

export function enrichRankedWithMeta(ranked, electionData) {
  const metaMap = buildCandidateMetaMap(electionData);
  return ranked.map((row) => ({
    ...row,
    description: metaMap.get(row.name)?.description || '',
    candidatePic: metaMap.get(row.name)?.candidatePic || '',
  }));
}

function imageFormatFromDataUrl(dataUrl) {
  if (!dataUrl) return 'JPEG';
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

async function fetchImageAsDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadImageElement(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Circular avatar with violet/teal ring; initials placeholder when no photo. */
async function renderCircularAvatar(dataUrl, name, sizePx = 128, ringColor = HEX.brand) {
  const { canvas, ctx } = createHiDPICanvas(sizePx, sizePx, 2);
  const cx = sizePx / 2;
  const cy = sizePx / 2;
  const ring = Math.max(2, sizePx * 0.045);
  const r = sizePx / 2 - ring;

  ctx.beginPath();
  ctx.arc(cx, cy, r + ring * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = ringColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = HEX.brandSoft;
  ctx.fill();

  if (dataUrl) {
    const img = await loadImageElement(dataUrl);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
      return canvasToPng(canvas);
    }
  }

  ctx.fillStyle = HEX.brandDark;
  ctx.font = `600 ${Math.round(sizePx * 0.32)}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(candidateInitials(name), cx, cy + 1);
  return canvasToPng(canvas);
}

async function attachCandidateImageData(enrichedRanked) {
  const uniqueUrls = [...new Set(enrichedRanked.map((row) => row.candidatePic).filter(Boolean))];
  const urlToData = new Map();

  await Promise.all(uniqueUrls.map(async (url) => {
    const dataUrl = await fetchImageAsDataUrl(url);
    if (dataUrl) urlToData.set(url, dataUrl);
  }));

  return Promise.all(enrichedRanked.map(async (row) => {
    const raw = row.candidatePic ? (urlToData.get(row.candidatePic) || null) : null;
    const avatar = await renderCircularAvatar(raw, row.name, 128, HEX.brand);
    return {
      ...row,
      candidatePicDataUrl: raw,
      avatarDataUrl: avatar,
    };
  }));
}

function drawPng(doc, dataUrl, x, y, size) {
  if (!dataUrl) return;
  try {
    doc.addImage(dataUrl, 'PNG', x, y, size, size, undefined, 'FAST');
  } catch {
    // ignore corrupt image
  }
}

/* ------------------------------------------------------------------ *
 * Rasterized backgrounds
 * ------------------------------------------------------------------ */

function renderHeaderBand(logicalW, logicalH) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH, 3);
  const g = ctx.createLinearGradient(0, 0, logicalW, logicalH);
  g.addColorStop(0, '#12142B');
  g.addColorStop(0.45, '#1A1C38');
  g.addColorStop(1, '#12142B');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, logicalW, logicalH);

  const glow = ctx.createRadialGradient(logicalW * 0.82, logicalH * 0.35, 4, logicalW * 0.82, logicalH * 0.35, logicalW * 0.35);
  glow.addColorStop(0, 'rgba(139, 127, 232, 0.28)');
  glow.addColorStop(1, 'rgba(139, 127, 232, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, logicalW, logicalH);

  const aurora = ctx.createRadialGradient(logicalW * 0.12, logicalH * 0.9, 2, logicalW * 0.12, logicalH * 0.9, logicalW * 0.28);
  aurora.addColorStop(0, 'rgba(63, 199, 184, 0.12)');
  aurora.addColorStop(1, 'rgba(63, 199, 184, 0)');
  ctx.fillStyle = aurora;
  ctx.fillRect(0, 0, logicalW, logicalH);

  return canvasToPng(canvas);
}

/* ------------------------------------------------------------------ *
 * Chart renderers
 * ------------------------------------------------------------------ */

function chartColorFor(item, index, winnerCount) {
  if (isWinnerByRank(item.rank, winnerCount) && item.votes > 0) return SERIES_WINNER;
  if (index === 0) return SERIES_PRIMARY;
  if (index === 1) return SERIES_SECONDARY;
  return SERIES_NEUTRAL[(index - 2) % SERIES_NEUTRAL.length];
}

function drawChartFrame(ctx, w, h, title, subtitle) {
  ctx.fillStyle = HEX.white;
  roundRectPath(ctx, 0, 0, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = HEX.line;
  ctx.lineWidth = 1;
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, 12);
  ctx.stroke();

  ctx.fillStyle = HEX.brand;
  roundRectPath(ctx, 20, 20, 5, 15, 2.5);
  ctx.fill();

  ctx.fillStyle = HEX.ink;
  ctx.font = `600 16px ${FONT_SERIF}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, 34, 32);
  if (subtitle) {
    ctx.fillStyle = HEX.dusk;
    ctx.font = `400 11px ${FONT_SANS}`;
    ctx.fillText(subtitle, 34, 48);
  }
  ctx.strokeStyle = HEX.lineSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 60);
  ctx.lineTo(w - 20, 60);
  ctx.stroke();
}

function renderColumnChartImage(data, winnerCount, logicalW, logicalH, labelMaxLen = 12) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH);
  drawChartFrame(ctx, logicalW, logicalH, 'Vote Distribution', 'Votes received per candidate · gold marks declared winners');

  const padding = { top: 84, right: 30, bottom: 78, left: 56 };
  const plotW = logicalW - padding.left - padding.right;
  const plotH = logicalH - padding.top - padding.bottom;
  const n = Math.max(data.length, 1);
  const maxVotes = Math.max(...data.map((d) => d.votes), 1);
  const baseY = padding.top + plotH;

  ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g += 1) {
    const gy = padding.top + (plotH / 4) * g;
    ctx.strokeStyle = HEX.lineSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, gy);
    ctx.lineTo(padding.left + plotW, gy);
    ctx.stroke();

    const val = Math.round(maxVotes - (maxVotes / 4) * g);
    ctx.fillStyle = HEX.lavender;
    ctx.font = `400 9px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(val), padding.left - 8, gy);
  }

  ctx.strokeStyle = HEX.line;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padding.left, baseY);
  ctx.lineTo(padding.left + plotW, baseY);
  ctx.stroke();

  const slot = plotW / n;
  const colW = Math.max(6, Math.min(48, slot * 0.62));
  const labelAngle = slot < 46 ? -Math.PI / 3 : slot < 70 ? -Math.PI / 4 : -Math.PI / 9;
  const labelLen = slot < 46 ? 9 : slot < 70 ? Math.max(labelMaxLen, 12) : Math.max(labelMaxLen, 16);

  data.forEach((item, i) => {
    const cx = padding.left + slot * i + slot / 2;
    const h = (item.votes / maxVotes) * plotH;
    const x = cx - colW / 2;
    const y = baseY - h;
    const isWinner = isWinnerByRank(item.rank, winnerCount) && item.votes > 0;
    const color = chartColorFor(item, i, winnerCount);
    const light = isWinner
      ? SERIES_WINNER_LIGHT
      : i === 0
        ? SERIES_PRIMARY_LIGHT
        : i === 1
          ? '#6DD4C8'
          : SERIES_NEUTRAL[(i - 2) % SERIES_NEUTRAL.length];

    if (h > 0) {
      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, light);
      grad.addColorStop(1, color);
      roundRectTopPath(ctx, x, y, colW, h, 5);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.fillStyle = isWinner ? HEX.ink : HEX.ink;
    ctx.font = `700 10px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(item.votes), cx, y - 4);

    ctx.save();
    ctx.translate(cx, baseY + 10);
    ctx.rotate(labelAngle);
    ctx.fillStyle = isWinner ? HEX.ink : HEX.dusk;
    ctx.font = `${isWinner ? '700' : '500'} 9px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateChartLabel(item.name, labelLen), 0, 0);
    ctx.restore();
  });

  return canvasToPng(canvas);
}

async function renderPieChartImage(data, winnerCount, logicalW, logicalH, labelMaxLen = 18) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH);
  drawChartFrame(ctx, logicalW, logicalH, 'Vote Share', 'Proportional breakdown · candidate photos in the legend');

  const total = data.reduce((sum, d) => sum + d.votes, 0);
  const cx = logicalW * 0.26;
  const cy = 62 + (logicalH - 62) * 0.52;
  const R = Math.min(logicalW * 0.22, (logicalH - 62) * 0.40);

  if (total === 0) {
    ctx.fillStyle = HEX.lavender;
    ctx.font = `400 13px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No votes recorded', cx, cy);
    return canvasToPng(canvas);
  }

  let startAngle = -Math.PI / 2;
  data.forEach((item, i) => {
    const slice = (item.votes / total) * Math.PI * 2;
    if (slice <= 0) return;
    const endAngle = startAngle + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = chartColorFor(item, i, winnerCount);
    ctx.fill();
    ctx.strokeStyle = HEX.white;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    if (slice > 0.28) {
      const mid = startAngle + slice / 2;
      const lx = cx + Math.cos(mid) * R * 0.62;
      const ly = cy + Math.sin(mid) * R * 0.62;
      ctx.fillStyle = HEX.white;
      ctx.font = `700 10px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${((item.votes / total) * 100).toFixed(1)}%`, lx, ly);
    }
    startAngle = endAngle;
  });

  // Donut hole
  const hole = R * 0.42;
  ctx.beginPath();
  ctx.arc(cx, cy, hole, 0, Math.PI * 2);
  ctx.fillStyle = HEX.white;
  ctx.fill();
  ctx.fillStyle = HEX.ink;
  ctx.font = `600 12px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Share', cx, cy - 6);
  ctx.fillStyle = HEX.dusk;
  ctx.font = `500 10px ${FONT_SANS}`;
  ctx.fillText(`${fmtNum(total)} votes`, cx, cy + 10);

  const legendX = logicalW * 0.50;
  const legendRight = logicalW - 18;
  const rows = data.length;
  const availH = logicalH - 78;
  const rowH = Math.min(28, availH / Math.max(rows, 1));
  let legendY = 78 + (availH - rowH * rows) / 2 + rowH / 2;
  const thumb = Math.min(18, rowH - 6);

  for (let i = 0; i < data.length; i += 1) {
    const item = data[i];
    const pct = ((item.votes / total) * 100).toFixed(1);
    const isWinner = isWinnerByRank(item.rank, winnerCount) && item.votes > 0;

    if (isWinner) {
      ctx.strokeStyle = HEX.gold;
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, legendX - 6, legendY - rowH / 2 + 1, legendRight - legendX + 12, rowH - 2, 6);
      ctx.stroke();
    }

    const thumbX = legendX;
    const thumbY = legendY - thumb / 2;
    if (item.avatarDataUrl) {
      const img = await loadImageElement(item.avatarDataUrl);
      if (img) {
        ctx.drawImage(img, thumbX, thumbY, thumb, thumb);
      }
    } else {
      ctx.beginPath();
      ctx.arc(thumbX + thumb / 2, legendY, thumb / 2, 0, Math.PI * 2);
      ctx.fillStyle = chartColorFor(item, i, winnerCount);
      ctx.fill();
    }

    ctx.fillStyle = HEX.ink;
    ctx.font = `600 11px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateChartLabel(item.name, labelMaxLen), legendX + thumb + 8, legendY);

    ctx.fillStyle = HEX.dusk;
    ctx.font = `500 9px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${item.votes} · ${pct}%`, legendRight, legendY);
    legendY += rowH;
  }

  return canvasToPng(canvas);
}

/** Guardian quorum visualization — filled/unfilled nodes echoing the app UI. */
function renderGuardianQuorumImage(total, filled, threshold, logicalW, logicalH) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH, 3);
  const n = Math.max(0, Number(total) || 0);
  const k = Math.max(0, Number(threshold) || 0);
  const filledCount = Math.min(n, Math.max(0, Number(filled) || 0));
  const quorumMet = filledCount >= k && k > 0;

  roundRectPath(ctx, 0, 0, logicalW, logicalH, 14);
  ctx.fillStyle = HEX.paper;
  ctx.fill();
  ctx.strokeStyle = 'rgba(139, 127, 232, 0.25)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, 0.5, 0.5, logicalW - 1, logicalH - 1, 14);
  ctx.stroke();

  ctx.fillStyle = HEX.brandDark;
  ctx.font = `600 10px ${FONT_SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('GUARDIAN QUORUM', 18, 22);
  ctx.fillStyle = HEX.ink;
  ctx.font = `600 15px ${FONT_SERIF}`;
  ctx.fillText('Threshold key ceremony', 18, 40);

  // Badges
  const badgeY = 18;
  roundRectPath(ctx, logicalW - 210, badgeY, 92, 22, 8);
  ctx.fillStyle = HEX.brandSoft;
  ctx.fill();
  ctx.strokeStyle = 'rgba(139, 127, 232, 0.35)';
  ctx.stroke();
  ctx.fillStyle = HEX.brandDark;
  ctx.font = `600 11px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${k} of ${n} required`, logicalW - 164, badgeY + 15);

  roundRectPath(ctx, logicalW - 108, badgeY, 90, 22, 8);
  ctx.fillStyle = quorumMet ? 'rgba(63, 199, 184, 0.15)' : HEX.white;
  ctx.fill();
  ctx.strokeStyle = quorumMet ? 'rgba(63, 199, 184, 0.4)' : HEX.line;
  ctx.stroke();
  ctx.fillStyle = quorumMet ? '#2A9A8E' : HEX.dusk;
  ctx.fillText(`${filledCount} of ${n} responded`, logicalW - 63, badgeY + 15);

  const size = Math.min(logicalW * 0.55, logicalH - 70);
  const cx = logicalW / 2;
  const cy = 58 + (logicalH - 58) / 2;
  const ringR = size * 0.28;
  const nodeR = n > 8 ? 14 : 16;

  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.arc(cx, cy, ringR * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(139, 127, 232, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.setLineDash([]);

  const nodes = Array.from({ length: n }, (_, i) => ({
    filled: i < filledCount,
    angle: (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2,
  }));

  nodes.forEach((node) => {
    if (!node.filled) return;
    const x = cx + Math.cos(node.angle) * ringR * 1.55;
    const y = cy + Math.sin(node.angle) * ringR * 1.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = quorumMet ? HEX.aurora : HEX.brand;
    ctx.lineWidth = 1.25;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Center
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fillStyle = quorumMet ? 'rgba(63, 199, 184, 0.15)' : HEX.white;
  ctx.fill();
  ctx.strokeStyle = quorumMet ? 'rgba(63, 199, 184, 0.5)' : 'rgba(139, 127, 232, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = HEX.dusk;
  ctx.font = `500 9px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(quorumMet ? 'READY' : 'KEY', cx, cy - 8);
  ctx.fillStyle = HEX.ink;
  ctx.font = `600 13px ${FONT_SERIF}`;
  ctx.fillText(`${filledCount}/${k || n}`, cx, cy + 8);

  nodes.forEach((node, i) => {
    const x = cx + Math.cos(node.angle) * ringR * 1.55;
    const y = cy + Math.sin(node.angle) * ringR * 1.55;
    ctx.beginPath();
    ctx.arc(x, y, nodeR, 0, Math.PI * 2);
    if (node.filled) {
      ctx.fillStyle = HEX.brandDark;
      ctx.fill();
      ctx.strokeStyle = HEX.brand;
    } else {
      ctx.fillStyle = HEX.white;
      ctx.fill();
      ctx.strokeStyle = 'rgba(139, 127, 232, 0.35)';
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = node.filled ? HEX.paper : HEX.dusk;
    ctx.font = `600 9px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`G${i + 1}`, x, y + 0.5);
  });

  return canvasToPng(canvas);
}

/* ------------------------------------------------------------------ *
 * PDF layout primitives — flowing cursor
 * ------------------------------------------------------------------ */

function setColor(doc, kind, rgb) {
  if (kind === 'fill') doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  else if (kind === 'draw') doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function createFlow(doc, pageWidth, pageHeight) {
  return {
    doc,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - MARGIN * 2,
    y: MARGIN,
    pageTitle: 'Official Election Results',
  };
}

function ensureSpace(flow, needed, continuedTitle) {
  if (flow.y + needed <= flow.pageHeight - FOOTER_RESERVE) return;
  flow.doc.addPage();
  flow.y = drawRunningHeader(flow.doc, flow.pageWidth, flow.pageTitle);
  if (continuedTitle) {
    flow.y = drawSectionHeader(flow.doc, MARGIN, flow.y + 2, `${continuedTitle} (continued)`, null);
  }
}

function drawRunningHeader(doc, pageWidth, title) {
  setColor(doc, 'text', C.brandDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('AMARVOTE', MARGIN, 14);

  setColor(doc, 'text', C.dusk);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(title, pageWidth - MARGIN, 14, { align: 'right' });

  setColor(doc, 'draw', C.brand);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 17, MARGIN + 18, 17);
  setColor(doc, 'draw', C.line);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 20, 17, pageWidth - MARGIN, 17);

  return 26;
}

function drawSectionHeader(doc, x, y, title, subtitle) {
  setColor(doc, 'fill', C.brand);
  doc.roundedRect(x, y - 4, 3.2, 9, 1.2, 1.2, 'F');

  setColor(doc, 'text', C.ink);
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.text(title, x + 7, y + 3);
  let next = y + 8;
  if (subtitle) {
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(subtitle, x + 7, next + 2.5);
    next += 6;
  }
  return next + 4;
}

/** Wrap display title: set font size first, then split — never truncate. */
function wrapDisplayTitle(doc, title, maxWidth, startSize = 26, minSize = 14) {
  let size = startSize;
  doc.setFont('times', 'bold');
  doc.setFontSize(size);
  let lines = doc.splitTextToSize(String(title || 'Untitled Election'), maxWidth);
  while (lines.length > 4 && size > minSize) {
    size -= 1;
    doc.setFontSize(size);
    lines = doc.splitTextToSize(String(title || 'Untitled Election'), maxWidth);
  }
  // Prefer slightly smaller type over more than 5 lines of display text.
  while (lines.length > 5 && size > 11) {
    size -= 1;
    doc.setFontSize(size);
    lines = doc.splitTextToSize(String(title || 'Untitled Election'), maxWidth);
  }
  return { lines, size, height: lines.length * size * 0.42 };
}

/* ------------------------------------------------------------------ *
 * Cover page
 * ------------------------------------------------------------------ */

function drawCoverPage(doc, pageWidth, pageHeight, contentWidth, opts) {
  const {
    electionData, processedResults, ranked,
    winnerCount, formatGeneratedAt,
  } = opts;

  const headerH = 42;
  const headerImg = renderHeaderBand(pageWidth * 2, headerH * 2);
  doc.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerH, undefined, 'FAST');

  setColor(doc, 'text', C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('AmarVote', MARGIN, 16);

  setColor(doc, 'text', [199, 196, 232]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('SECURE · VERIFIABLE · END-TO-END ENCRYPTED', MARGIN, 22);

  setColor(doc, 'text', C.lavender);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(`Generated ${formatGeneratedAt || '—'}`, pageWidth - MARGIN, 16, { align: 'right' });

  setColor(doc, 'text', [196, 190, 240]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('OFFICIAL ELECTION RESULTS', MARGIN, 34);

  // Title on ivory — full wrap, never truncated
  let y = headerH + 14;
  const title = electionData?.electionTitle || 'Untitled Election';
  const wrapped = wrapDisplayTitle(doc, title, contentWidth, 26, 13);
  setColor(doc, 'text', C.deep);
  doc.setFont('times', 'bold');
  doc.setFontSize(wrapped.size);
  wrapped.lines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += wrapped.size * 0.42;
  });
  y += 6;

  // Description — atomic wrap, push if needed
  const description = electionData?.electionDescription;
  if (description && String(description).trim()) {
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ABOUT THIS ELECTION', MARGIN, y);
    y += 5;
    setColor(doc, 'text', C.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const descLines = doc.splitTextToSize(String(description).trim(), contentWidth);
    const maxDesc = Math.min(descLines.length, 6);
    const descBlockH = maxDesc * 4.6 + 8;
    if (y + descBlockH > pageHeight - FOOTER_RESERVE - 80) {
      // leave room for winners + metrics; clip description rather than overflow
    }
    const shown = descLines.slice(0, maxDesc);
    doc.text(shown, MARGIN, y);
    y += shown.length * 4.6 + 8;
  }

  y = drawWinnerSpotlight(doc, pageWidth, pageHeight, contentWidth, y, ranked, winnerCount);

  y += 4;
  const metricsH = 32;
  if (y + metricsH > pageHeight - FOOTER_RESERVE) {
    doc.addPage();
    y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  }
  drawMetricCards(doc, contentWidth, y, [
    { label: 'ELIGIBLE VOTERS', value: fmtNum(processedResults.totalEligibleVoters) },
    { label: 'VOTERS WHO VOTED', value: fmtNum(processedResults.totalVotedUsers ?? 0) },
    { label: 'VOTER TURNOUT', value: `${processedResults.turnoutRate ?? 0}%` },
    { label: 'CANDIDATES', value: String(ranked.length) },
  ]);
}

function drawWinnerSpotlight(doc, pageWidth, pageHeight, contentWidth, y, ranked, winnerCount) {
  const winners = ranked.filter((r) => isWinnerByRank(r.rank, winnerCount) && r.votes > 0);

  // Pre-measure single-winner name wrap so the panel grows instead of truncating.
  let singleNameWrap = null;
  if (winners.length === 1) {
    const nameMaxW = contentWidth - WINNER_IMG_MM - 55;
    singleNameWrap = wrapDisplayTitle(doc, winners[0].name, nameMaxW, 18, 11);
  }

  // Multi-winner rows: measure wrapped names so long names push the panel down.
  const multiRows = winners.length > 1
    ? winners.map((w) => {
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      const nameMax = contentWidth - 72 - 9;
      const lines = doc.splitTextToSize(w.name, nameMax);
      return { winner: w, lines, rowH: Math.max(12, 6 + lines.length * 4) };
    })
    : [];

  let panelH;
  if (winners.length === 0) {
    panelH = 28;
  } else if (winners.length === 1) {
    const nameBlock = Math.max(WINNER_IMG_MM, singleNameWrap.height + 4);
    panelH = 14 + nameBlock;
  } else {
    panelH = 14 + multiRows.reduce((sum, r) => sum + r.rowH, 0);
  }

  if (y + panelH > pageHeight - FOOTER_RESERVE - 36) {
    doc.addPage();
    y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  }

  // Ivory panel with gold thin border — never gold fill behind light text
  setColor(doc, 'fill', C.paper);
  setColor(doc, 'draw', C.gold);
  doc.setLineWidth(0.7);
  doc.roundedRect(MARGIN, y, contentWidth, panelH, 3.2, 3.2, 'FD');

  setColor(doc, 'text', C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(
    winnerCount > 1 ? `DECLARED WINNERS · TOP ${winnerCount}` : 'DECLARED WINNER',
    MARGIN + 7,
    y + 8,
  );

  const badgeW = 22;
  setColor(doc, 'fill', C.white);
  setColor(doc, 'draw', C.gold);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageWidth - MARGIN - badgeW - 7, y + 4, badgeW, 6.5, 2, 2, 'FD');
  setColor(doc, 'text', C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('CERTIFIED', pageWidth - MARGIN - badgeW / 2 - 7, y + 8.5, { align: 'center' });

  if (winners.length === 0) {
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.text('No winner declared — no votes were recorded.', MARGIN + 7, y + 20);
    return y + panelH + 6;
  }

  if (winners.length === 1) {
    const w = winners[0];
    const imageSize = WINNER_IMG_MM;
    const imgX = MARGIN + 7;
    const imgY = y + 11;
    drawPng(doc, w.avatarDataUrl, imgX, imgY, imageSize);

    const textX = imgX + imageSize + 5;
    setColor(doc, 'text', C.ink);
    doc.setFont('times', 'bold');
    doc.setFontSize(singleNameWrap.size);
    let ny = y + 18;
    singleNameWrap.lines.forEach((line) => {
      doc.text(line, textX, ny);
      ny += singleNameWrap.size * 0.42;
    });

    setColor(doc, 'text', C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`${fmtNum(w.votes)}`, pageWidth - MARGIN - 7, y + 18, { align: 'right' });
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`votes · ${w.percentage}% share`, pageWidth - MARGIN - 7, y + 25, { align: 'right' });
    return y + panelH + 6;
  }

  let ly = y + 16;
  multiRows.forEach(({ winner: w, lines, rowH }) => {
    const imageSize = 9;
    drawPng(doc, w.avatarDataUrl, MARGIN + 7, ly - 5, imageSize);

    setColor(doc, 'text', C.brandDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(formatOrdinal(w.rank), MARGIN + 7 + imageSize + 3, ly);

    setColor(doc, 'text', C.ink);
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text(lines, MARGIN + 7 + imageSize + 16, ly);

    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${fmtNum(w.votes)} votes · ${w.percentage}%`, pageWidth - MARGIN - 7, ly, { align: 'right' });
    ly += rowH;
  });
  return y + panelH + 6;
}

function drawMetricCards(doc, contentWidth, y, stats) {
  const gap = 5;
  const cardW = (contentWidth - gap * (stats.length - 1)) / stats.length;
  const cardH = 28;
  stats.forEach((stat, i) => {
    const x = MARGIN + i * (cardW + gap);
    setColor(doc, 'fill', C.white);
    setColor(doc, 'draw', C.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD');

    setColor(doc, 'fill', C.brand);
    doc.roundedRect(x, y, 2.2, cardH, 1, 1, 'F');

    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text(stat.label, x + 6, y + 8);

    setColor(doc, 'text', C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(String(stat.value), x + 6, y + 21);
  });
  return y + cardH + 8;
}

/* ------------------------------------------------------------------ *
 * Election overview page
 * ------------------------------------------------------------------ */

function drawOverviewPage(doc, pageWidth, pageHeight, contentWidth, opts) {
  const { electionData, electionId, processedResults, winnerCount } = opts;
  const flow = createFlow(doc, pageWidth, pageHeight);
  flow.y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  flow.y = drawSectionHeader(doc, MARGIN, flow.y + 2, 'Election Configuration', 'Metadata, voting window, and eligibility');

  const cfg = [
    ['Election ID', String(electionId)],
    ['Status', opts.statusLabel || electionData?.status || '—'],
    ['Max choices per voter', String(electionData?.maxChoices || 1)],
    ['Winners declared', `Top ${winnerCount}`],
    ['Voting eligibility', electionData?.eligibility === 'listed' ? 'Listed voters only' : 'Open to anyone'],
    ['Total candidates', String((electionData?.electionChoices || []).length || processedResults.chartData.length)],
    ['Voting opens', fmtDate(opts.formatStartTime || electionData?.startingTime)],
    ['Voting closes', fmtDate(opts.formatEndTime || electionData?.endingTime)],
  ];
  flow.y = drawKeyValueGrid(doc, contentWidth, flow.y, cfg, electionId);

  flow.y += 6;
  ensureSpace(flow, 90, 'Guardians & Threshold Security');
  flow.y = drawSectionHeader(doc, MARGIN, flow.y, 'Guardians & Threshold Security',
    'Results require a quorum of guardians to jointly decrypt the tally');

  const totalGuardians = electionData?.numberOfGuardians || electionData?.totalGuardians
    || (electionData?.guardians?.length ?? 0);
  const quorum = electionData?.electionQuorum || 0;
  const submitted = electionData?.guardiansSubmitted ?? totalGuardians;

  flow.y = drawMetricCards(doc, contentWidth, flow.y, [
    { label: 'GUARDIANS', value: String(totalGuardians) },
    { label: 'QUORUM REQUIRED', value: String(quorum) },
    { label: 'SUBMITTED KEYS', value: String(submitted) },
  ]);

  // Quorum visualization — atomic block
  if (totalGuardians > 0) {
    const qW = contentWidth;
    const qH = Math.min(78, 48 + totalGuardians * 2);
    ensureSpace(flow, qH + 6, 'Guardians & Threshold Security');
    const qImg = renderGuardianQuorumImage(totalGuardians, submitted, quorum, qW * 3.2, qH * 3.2);
    doc.addImage(qImg, 'PNG', MARGIN, flow.y, qW, qH, undefined, 'FAST');
    flow.y += qH + 8;
  }

  const guardians = electionData?.guardians || [];
  if (guardians.length > 0) {
    ensureSpace(flow, 30, 'Guardians & Threshold Security');
    drawGuardianTable(doc, contentWidth, flow.y, guardians);
  }
}

function drawKeyValueGrid(doc, contentWidth, y, pairs, electionId) {
  const gap = 5;
  const colW = (contentWidth - gap) / 2;
  const rowH = 15;
  pairs.forEach((pair, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (colW + gap);
    const cy = y + row * (rowH + 4);
    const isId = pair[0] === 'Election ID';

    setColor(doc, 'fill', C.white);
    setColor(doc, 'draw', C.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cy, colW, rowH, 2.4, 2.4, 'FD');

    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(String(pair[0]).toUpperCase(), x + 5, cy + 5.5);

    if (isId) {
      // Mono chip for election ID
      setColor(doc, 'fill', C.brandSoft);
      doc.roundedRect(x + 4, cy + 7, Math.min(colW - 8, 48), 6, 1.5, 1.5, 'F');
      setColor(doc, 'text', C.brandDark);
      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.text(String(electionId ?? pair[1]), x + 6, cy + 11.5);
    } else {
      setColor(doc, 'text', C.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      const val = doc.splitTextToSize(String(pair[1] ?? '—'), colW - 10)[0];
      doc.text(val, x + 5, cy + 11.5);
    }
  });
  const rows = Math.ceil(pairs.length / 2);
  return y + rows * (rowH + 4) + 2;
}

function drawGuardianTable(doc, contentWidth, y, guardians) {
  setColor(doc, 'text', C.dusk);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('APPOINTED GUARDIANS', MARGIN, y + 2);
  y += 5;

  doc.autoTable({
    startY: y,
    head: [['#', 'Guardian', 'Email']],
    body: guardians.map((g, i) => [
      String(i + 1),
      g.userName || `Guardian ${i + 1}`,
      g.userEmail || 'No email available',
    ]),
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.4, right: 4, bottom: 2.4, left: 4 },
      lineColor: C.line,
      lineWidth: 0.15,
      textColor: C.ink,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: C.surface },
    headStyles: {
      fillColor: C.brandSoft,
      textColor: C.brandDark,
      fontStyle: 'bold',
      fontSize: 7.5,
      lineColor: C.line,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', textColor: C.dusk },
      1: { cellWidth: contentWidth * 0.42, fontStyle: 'bold', textColor: C.ink },
      2: { cellWidth: contentWidth * 0.42, textColor: C.dusk, font: 'courier', fontSize: 7.5 },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_RESERVE },
  });
  return (doc.lastAutoTable?.finalY ?? y) + 4;
}

/* ------------------------------------------------------------------ *
 * Visual analytics
 * ------------------------------------------------------------------ */

function placeChart(flow, dataUrl, logicalW, logicalH, width, continuedTitle) {
  const height = width * (logicalH / logicalW);
  ensureSpace(flow, height + 4, continuedTitle);
  flow.doc.addImage(dataUrl, 'PNG', MARGIN, flow.y, width, height, undefined, 'FAST');
  flow.y += height + 8;
}

async function drawAnalyticsPage(doc, pageWidth, pageHeight, contentWidth, ranked, winnerCount) {
  const flow = createFlow(doc, pageWidth, pageHeight);
  flow.pageTitle = 'Visual Analytics';
  flow.y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  flow.y = drawSectionHeader(doc, MARGIN, flow.y + 2, 'Visual Analytics',
    'Violet primary · teal secondary · gold reserved for winners');

  const n = ranked.length;
  const colLogicalW = Math.min(920, Math.max(660, 120 + n * 44));
  const colLogicalH = 460;
  const colImg = renderColumnChartImage(ranked, winnerCount, colLogicalW, colLogicalH);
  placeChart(flow, colImg, colLogicalW, colLogicalH, contentWidth, 'Visual Analytics');

  const pieLogicalW = 640;
  const pieLogicalH = Math.min(460, Math.max(250, 110 + n * 24));
  const pieImg = await renderPieChartImage(ranked, winnerCount, pieLogicalW, pieLogicalH);
  placeChart(flow, pieImg, pieLogicalW, pieLogicalH, contentWidth, 'Visual Analytics');
}

/* ------------------------------------------------------------------ *
 * Detailed ledger
 * ------------------------------------------------------------------ */

function estimateCandidateCellHeight(doc, row, colWidth) {
  const textOffset = CANDIDATE_IMG_MM + 4;
  const innerW = colWidth - 8 - textOffset;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const nameLines = doc.splitTextToSize(row.name || '', innerW);
  let height = 5 + nameLines.length * 4;
  if (row.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const descLines = doc.splitTextToSize(row.description, innerW);
    height += 2 + descLines.length * 3.2;
  }
  return Math.max(CANDIDATE_IMG_MM + 6, height + 5);
}

function drawCandidateCell(doc, cell, row) {
  const { x, y, width } = cell;
  const padX = 3;
  const imageSize = CANDIDATE_IMG_MM;
  const imageY = y + Math.max(2, (cell.height - imageSize) / 2);
  drawPng(doc, row.avatarDataUrl, x + padX, imageY, imageSize);

  const textX = x + padX + imageSize + 3;
  let cursorY = y + 5.5;

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  setColor(doc, 'text', C.ink);
  const nameLines = doc.splitTextToSize(row.name || '', width - (textX - x) - padX);
  doc.text(nameLines, textX, cursorY);
  cursorY += nameLines.length * 4 + 1;

  if (row.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(doc, 'text', C.dusk);
    const descLines = doc.splitTextToSize(row.description, width - (textX - x) - padX);
    doc.text(descLines, textX, cursorY);
  }
}

function drawShareBar(doc, cell, pct, isWinner) {
  const { x, y, width, height } = cell;
  const barW = width - 8;
  const barX = x + 4;
  const barY = y + height - 6;
  setColor(doc, 'fill', C.lineSoft);
  doc.roundedRect(barX, barY, barW, 2.2, 1.1, 1.1, 'F');
  const fillW = Math.max((Number(pct) / 100) * barW, 0);
  if (fillW > 0) {
    setColor(doc, 'fill', isWinner ? C.gold : C.brand);
    doc.roundedRect(barX, barY, fillW, 2.2, 1.1, 1.1, 'F');
  }
}

/** Gold-border winner pill — dark ink text, never light-on-gold. */
function drawWinnerPill(doc, x, y, w, h) {
  const pillW = 22;
  const pillH = 7;
  const px = x + (w - pillW) / 2;
  const py = y + (h - pillH) / 2;
  setColor(doc, 'fill', C.white);
  setColor(doc, 'draw', C.gold);
  doc.setLineWidth(0.55);
  doc.roundedRect(px, py, pillW, pillH, 2.5, 2.5, 'FD');
  setColor(doc, 'text', C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('WINNER', px + pillW / 2, py + 4.8, { align: 'center' });
}

function drawLedgerPage(doc, pageWidth, pageHeight, contentWidth, enrichedRanked, winnerCount) {
  let y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  y = drawSectionHeader(doc, MARGIN, y + 2, 'Full Standings Ledger',
    `Every candidate · photo · votes · share · ${enrichedRanked.length} entries`);

  const colRank = contentWidth * 0.09;
  const colCandidate = contentWidth * 0.52;
  const colVotes = contentWidth * 0.13;
  const colShare = contentWidth * 0.14;
  const colStatus = contentWidth * 0.12;

  let ledgerPage = 0;

  doc.autoTable({
    startY: y,
    head: [['Rank', 'Candidate', 'Votes', 'Share', 'Status']],
    body: enrichedRanked.map((row) => [
      formatOrdinal(row.rank),
      '',
      fmtNum(row.votes),
      `${row.percentage}%`,
      isWinnerByRank(row.rank, winnerCount) && row.votes > 0 ? '__WINNER__' : '—',
    ]),
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      overflow: 'linebreak',
      lineColor: C.line,
      lineWidth: 0.15,
      textColor: C.ink,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: C.surface },
    headStyles: {
      fillColor: C.deep,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: colRank, halign: 'center' },
      1: { cellWidth: colCandidate, halign: 'left' },
      2: { cellWidth: colVotes, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: colShare, halign: 'right' },
      4: { cellWidth: colStatus, halign: 'center' },
    },
    margin: { left: MARGIN, right: MARGIN, top: 30, bottom: FOOTER_RESERVE },
    didDrawPage: () => {
      ledgerPage += 1;
      if (ledgerPage === 1) return;
      drawRunningHeader(doc, pageWidth, 'Official Election Results');
      setColor(doc, 'text', C.ink);
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text('Full Standings Ledger', MARGIN, 24);
      setColor(doc, 'text', C.dusk);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('(continued)', MARGIN + 48, 24);
    },
    didParseCell: (data) => {
      const row = enrichedRanked[data.row.index];
      if (data.section !== 'body' || !row) return;
      const winner = isWinnerByRank(row.rank, winnerCount) && row.votes > 0;
      if (data.column.index === 1) {
        data.cell.text = '';
        data.cell.styles.minCellHeight = estimateCandidateCellHeight(doc, row, colCandidate);
      }
      if (data.column.index === 3 || data.column.index === 4) {
        data.cell.text = '';
      }
      if (winner && data.column.index === 0) {
        data.cell.styles.textColor = C.ink;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (data) => {
      const row = enrichedRanked[data.row.index];
      if (data.section !== 'body' || !row) return;
      const winner = isWinnerByRank(row.rank, winnerCount) && row.votes > 0;

      // Gold left-border accent on winner rows (not a gold fill)
      if (winner && data.column.index === 0) {
        setColor(doc, 'fill', C.gold);
        doc.rect(data.cell.x, data.cell.y, 1.4, data.cell.height, 'F');
      }

      if (data.column.index === 1) {
        drawCandidateCell(doc, data.cell, row);
      }
      if (data.column.index === 3) {
        setColor(doc, 'text', C.ink);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`${row.percentage}%`, data.cell.x + data.cell.width - 4, data.cell.y + 6, { align: 'right' });
        drawShareBar(doc, data.cell, row.percentage, winner);
      }
      if (data.column.index === 4 && data.cell.raw === '__WINNER__') {
        drawWinnerPill(doc, data.cell.x, data.cell.y, data.cell.width, data.cell.height);
      }
    },
  });
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */

function addCertifiedFooter(doc, pageWidth, pageHeight) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    setColor(doc, 'draw', C.line);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);

    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('AmarVote · Certified Ledger', MARGIN, pageHeight - 7);
    doc.text(`Page ${i} of ${pages}`, pageWidth - MARGIN, pageHeight - 7, { align: 'right' });
  }
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export async function generateElectionResultsPdf({
  electionData,
  electionId,
  processedResults,
  ranked,
  winnerCount,
  formatGeneratedAt,
  formatStartTime = null,
  formatEndTime = null,
  statusLabel = null,
}) {
  const enrichedRanked = await attachCandidateImageData(enrichRankedWithMeta(ranked, electionData));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  const opts = {
    electionData, electionId, processedResults, ranked: enrichedRanked,
    winnerCount, formatGeneratedAt, formatStartTime, formatEndTime,
    statusLabel,
  };

  drawCoverPage(doc, pageWidth, pageHeight, contentWidth, opts);

  doc.addPage();
  drawOverviewPage(doc, pageWidth, pageHeight, contentWidth, opts);

  doc.addPage();
  await drawAnalyticsPage(doc, pageWidth, pageHeight, contentWidth, enrichedRanked, winnerCount);

  doc.addPage();
  drawLedgerPage(doc, pageWidth, pageHeight, contentWidth, enrichedRanked, winnerCount);

  addCertifiedFooter(doc, pageWidth, pageHeight);

  const safeTitle = (electionData?.electionTitle || 'election')
    .replace(/[^a-z0-9]+/gi, '_')
    .slice(0, 60);
  doc.save(`election-results-${safeTitle}-${electionId}.pdf`);
}
