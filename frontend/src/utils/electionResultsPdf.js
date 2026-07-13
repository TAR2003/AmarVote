import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatOrdinal, isWinnerByRank } from './electionRankings';
import { fetchImageAsDataUrl as fetchRemoteImageAsDataUrl } from './certifiedLedger/images';

/**
 * AmarVote — Official Election Results report (Ink & Indigo design system).
 *
 * Dense, flowing document (typical 7-candidate election ≈ 3 pages):
 *   • Cover + winners + stats + election configuration + guardians
 *   • Visual Analytics (bar + pie, rank-ordered) — continues on same page when space allows
 *   • Full Standings Ledger — continues on same page when space allows
 *
 * Page count scales with content. Sections never force a blank page;
 * orphaned single-row blocks (e.g. guardian #3 alone) are avoided.
 */

const CHART_SCALE = 4;

/** Ink & Indigo tokens — exact app palette, adapted for print. */
const C = {
  deep: [18, 20, 43],
  ink: [27, 29, 46],
  paper: [247, 244, 236],
  white: [255, 255, 255],
  brand: [139, 127, 232],
  brandDark: [92, 82, 196],
  brandSoft: [239, 235, 248],
  aurora: [63, 199, 184],
  gold: [212, 165, 72],
  dusk: [91, 93, 116],
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

/** Gold only for declared winners; one consistent dusk neutral for everyone else. */
const SERIES_WINNER = HEX.gold;
const SERIES_WINNER_LIGHT = '#E0C078';
const SERIES_OTHER = HEX.dusk;
const SERIES_OTHER_LIGHT = '#8A8CA0';

const FONT_SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_SERIF = 'Fraunces, Georgia, "Times New Roman", serif';

const MARGIN = 16;
const FOOTER_RESERVE = 14;
const CANDIDATE_IMG_MM = 9;
const WINNER_IMG_MM = 14;
/** Fixed legend name column — truncate by measured width, not ragged char counts. */
const PIE_LEGEND_NAME_MAX_CHARS = 24;

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

export function truncateChartLabel(name, maxLen = 16) {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(4, maxLen - 1))}…`;
}

/**
 * Candidate description for the standings ledger:
 * - if a newline exists, show only the first line then ........
 * - otherwise first 80 characters then ........
 */
export function truncateCandidateDescription(description) {
  const raw = String(description || '');
  if (!raw.trim()) return '';
  const nl = raw.search(/\r\n|\n|\r/);
  if (nl >= 0) {
    const first = raw.slice(0, nl).trimEnd();
    return first ? `${first}........` : '........';
  }
  const trimmed = raw.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 80)}........`;
}

/**
 * Distinct integer Y-axis ticks — never duplicates from naive max/steps rounding.
 * Small ranges (0..N) list every integer; larger ranges use human-friendly steps.
 */
export function generateAxisTicks(maxValue, preferredCount = 5) {
  const max = Math.max(0, Math.ceil(Number(maxValue) || 0));
  if (max === 0) return [0];
  if (max <= 5) {
    return Array.from({ length: max + 1 }, (_, i) => i);
  }

  const target = Math.max(3, Math.min(preferredCount, 6));
  const rough = max / (target - 1);
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;
  let nice;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 2.5) nice = 2.5;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  const step = Math.max(1, Math.round(nice * power));
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) {
    ticks.push(Math.round(v));
  }
  return [...new Set(ticks)];
}

/** Truncate so painted text fits a fixed pixel width (consistent legend column). */
function truncateToWidth(ctx, text, maxWidth) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let lo = 0;
  let hi = raw.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${raw.slice(0, mid)}…`;
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${raw.slice(0, lo)}…` : '…';
}

/** Lock rank order (highest votes / lowest rank number first) everywhere. */
function ensureRankOrder(ranked) {
  return [...ranked].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (b.votes || 0) - (a.votes || 0);
  });
}

/** Mark ties so UI can show an explicit TIED label. */
function withTieFlags(ranked) {
  const counts = new Map();
  ranked.forEach((r) => counts.set(r.rank, (counts.get(r.rank) || 0) + 1));
  return ranked.map((r) => ({ ...r, isTied: (counts.get(r.rank) || 0) > 1 }));
}

/** Display name size step-down: 1st > 2nd > 3rd+. */
function nameFontSizeForRank(rank, base = 11) {
  if (rank === 1) return base + 2.5;
  if (rank === 2) return base;
  return base - 1;
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

/**
 * First letter of first name + first letter of last name.
 * Strips punctuation/whitespace so names like ", George" or "Dr. Ada" never yield ",G".
 */
export function candidateInitials(name) {
  // Normalize "Last, First" and strip stray punctuation before extracting letters.
  let raw = String(name || '').trim();
  if (raw.includes(',')) {
    const [left, ...rest] = raw.split(',');
    const right = rest.join(',').trim();
    raw = right ? `${right} ${left.trim()}` : left.trim();
  }

  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '?';

  const firstLetter = (token) => {
    const match = String(token).match(/[\p{L}\p{N}]/u);
    return match ? match[0].toUpperCase() : '';
  };

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 1) {
    const letters = parts[0].match(/[\p{L}\p{N}]/gu) || [];
    if (letters.length === 0) return '?';
    if (letters.length === 1) return letters[0].toUpperCase();
    return `${letters[0]}${letters[1]}`.toUpperCase();
  }

  const a = firstLetter(parts[0]);
  const b = firstLetter(parts[parts.length - 1]);
  return `${a}${b}` || '?';
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
    description: truncateCandidateDescription(metaMap.get(row.name)?.description || ''),
    candidatePic: metaMap.get(row.name)?.candidatePic || '',
  }));
}

async function fetchImageAsDataUrl(url) {
  if (!url) return null;
  return fetchRemoteImageAsDataUrl(url);
}

async function loadImageElement(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

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
    return { ...row, candidatePicDataUrl: raw, avatarDataUrl: avatar };
  }));
}

function drawPng(doc, dataUrl, x, y, size) {
  if (!dataUrl) return;
  try {
    doc.addImage(dataUrl, 'PNG', x, y, size, size, undefined, 'FAST');
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ *
 * Rasterized backgrounds & charts
 * ------------------------------------------------------------------ */

function renderHeaderBand(logicalW, logicalH) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH, 3);
  const g = ctx.createLinearGradient(0, 0, logicalW, logicalH);
  g.addColorStop(0, '#12142B');
  g.addColorStop(0.45, '#1A1C38');
  g.addColorStop(1, '#12142B');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, logicalW, logicalH);

  const glow = ctx.createRadialGradient(
    logicalW * 0.82, logicalH * 0.35, 4,
    logicalW * 0.82, logicalH * 0.35, logicalW * 0.35,
  );
  glow.addColorStop(0, 'rgba(139, 127, 232, 0.28)');
  glow.addColorStop(1, 'rgba(139, 127, 232, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, logicalW, logicalH);

  return canvasToPng(canvas);
}

function chartColorFor(item, winnerCount) {
  if (isWinnerByRank(item.rank, winnerCount) && item.votes > 0) return SERIES_WINNER;
  return SERIES_OTHER;
}

function chartColorLightFor(item, winnerCount) {
  if (isWinnerByRank(item.rank, winnerCount) && item.votes > 0) return SERIES_WINNER_LIGHT;
  return SERIES_OTHER_LIGHT;
}

function drawChartFrame(ctx, w, h, title, subtitle) {
  ctx.fillStyle = HEX.white;
  roundRectPath(ctx, 0, 0, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = HEX.line;
  ctx.lineWidth = 1;
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, 10);
  ctx.stroke();

  ctx.fillStyle = HEX.brand;
  roundRectPath(ctx, 16, 16, 4, 13, 2);
  ctx.fill();

  ctx.fillStyle = HEX.ink;
  ctx.font = `600 14px ${FONT_SERIF}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, 28, 27);
  if (subtitle) {
    ctx.fillStyle = HEX.dusk;
    ctx.font = `400 10px ${FONT_SANS}`;
    ctx.fillText(subtitle, 28, 42);
  }
  ctx.strokeStyle = HEX.lineSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, 52);
  ctx.lineTo(w - 16, 52);
  ctx.stroke();
}

function renderColumnChartImage(data, winnerCount, logicalW, logicalH) {
  const ordered = ensureRankOrder(data);
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH);
  drawChartFrame(
    ctx, logicalW, logicalH,
    'Vote Distribution',
    'Rank order · gold = declared winners · dusk = all others',
  );

  const padding = { top: 68, right: 24, bottom: 64, left: 48 };
  const plotW = logicalW - padding.left - padding.right;
  const plotH = logicalH - padding.top - padding.bottom;
  const n = Math.max(ordered.length, 1);
  const maxVotes = Math.max(...ordered.map((d) => d.votes), 1);
  const ticks = generateAxisTicks(maxVotes);
  const axisMax = ticks[ticks.length - 1] || maxVotes;
  const baseY = padding.top + plotH;

  ticks.forEach((tick) => {
    const gy = baseY - (tick / axisMax) * plotH;
    ctx.strokeStyle = HEX.lineSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, gy);
    ctx.lineTo(padding.left + plotW, gy);
    ctx.stroke();

    ctx.fillStyle = HEX.lavender;
    ctx.font = `400 9px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(tick), padding.left - 6, gy);
  });

  ctx.strokeStyle = HEX.line;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padding.left, baseY);
  ctx.lineTo(padding.left + plotW, baseY);
  ctx.stroke();

  const slot = plotW / n;
  const colW = Math.max(6, Math.min(42, slot * 0.6));
  const labelAngle = slot < 46 ? -Math.PI / 3 : slot < 70 ? -Math.PI / 4 : -Math.PI / 9;
  const labelLen = slot < 46 ? 9 : slot < 70 ? 12 : 16;

  ordered.forEach((item, i) => {
    const cx = padding.left + slot * i + slot / 2;
    const h = (item.votes / axisMax) * plotH;
    const x = cx - colW / 2;
    const y = baseY - h;
    const isWinner = isWinnerByRank(item.rank, winnerCount) && item.votes > 0;
    const color = chartColorFor(item, winnerCount);
    const light = chartColorLightFor(item, winnerCount);

    if (h > 0) {
      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, light);
      grad.addColorStop(1, color);
      roundRectTopPath(ctx, x, y, colW, h, 4);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.fillStyle = HEX.ink;
    ctx.font = `700 9px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(item.votes), cx, y - 3);

    ctx.save();
    ctx.translate(cx, baseY + 8);
    ctx.rotate(labelAngle);
    ctx.fillStyle = isWinner ? HEX.ink : HEX.dusk;
    ctx.font = `${isWinner ? '700' : '500'} 8px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateChartLabel(item.name, labelLen), 0, 0);
    ctx.restore();
  });

  return canvasToPng(canvas);
}

async function renderPieChartImage(data, winnerCount, logicalW, logicalH) {
  const ordered = ensureRankOrder(data);
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH);
  drawChartFrame(ctx, logicalW, logicalH, 'Vote Share', 'Same rank order as the bar chart and standings');

  const total = ordered.reduce((sum, d) => sum + d.votes, 0);
  const cx = logicalW * 0.24;
  const cy = 56 + (logicalH - 56) * 0.52;
  const R = Math.min(logicalW * 0.20, (logicalH - 56) * 0.38);

  if (total === 0) {
    ctx.fillStyle = HEX.lavender;
    ctx.font = `400 12px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No votes recorded', cx, cy);
    return canvasToPng(canvas);
  }

  let startAngle = -Math.PI / 2;
  ordered.forEach((item, i) => {
    const slice = (item.votes / total) * Math.PI * 2;
    if (slice <= 0) return;
    const endAngle = startAngle + slice;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = chartColorFor(item, winnerCount);
    ctx.fill();
    ctx.strokeStyle = HEX.white;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (slice > 0.28) {
      const mid = startAngle + slice / 2;
      ctx.fillStyle = HEX.white;
      ctx.font = `700 9px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${((item.votes / total) * 100).toFixed(1)}%`,
        cx + Math.cos(mid) * R * 0.62,
        cy + Math.sin(mid) * R * 0.62,
      );
    }
    startAngle = endAngle;
  });

  const hole = R * 0.42;
  ctx.beginPath();
  ctx.arc(cx, cy, hole, 0, Math.PI * 2);
  ctx.fillStyle = HEX.white;
  ctx.fill();
  ctx.fillStyle = HEX.ink;
  ctx.font = `600 11px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Share', cx, cy - 5);
  ctx.fillStyle = HEX.dusk;
  ctx.font = `500 9px ${FONT_SANS}`;
  ctx.fillText(`${fmtNum(total)} votes`, cx, cy + 9);

  // Legend — fixed name column width; truncate by measured width for consistent edges
  const legendX = logicalW * 0.44;
  const legendRight = logicalW - 14;
  const votesColW = 62;
  const nameColRight = legendRight - votesColW;
  const nameMaxW = Math.max(40, nameColRight - (legendX + 22));
  const rows = ordered.length;
  const availH = logicalH - 66;
  const rowH = Math.min(24, availH / Math.max(rows, 1));
  let legendY = 66 + (availH - rowH * rows) / 2 + rowH / 2;
  const thumb = Math.min(16, rowH - 5);

  for (let i = 0; i < ordered.length; i += 1) {
    const item = ordered[i];
    const pct = ((item.votes / total) * 100).toFixed(1);
    const isWinner = isWinnerByRank(item.rank, winnerCount) && item.votes > 0;

    if (isWinner) {
      ctx.strokeStyle = HEX.gold;
      ctx.lineWidth = 1.25;
      roundRectPath(ctx, legendX - 4, legendY - rowH / 2 + 1, legendRight - legendX + 8, rowH - 2, 5);
      ctx.stroke();
    }

    if (item.avatarDataUrl) {
      const img = await loadImageElement(item.avatarDataUrl);
      if (img) ctx.drawImage(img, legendX, legendY - thumb / 2, thumb, thumb);
    } else {
      ctx.beginPath();
      ctx.arc(legendX + thumb / 2, legendY, thumb / 2, 0, Math.PI * 2);
      ctx.fillStyle = chartColorFor(item, winnerCount);
      ctx.fill();
    }

    ctx.fillStyle = HEX.ink;
    ctx.font = `600 10px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = truncateToWidth(
      ctx,
      truncateChartLabel(item.name, PIE_LEGEND_NAME_MAX_CHARS),
      nameMaxW,
    );
    ctx.fillText(label, legendX + thumb + 6, legendY);

    ctx.fillStyle = HEX.white;
    ctx.fillRect(nameColRight, legendY - rowH / 2 + 1, legendRight - nameColRight + 2, rowH - 2);

    ctx.fillStyle = HEX.dusk;
    ctx.font = `500 9px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${item.votes} · ${pct}%`, legendRight, legendY);
    legendY += rowH;
  }

  return canvasToPng(canvas);
}

/* ------------------------------------------------------------------ *
 * PDF layout primitives
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

function remainingHeight(flow) {
  return flow.pageHeight - FOOTER_RESERVE - flow.y;
}

/** True when more than ~15% of the page body is still unused — pull content up. */
function hasSubstantialEmptySpace(flow) {
  const bodyH = flow.pageHeight - FOOTER_RESERVE - MARGIN;
  return remainingHeight(flow) > bodyH * 0.15;
}

function ensureSpace(flow, needed, continuedTitle) {
  if (flow.y + needed <= flow.pageHeight - FOOTER_RESERVE) return;
  flow.doc.addPage();
  flow.y = drawRunningHeader(flow.doc, flow.pageWidth, flow.pageTitle);
  if (continuedTitle) {
    flow.y = drawSectionHeader(flow.doc, MARGIN, flow.y + 1, `${continuedTitle} (continued)`, null);
  }
}

function drawRunningHeader(doc, pageWidth, title) {
  setColor(doc, 'text', C.brandDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('AMARVOTE', MARGIN, 12);

  setColor(doc, 'text', C.dusk);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(title, pageWidth - MARGIN, 12, { align: 'right' });

  setColor(doc, 'draw', C.brand);
  doc.setLineWidth(0.55);
  doc.line(MARGIN, 14.5, MARGIN + 16, 14.5);
  setColor(doc, 'draw', C.line);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 18, 14.5, pageWidth - MARGIN, 14.5);

  return 22;
}

function drawSectionHeader(doc, x, y, title, subtitle) {
  setColor(doc, 'fill', C.brand);
  doc.roundedRect(x, y - 3.5, 2.8, 8, 1, 1, 'F');

  setColor(doc, 'text', C.ink);
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text(title, x + 6, y + 2.5);
  let next = y + 6.5;
  if (subtitle) {
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(subtitle, x + 6, next + 1.5);
    next += 5;
  }
  return next + 2;
}

function wrapDisplayTitle(doc, title, maxWidth, startSize = 28, minSize = 14) {
  let size = startSize;
  doc.setFont('times', 'bold');
  doc.setFontSize(size);
  let lines = doc.splitTextToSize(String(title || 'Untitled Election'), maxWidth);
  while (lines.length > 3 && size > minSize) {
    size -= 1;
    doc.setFontSize(size);
    lines = doc.splitTextToSize(String(title || 'Untitled Election'), maxWidth);
  }
  while (lines.length > 4 && size > 11) {
    size -= 1;
    doc.setFontSize(size);
    lines = doc.splitTextToSize(String(title || 'Untitled Election'), maxWidth);
  }
  return { lines, size, height: lines.length * size * 0.4 };
}

/* ------------------------------------------------------------------ *
 * Compact stat bar (replaces tall cards)
 * ------------------------------------------------------------------ */

function drawCompactStatBar(doc, contentWidth, y, stats) {
  const h = 10.5;
  setColor(doc, 'fill', C.surface);
  setColor(doc, 'draw', C.line);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN, y, contentWidth, h, 1.8, 1.8, 'FD');

  setColor(doc, 'fill', C.brand);
  doc.roundedRect(MARGIN, y, 1.5, h, 0.7, 0.7, 'F');

  const slotW = contentWidth / stats.length;
  stats.forEach((stat, i) => {
    const x = MARGIN + i * slotW;
    if (i > 0) {
      setColor(doc, 'draw', C.line);
      doc.setLineWidth(0.2);
      doc.line(x, y + 2, x, y + h - 2);
    }
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text(stat.label, x + 3.5, y + 3.6);
    setColor(doc, 'text', C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(String(stat.value), x + 3.5, y + 8.4);
  });
  return y + h + 3;
}

/* ------------------------------------------------------------------ *
 * Cover + configuration + guardians (merged, dense)
 * ------------------------------------------------------------------ */

function drawCoverAndConfigSection(flow, opts) {
  const {
    electionData, electionId, processedResults, ranked,
    winnerCount, formatGeneratedAt,
  } = opts;
  const { doc, pageWidth, pageHeight, contentWidth } = flow;

  const headerH = 32;
  const headerImg = renderHeaderBand(pageWidth * 2, headerH * 2);
  doc.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerH, undefined, 'FAST');

  setColor(doc, 'text', C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AmarVote', MARGIN, 12);

  setColor(doc, 'text', [199, 196, 232]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('SECURE · VERIFIABLE · END-TO-END ENCRYPTED', MARGIN, 17.5);

  setColor(doc, 'text', C.lavender);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Generated ${formatGeneratedAt || '—'}`, pageWidth - MARGIN, 12, { align: 'right' });

  setColor(doc, 'text', [196, 190, 240]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('OFFICIAL ELECTION RESULTS', MARGIN, 26.5);

  // Headline title — commanding weight; title + description as one unit
  let y = headerH + 9;
  const title = electionData?.electionTitle || 'Untitled Election';
  const wrapped = wrapDisplayTitle(doc, title, contentWidth, 32, 15);
  setColor(doc, 'text', C.deep);
  doc.setFont('times', 'bold');
  doc.setFontSize(wrapped.size);
  wrapped.lines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += wrapped.size * 0.38;
  });

  const description = electionData?.electionDescription;
  if (description && String(description).trim()) {
    y += 2.5;
    setColor(doc, 'text', C.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const descLines = doc.splitTextToSize(String(description).trim(), contentWidth).slice(0, 2);
    doc.text(descLines, MARGIN, y);
    y += descLines.length * 3.3 + 3.5;
  } else {
    y += 5;
  }

  y = drawWinnerSpotlight(doc, pageWidth, pageHeight, contentWidth, y, ranked, winnerCount);

  y = drawCompactStatBar(doc, contentWidth, y, [
    { label: 'ELIGIBLE', value: fmtNum(processedResults.totalEligibleVoters) },
    { label: 'VOTED', value: fmtNum(processedResults.totalVotedUsers ?? 0) },
    { label: 'TURNOUT', value: `${processedResults.turnoutRate ?? 0}%` },
    { label: 'CANDIDATES', value: String(ranked.length) },
  ]);

  // —— Configuration (same page) ——
  y = drawSectionHeader(doc, MARGIN, y + 0.5, 'Election Configuration', null);

  const totalGuardians = electionData?.numberOfGuardians || electionData?.totalGuardians
    || (electionData?.guardians?.length ?? 0);
  const quorum = electionData?.electionQuorum || 0;
  const submitted = electionData?.guardiansSubmitted ?? totalGuardians;

  const cfg = [
    ['Election ID', String(electionId)],
    ['Status', opts.statusLabel || electionData?.status || '—'],
    ['Max choices', String(electionData?.maxChoices || 1)],
    ['Winners', `Top ${winnerCount}`],
    ['Eligibility', electionData?.eligibility === 'listed' ? 'Listed only' : 'Open'],
    ['Opens', fmtDate(opts.formatStartTime || electionData?.startingTime)],
    ['Closes', fmtDate(opts.formatEndTime || electionData?.endingTime)],
    ['Guardians', `${totalGuardians} · quorum ${quorum} · ${submitted} submitted`],
  ];
  y = drawKeyValueGrid(doc, contentWidth, y, cfg, electionId);

  const guardians = electionData?.guardians || [];
  if (guardians.length > 0) {
    const tableH = estimateGuardianTableHeight(guardians.length);
    // Keep the guardian block atomic — never orphan a trailing row onto its own page.
    if (y + tableH > pageHeight - FOOTER_RESERVE) {
      doc.addPage();
      y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
      y = drawSectionHeader(doc, MARGIN, y + 1, 'Appointed Guardians', null);
    } else {
      setColor(doc, 'text', C.dusk);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('APPOINTED GUARDIANS', MARGIN, y + 1.5);
      y += 4.5;
    }
    y = drawGuardianTable(doc, contentWidth, y, guardians);
  }

  flow.y = y;
}

function drawWinnerSpotlight(doc, pageWidth, pageHeight, contentWidth, y, ranked, winnerCount) {
  const winners = withTieFlags(
    ranked.filter((r) => isWinnerByRank(r.rank, winnerCount) && r.votes > 0),
  );

  let singleNameWrap = null;
  if (winners.length === 1) {
    singleNameWrap = wrapDisplayTitle(doc, winners[0].name, contentWidth - WINNER_IMG_MM - 50, 16, 11);
  }

  const multiRows = winners.length > 1
    ? winners.map((w) => {
      const nameSize = nameFontSizeForRank(w.rank, 10);
      doc.setFont('times', 'bold');
      doc.setFontSize(nameSize);
      const nameMax = contentWidth - 78 - 9;
      const lines = doc.splitTextToSize(w.name, nameMax);
      const rowH = Math.max(11, 5 + lines.length * (nameSize * 0.38) + (w.isTied ? 3 : 0));
      return { winner: w, lines, nameSize, rowH };
    })
    : [];

  let panelH;
  if (winners.length === 0) panelH = 20;
  else if (winners.length === 1) panelH = 11 + Math.max(WINNER_IMG_MM, singleNameWrap.height + 2);
  else panelH = 11 + multiRows.reduce((sum, r) => sum + r.rowH, 0);

  if (y + panelH > pageHeight - FOOTER_RESERVE - 40) {
    doc.addPage();
    y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  }

  setColor(doc, 'fill', C.paper);
  setColor(doc, 'draw', C.gold);
  doc.setLineWidth(0.65);
  doc.roundedRect(MARGIN, y, contentWidth, panelH, 2.8, 2.8, 'FD');

  // Heading + CERTIFIED as one unit (badge immediately after label)
  const heading = winnerCount > 1 ? `DECLARED WINNERS · TOP ${winnerCount}` : 'DECLARED WINNER';
  setColor(doc, 'text', C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(heading, MARGIN + 6, y + 6.5);
  const headingW = doc.getTextWidth(heading);

  const badgeW = 18;
  const badgeX = MARGIN + 6 + headingW + 2.5;
  setColor(doc, 'fill', C.white);
  setColor(doc, 'draw', C.gold);
  doc.setLineWidth(0.45);
  doc.roundedRect(badgeX, y + 2.8, badgeW, 5.2, 1.5, 1.5, 'FD');
  setColor(doc, 'text', C.ink);
  doc.setFontSize(5.5);
  doc.text('CERTIFIED', badgeX + badgeW / 2, y + 6.5, { align: 'center' });

  if (winners.length === 0) {
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No winner declared — no votes were recorded.', MARGIN + 6, y + 14.5);
    return y + panelH + 3.5;
  }

  if (winners.length === 1) {
    const w = winners[0];
    drawPng(doc, w.avatarDataUrl, MARGIN + 6, y + 9, WINNER_IMG_MM);
    const textX = MARGIN + 6 + WINNER_IMG_MM + 4;
    setColor(doc, 'text', C.ink);
    doc.setFont('times', 'bold');
    doc.setFontSize(singleNameWrap.size);
    let ny = y + 15;
    singleNameWrap.lines.forEach((line) => {
      doc.text(line, textX, ny);
      ny += singleNameWrap.size * 0.4;
    });

    setColor(doc, 'text', C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`${fmtNum(w.votes)}`, pageWidth - MARGIN - 6, y + 15, { align: 'right' });
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`votes · ${w.percentage}%`, pageWidth - MARGIN - 6, y + 21, { align: 'right' });
    return y + panelH + 3.5;
  }

  let ly = y + 13;
  multiRows.forEach(({ winner: w, lines, nameSize, rowH }) => {
    drawPng(doc, w.avatarDataUrl, MARGIN + 6, ly - 4.5, 8);

    // Rank carries hierarchy — larger/bolder than any status flag
    const rankLabel = formatOrdinal(w.rank);
    setColor(doc, 'text', C.deep);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(w.rank === 1 ? 12 : w.rank === 2 ? 10.5 : 9);
    doc.text(rankLabel, MARGIN + 17, ly);

    let nameX = MARGIN + 17 + doc.getTextWidth(rankLabel) + 3;
    if (w.isTied) {
      setColor(doc, 'fill', C.white);
      setColor(doc, 'draw', C.dusk);
      doc.setLineWidth(0.3);
      doc.roundedRect(nameX, ly - 3.2, 12, 4.5, 1, 1, 'FD');
      setColor(doc, 'text', C.dusk);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.text('TIED', nameX + 6, ly, { align: 'center' });
      nameX += 14;
    }

    setColor(doc, 'text', C.ink);
    doc.setFont('times', 'bold');
    doc.setFontSize(nameSize);
    doc.text(lines, nameX, ly);

    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${fmtNum(w.votes)} · ${w.percentage}%`, pageWidth - MARGIN - 6, ly, { align: 'right' });
    ly += rowH;
  });
  return y + panelH + 3.5;
}

function drawKeyValueGrid(doc, contentWidth, y, pairs, electionId) {
  const gap = 3;
  const colW = (contentWidth - gap) / 2;
  const rowH = 8.5;
  const rowGap = 1.4;
  pairs.forEach((pair, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (colW + gap);
    const cy = y + row * (rowH + rowGap);
    const isId = pair[0] === 'Election ID';

    setColor(doc, 'fill', C.white);
    setColor(doc, 'draw', C.line);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, cy, colW, rowH, 1.4, 1.4, 'FD');

    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.text(String(pair[0]).toUpperCase(), x + 2.5, cy + 2.8);

    if (isId) {
      setColor(doc, 'fill', C.brandSoft);
      doc.roundedRect(x + 2, cy + 3.6, Math.min(colW - 4, 38), 3.8, 0.9, 0.9, 'F');
      setColor(doc, 'text', C.brandDark);
      doc.setFont('courier', 'bold');
      doc.setFontSize(6);
      doc.text(String(electionId ?? pair[1]), x + 3.5, cy + 6.4);
    } else {
      setColor(doc, 'text', C.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(doc.splitTextToSize(String(pair[1] ?? '—'), colW - 5)[0], x + 2.5, cy + 6.5);
    }
  });
  return y + Math.ceil(pairs.length / 2) * (rowH + rowGap) + 1;
}

function estimateGuardianTableHeight(count) {
  return 5 + 6.5 + (count + 1) * 6.5;
}

function drawGuardianTable(doc, contentWidth, y, guardians) {
  doc.autoTable({
    startY: y,
    head: [['#', 'Guardian', 'Email']],
    body: guardians.map((g, i) => [
      String(i + 1),
      g.userName || `Guardian ${i + 1}`,
      g.userEmail || 'No email available',
    ]),
    showHead: 'firstPage',
    rowPageBreak: 'avoid',
    pageBreak: 'avoid',
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.4, right: 3, bottom: 1.4, left: 3 },
      lineColor: C.line,
      lineWidth: 0.12,
      textColor: C.ink,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: C.surface },
    headStyles: {
      fillColor: C.brandSoft,
      textColor: C.brandDark,
      fontStyle: 'bold',
      fontSize: 6.5,
      lineColor: C.line,
      lineWidth: 0.12,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', textColor: C.dusk },
      1: { cellWidth: contentWidth * 0.4, fontStyle: 'bold', textColor: C.ink },
      2: { cellWidth: contentWidth * 0.48, textColor: C.dusk, font: 'courier', fontSize: 7 },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_RESERVE },
  });
  return (doc.lastAutoTable?.finalY ?? y) + 2.5;
}

/* ------------------------------------------------------------------ *
 * Visual analytics — continues on current page when space allows
 * ------------------------------------------------------------------ */

function placeChart(flow, dataUrl, logicalW, logicalH, widthMm, continuedTitle) {
  const height = widthMm * (logicalH / logicalW);
  ensureSpace(flow, height + 3, continuedTitle);
  flow.doc.addImage(dataUrl, 'PNG', MARGIN, flow.y, widthMm, height, undefined, 'FAST');
  flow.y += height + 4;
}

async function drawAnalyticsSection(flow, ranked, winnerCount) {
  const ordered = ensureRankOrder(ranked);
  const n = ordered.length;
  const minBlock = 58;

  // Pull analytics onto the current page when ≥15% remains and a chart fits.
  if (!hasSubstantialEmptySpace(flow) || remainingHeight(flow) < minBlock) {
    flow.doc.addPage();
    flow.y = drawRunningHeader(flow.doc, flow.pageWidth, flow.pageTitle);
  }

  flow.y = drawSectionHeader(
    flow.doc, MARGIN, flow.y + 0.5, 'Visual Analytics',
    'Bar, pie & standings share one rank order · gold = winners only',
  );

  // Margin of victory (1st vs 2nd) — fills dead space purposefully
  const first = ordered[0];
  const second = ordered[1];
  if (first && second && first.votes >= 0) {
    const margin = Math.max(0, (first.votes || 0) - (second.votes || 0));
    setColor(flow.doc, 'fill', C.surface);
    setColor(flow.doc, 'draw', C.line);
    flow.doc.setLineWidth(0.2);
    flow.doc.roundedRect(MARGIN, flow.y, flow.contentWidth, 8, 1.5, 1.5, 'FD');
    setColor(flow.doc, 'text', C.dusk);
    flow.doc.setFont('helvetica', 'bold');
    flow.doc.setFontSize(5.5);
    flow.doc.text('MARGIN OF VICTORY (1ST − 2ND)', MARGIN + 3.5, flow.y + 3.2);
    setColor(flow.doc, 'text', C.ink);
    flow.doc.setFont('helvetica', 'bold');
    flow.doc.setFontSize(8);
    flow.doc.text(
      `${fmtNum(margin)} vote${margin === 1 ? '' : 's'}`,
      MARGIN + 3.5,
      flow.y + 6.6,
    );
    flow.y += 10;
  }

  const contentWidth = flow.contentWidth;
  const gap = 3.5;
  let avail = remainingHeight(flow);

  // Prefer both charts on this page — scale heights to fill remaining space (≤15% void).
  let barMm;
  let pieMm;
  if (avail >= 120) {
    const usable = avail - gap - 2;
    barMm = Math.min(110, Math.max(62, usable * 0.55));
    pieMm = Math.min(105, Math.max(58, usable - barMm));
  } else if (avail >= minBlock) {
    barMm = Math.max(52, avail - 3);
    pieMm = Math.min(95, Math.max(58, avail * 0.9));
  } else {
    ensureSpace(flow, minBlock, 'Visual Analytics');
    avail = remainingHeight(flow);
    const usable = Math.max(avail - gap, minBlock);
    barMm = Math.min(110, Math.max(62, usable * 0.55));
    pieMm = Math.min(105, Math.max(58, usable - barMm));
  }

  const colLogicalW = Math.min(960, Math.max(640, 120 + n * 48));
  const colLogicalH = Math.round(colLogicalW * (barMm / contentWidth));
  const colImg = renderColumnChartImage(ordered, winnerCount, colLogicalW, colLogicalH);
  placeChart(flow, colImg, colLogicalW, colLogicalH, contentWidth, 'Visual Analytics');

  // If pie would leave the page mostly empty after a page break, enlarge it.
  avail = remainingHeight(flow);
  if (avail < pieMm + 4 && hasSubstantialEmptySpace(flow) === false) {
    // fit remaining on this page if possible, else new page with large pie
    if (avail >= 50) {
      pieMm = Math.max(50, avail - 2);
    } else {
      ensureSpace(flow, 70, 'Visual Analytics');
      avail = remainingHeight(flow);
      pieMm = Math.min(120, Math.max(70, avail - 2));
    }
  } else if (avail > pieMm + bodyEmptyAllowance(flow)) {
    pieMm = Math.min(120, avail - 2);
  }

  const pieLogicalW = 720;
  const pieLogicalH = Math.max(220, Math.round(pieLogicalW * (pieMm / contentWidth)));
  const pieImg = await renderPieChartImage(ordered, winnerCount, pieLogicalW, pieLogicalH);
  placeChart(flow, pieImg, pieLogicalW, pieLogicalH, contentWidth, 'Visual Analytics');
}

function bodyEmptyAllowance(flow) {
  const bodyH = flow.pageHeight - FOOTER_RESERVE - MARGIN;
  return bodyH * 0.15;
}

/* ------------------------------------------------------------------ *
 * Standings ledger
 * ------------------------------------------------------------------ */

function estimateCandidateCellHeight(doc, row, colWidth) {
  const textOffset = CANDIDATE_IMG_MM + 3;
  const innerW = colWidth - 7 - textOffset;
  const nameSize = nameFontSizeForRank(row.rank, 9.5);
  doc.setFont('times', 'bold');
  doc.setFontSize(nameSize);
  const nameLines = doc.splitTextToSize(row.name || '', innerW);
  let height = 4 + nameLines.length * (nameSize * 0.4);
  if (row.isTied) height += 3;
  if (row.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const descLines = doc.splitTextToSize(row.description, innerW);
    height += 1.5 + descLines.length * 2.8;
  }
  return Math.max(CANDIDATE_IMG_MM + 5, height + 4);
}

function drawCandidateCell(doc, cell, row) {
  const { x, y, width } = cell;
  const padX = 2.5;
  const imageSize = CANDIDATE_IMG_MM;
  drawPng(doc, row.avatarDataUrl, x + padX, y + Math.max(2, (cell.height - imageSize) / 2), imageSize);

  const textX = x + padX + imageSize + 2.5;
  let cursorY = y + 5;
  const nameSize = nameFontSizeForRank(row.rank, 9.5);

  doc.setFont('times', 'bold');
  doc.setFontSize(nameSize);
  setColor(doc, 'text', C.ink);
  const nameLines = doc.splitTextToSize(row.name || '', width - (textX - x) - padX);
  doc.text(nameLines, textX, cursorY);
  cursorY += nameLines.length * (nameSize * 0.4) + 0.5;

  if (row.isTied) {
    setColor(doc, 'fill', C.white);
    setColor(doc, 'draw', C.dusk);
    doc.setLineWidth(0.3);
    doc.roundedRect(textX, cursorY - 2.2, 11, 4, 1, 1, 'FD');
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text('TIED', textX + 5.5, cursorY + 0.5, { align: 'center' });
    cursorY += 4.5;
  }

  if (row.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setColor(doc, 'text', C.dusk);
    const descWidth = width - (textX - x) - padX;
    const paragraphs = String(row.description).split(/\n+/).filter(Boolean);
    paragraphs.forEach((para, pi) => {
      if (pi > 0) cursorY += 1.8;
      const lines = doc.splitTextToSize(para, descWidth);
      doc.text(lines, textX, cursorY);
      cursorY += lines.length * 2.9;
    });
  }
}

function drawShareBar(doc, cell, pct, isWinner) {
  const { x, y, width, height } = cell;
  const barW = width - 7;
  const barX = x + 3.5;
  const barY = y + height - 5;
  setColor(doc, 'fill', C.lineSoft);
  doc.roundedRect(barX, barY, barW, 1.8, 0.9, 0.9, 'F');
  const fillW = Math.max((Number(pct) / 100) * barW, 0);
  if (fillW > 0) {
    setColor(doc, 'fill', isWinner ? C.gold : C.dusk);
    doc.roundedRect(barX, barY, fillW, 1.8, 0.9, 0.9, 'F');
  }
}

/** Subtle status chip — rank remains the primary signal. */
function drawWinnerPill(doc, x, y, w, h) {
  const pillW = 16;
  const pillH = 5;
  const px = x + (w - pillW) / 2;
  const py = y + (h - pillH) / 2;
  setColor(doc, 'fill', C.white);
  setColor(doc, 'draw', C.gold);
  doc.setLineWidth(0.35);
  doc.roundedRect(px, py, pillW, pillH, 1.5, 1.5, 'FD');
  setColor(doc, 'text', C.dusk);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.text('WINNER', px + pillW / 2, py + 3.5, { align: 'center' });
}

function drawRankCell(doc, cell, row) {
  const { x, y, width, height } = cell;
  const cx = x + width / 2;
  const cy = y + height / 2;
  // Rank numerals dominate — stepped 1st > 2nd > 3rd+
  const size = row.rank === 1 ? 13 : row.rank === 2 ? 11 : 9.5;

  setColor(doc, 'text', C.deep);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.text(formatOrdinal(row.rank), cx, cy + (row.isTied ? -1.5 : 1.2), { align: 'center' });

  if (row.isTied) {
    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text('TIED', cx, cy + 4.8, { align: 'center' });
  }
}

function drawLedgerSection(flow, enrichedRanked, winnerCount) {
  const ordered = withTieFlags(ensureRankOrder(enrichedRanked));
  const { doc, pageWidth, contentWidth } = flow;

  // Continue on this page only when substantial space remains for the table header + a row.
  const minLedger = 36;
  if (!hasSubstantialEmptySpace(flow) || remainingHeight(flow) < minLedger) {
    doc.addPage();
    flow.y = drawRunningHeader(doc, pageWidth, flow.pageTitle);
  }

  flow.y = drawSectionHeader(
    doc, MARGIN, flow.y + 1, 'Full Standings Ledger',
    `${ordered.length} candidates · competition ranking`,
  );

  const colRank = contentWidth * 0.10;
  const colCandidate = contentWidth * 0.50;
  const colVotes = contentWidth * 0.13;
  const colShare = contentWidth * 0.14;
  const colStatus = contentWidth * 0.13;

  let ledgerPage = 0;
  const startPage = doc.internal.getCurrentPageInfo().pageNumber;

  doc.autoTable({
    startY: flow.y,
    head: [['Rank', 'Candidate', 'Votes', 'Share', 'Status']],
    body: ordered.map((row) => [
      '',
      '',
      fmtNum(row.votes),
      `${row.percentage}%`,
      isWinnerByRank(row.rank, winnerCount) && row.votes > 0 ? '__WINNER__' : '—',
    ]),
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      overflow: 'linebreak',
      lineColor: C.line,
      lineWidth: 0.12,
      textColor: C.ink,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: C.surface },
    headStyles: {
      fillColor: C.deep,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: colRank, halign: 'center' },
      1: { cellWidth: colCandidate, halign: 'left' },
      2: { cellWidth: colVotes, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: colShare, halign: 'right' },
      4: { cellWidth: colStatus, halign: 'center' },
    },
    margin: { left: MARGIN, right: MARGIN, top: 26, bottom: FOOTER_RESERVE },
    didDrawPage: (data) => {
      ledgerPage += 1;
      const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
      if (pageNum === startPage && ledgerPage === 1) return;
      drawRunningHeader(doc, pageWidth, 'Official Election Results');
      setColor(doc, 'text', C.ink);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text('Full Standings Ledger', MARGIN, 21);
      setColor(doc, 'text', C.dusk);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('(continued)', MARGIN + 44, 21);
      // Suppress unused-param lint for autoTable hook signature
      void data;
    },
    didParseCell: (data) => {
      const row = ordered[data.row.index];
      if (data.section !== 'body' || !row) return;
      if (data.column.index === 0 || data.column.index === 1) data.cell.text = '';
      if (data.column.index === 3 || data.column.index === 4) data.cell.text = '';
      if (data.column.index === 1) {
        data.cell.styles.minCellHeight = estimateCandidateCellHeight(doc, row, colCandidate);
      }
    },
    didDrawCell: (data) => {
      const row = ordered[data.row.index];
      if (data.section !== 'body' || !row) return;
      const winner = isWinnerByRank(row.rank, winnerCount) && row.votes > 0;

      if (winner && data.column.index === 0) {
        setColor(doc, 'fill', C.gold);
        doc.rect(data.cell.x, data.cell.y, 1.2, data.cell.height, 'F');
      }
      if (data.column.index === 0) drawRankCell(doc, data.cell, row);
      if (data.column.index === 1) drawCandidateCell(doc, data.cell, row);
      if (data.column.index === 3) {
        setColor(doc, 'text', C.ink);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(`${row.percentage}%`, data.cell.x + data.cell.width - 3.5, data.cell.y + 5.5, { align: 'right' });
        drawShareBar(doc, data.cell, row.percentage, winner);
      }
      if (data.column.index === 4 && data.cell.raw === '__WINNER__') {
        drawWinnerPill(doc, data.cell.x, data.cell.y, data.cell.width, data.cell.height);
      }
    },
  });

  flow.y = (doc.lastAutoTable?.finalY ?? flow.y) + 2;
}

/* ------------------------------------------------------------------ *
 * Footer & entry
 * ------------------------------------------------------------------ */

function addCertifiedFooter(doc, pageWidth, pageHeight) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    setColor(doc, 'draw', C.line);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageHeight - 10, pageWidth - MARGIN, pageHeight - 10);

    setColor(doc, 'text', C.dusk);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('AmarVote · Certified Ledger', MARGIN, pageHeight - 6);
    doc.text(`Page ${i} of ${pages}`, pageWidth - MARGIN, pageHeight - 6, { align: 'right' });
  }
}

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
  const enrichedRanked = withTieFlags(
    ensureRankOrder(
      await attachCandidateImageData(enrichRankedWithMeta(ranked, electionData)),
    ),
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const flow = createFlow(doc, pageWidth, pageHeight);

  const opts = {
    electionData, electionId, processedResults, ranked: enrichedRanked,
    winnerCount, formatGeneratedAt, formatStartTime, formatEndTime,
    statusLabel,
  };

  // Continuous flow: sections share pages when space remains (≤15% empty rule).
  drawCoverAndConfigSection(flow, opts);
  await drawAnalyticsSection(flow, enrichedRanked, winnerCount);
  drawLedgerSection(flow, enrichedRanked, winnerCount);

  addCertifiedFooter(doc, pageWidth, pageHeight);

  const safeTitle = (electionData?.electionTitle || 'election')
    .replace(/[^a-z0-9]+/gi, '_')
    .slice(0, 60);
  doc.save(`election-results-${safeTitle}-${electionId}.pdf`);
}
