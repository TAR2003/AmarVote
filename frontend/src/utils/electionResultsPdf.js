import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatOrdinal, isWinnerByRank } from './electionRankings';

/**
 * AmarVote — Official Election Results report.
 *
 * A print-grade, benchmark-quality PDF:
 *   • Page 1  — Cover: hero, large title, description, winner spotlight, key metrics
 *   • Page 2  — Election Overview: configuration, timeline, guardians, cryptographic proofs
 *   • Page 3  — Visual Analytics: high-resolution bar, donut and results-curve charts
 *   • Page 4+ — Detailed Standings Ledger
 *
 * Charts are rasterized at ~300 DPI and never split across pages.
 */

/** Target ~300 DPI when rasterizing charts/gradients for crisp print/zoom. */
const CHART_SCALE = 4;

/** RGB design tokens (used for vector text/shapes). */
const C = {
  ink: [15, 23, 42],
  ink2: [30, 41, 59],
  body: [51, 65, 85],
  sub: [71, 85, 105],
  muted: [100, 116, 139],
  faint: [148, 163, 184],
  line: [226, 232, 240],
  line2: [241, 245, 249],
  surface: [248, 250, 252],
  white: [255, 255, 255],
  brand: [79, 70, 229],
  brandDark: [55, 48, 163],
  brandBg: [238, 242, 255],
  navy: [15, 23, 42],
  gold: [217, 119, 6],
  goldDark: [146, 64, 14],
  goldBg: [254, 243, 199],
  goldLine: [253, 230, 138],
  emerald: [16, 185, 129],
  emeraldDark: [6, 95, 70],
  emeraldBg: [209, 250, 229],
};

/** Hex palette for rasterized charts. */
const CHART_COLORS = [
  '#4F46E5', '#0EA5E9', '#8B5CF6', '#0D9488', '#DB2777',
  '#2563EB', '#7C3AED', '#0891B2', '#C026D3', '#4338CA',
];
/** Vivid, high-contrast categorical palette so every slice is distinct. */
const PIE_COLORS = [
  '#4F46E5', '#F97316', '#10B981', '#EAB308', '#EC4899',
  '#06B6D4', '#8B5CF6', '#EF4444', '#14B8A6', '#A855F7',
  '#0EA5E9', '#F59E0B', '#22C55E', '#DB2777', '#6366F1',
];
/** Column fill mirrors the Results tab bar (#3B82F6). */
const COLUMN_HEX = '#3B82F6';
const COLUMN_HEX_LIGHT = '#60A5FA';
const WINNER_HEX = '#D97706';

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

/** Short label for charts — keeps the start of the name to avoid clutter. */
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

/** Rounded only on the top corners — used for vertical columns. */
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

const CANDIDATE_IMG_MM = 10;

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

async function attachCandidateImageData(enrichedRanked) {
  const uniqueUrls = [...new Set(enrichedRanked.map((row) => row.candidatePic).filter(Boolean))];
  const urlToData = new Map();

  await Promise.all(uniqueUrls.map(async (url) => {
    const dataUrl = await fetchImageAsDataUrl(url);
    if (dataUrl) urlToData.set(url, dataUrl);
  }));

  return enrichedRanked.map((row) => ({
    ...row,
    candidatePicDataUrl: row.candidatePic ? (urlToData.get(row.candidatePic) || null) : null,
  }));
}

function drawCandidateImage(doc, dataUrl, x, y, size = CANDIDATE_IMG_MM) {
  if (!dataUrl) return;
  const formats = [imageFormatFromDataUrl(dataUrl), 'PNG', 'JPEG'];
  for (const format of formats) {
    try {
      doc.addImage(dataUrl, format, x, y, size, size, undefined, 'FAST');
      return;
    } catch {
      // try next format
    }
  }
}

/* ------------------------------------------------------------------ *
 * Rasterized backgrounds (smooth gradients for a premium finish)
 * ------------------------------------------------------------------ */

/** Deep indigo hero gradient with subtle concentric rings. */
function renderHeroBackground(logicalW, logicalH) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH, 3);
  const g = ctx.createLinearGradient(0, 0, logicalW, logicalH);
  g.addColorStop(0, '#0B1120');
  g.addColorStop(0.55, '#1E1B4B');
  g.addColorStop(1, '#312E81');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, logicalW, logicalH);

  // Decorative rings anchored to the top-right.
  const cx = logicalW * 0.86;
  const cy = logicalH * 0.28;
  for (let i = 6; i >= 1; i -= 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, i * 46, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(129, 140, 248, ${0.05 + (7 - i) * 0.012})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Soft glow.
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 200);
  glow.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, logicalW, logicalH);

  return canvasToPng(canvas);
}

/** Light tinted panel used behind spotlight / metric strips. */
function renderSoftPanel(logicalW, logicalH, from, to) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH, 3);
  const g = ctx.createLinearGradient(0, 0, logicalW, 0);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  roundRectPath(ctx, 0.5, 0.5, logicalW - 1, logicalH - 1, 14);
  ctx.fillStyle = g;
  ctx.fill();
  return canvasToPng(canvas);
}

/* ------------------------------------------------------------------ *
 * Chart renderers (high-resolution, print-ready)
 * ------------------------------------------------------------------ */

function drawChartFrame(ctx, w, h, title, subtitle, accent) {
  ctx.fillStyle = '#FFFFFF';
  roundRectPath(ctx, 0, 0, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, 12);
  ctx.stroke();

  // Accent dot + title
  ctx.fillStyle = accent || '#4F46E5';
  roundRectPath(ctx, 20, 20, 5, 15, 2.5);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 16px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, 34, 30);
  if (subtitle) {
    ctx.fillStyle = '#64748B';
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText(subtitle, 34, 46);
  }
  // Divider under header
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 58);
  ctx.lineTo(w - 20, 58);
  ctx.stroke();
}

/** Vertical column chart — vote distribution (mirrors the Results tab). */
function renderColumnChartImage(data, winnerCount, logicalW, logicalH, labelMaxLen = 12) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH);
  drawChartFrame(ctx, logicalW, logicalH, 'Vote Distribution', 'Votes received per candidate', COLUMN_HEX);

  const padding = { top: 82, right: 30, bottom: 78, left: 56 };
  const plotW = logicalW - padding.left - padding.right;
  const plotH = logicalH - padding.top - padding.bottom;
  const n = Math.max(data.length, 1);
  const maxVotes = Math.max(...data.map((d) => d.votes), 1);
  const baseY = padding.top + plotH;

  // Horizontal gridlines + y-axis scale
  ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g += 1) {
    const gy = padding.top + (plotH / 4) * g;
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, gy);
    ctx.lineTo(padding.left + plotW, gy);
    ctx.stroke();

    const val = Math.round(maxVotes - (maxVotes / 4) * g);
    ctx.fillStyle = '#94A3B8';
    ctx.font = `400 9px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(val), padding.left - 8, gy);
  }

  // Baseline
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padding.left, baseY);
  ctx.lineTo(padding.left + plotW, baseY);
  ctx.stroke();

  const slot = plotW / n;
  const colW = Math.max(6, Math.min(48, slot * 0.62));
  // Tighter columns need steeper, shorter labels to avoid overlap.
  const labelAngle = slot < 46 ? -Math.PI / 3 : slot < 70 ? -Math.PI / 4 : -Math.PI / 9;
  const labelLen = slot < 46 ? 9 : slot < 70 ? Math.max(labelMaxLen, 12) : Math.max(labelMaxLen, 16);

  data.forEach((item, i) => {
    const cx = padding.left + slot * i + slot / 2;
    const h = (item.votes / maxVotes) * plotH;
    const x = cx - colW / 2;
    const y = baseY - h;
    const isWinner = isWinnerByRank(item.rank, winnerCount) && item.votes > 0;

    if (h > 0) {
      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, isWinner ? '#F59E0B' : COLUMN_HEX_LIGHT);
      grad.addColorStop(1, isWinner ? WINNER_HEX : COLUMN_HEX);
      roundRectTopPath(ctx, x, y, colW, h, 5);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Vote count above the column
    ctx.fillStyle = isWinner ? '#B45309' : '#0F172A';
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(item.votes), cx, y - 4);

    // Angled candidate label beneath the axis (prevents overlap)
    ctx.save();
    ctx.translate(cx, baseY + 10);
    ctx.rotate(labelAngle);
    ctx.fillStyle = isWinner ? '#B45309' : '#475569';
    ctx.font = `${isWinner ? '700' : '500'} 9px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateChartLabel(item.name, labelLen), 0, 0);
    ctx.restore();
  });

  return canvasToPng(canvas);
}

/** Full pie chart — vote share (mirrors the Results tab) with a legend. */
function renderPieChartImage(data, winnerCount, logicalW, logicalH, labelMaxLen = 18) {
  const { canvas, ctx } = createHiDPICanvas(logicalW, logicalH);
  drawChartFrame(ctx, logicalW, logicalH, 'Vote Share', 'Proportional breakdown of all votes', PIE_COLORS[0]);

  const total = data.reduce((sum, d) => sum + d.votes, 0);
  const cx = logicalW * 0.28;
  const cy = 58 + (logicalH - 58) * 0.52;
  const R = Math.min(logicalW * 0.24, (logicalH - 58) * 0.42);

  if (total === 0) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = `400 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No votes recorded', cx, cy);
    return canvasToPng(canvas);
  }

  const colorFor = (item, i) =>
    (isWinnerByRank(item.rank, winnerCount) && item.votes > 0)
      ? WINNER_HEX
      : PIE_COLORS[i % PIE_COLORS.length];

  // Soft drop shadow beneath the whole pie for depth.
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.20)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // Slices
  let startAngle = -Math.PI / 2;
  data.forEach((item, i) => {
    const slice = (item.votes / total) * Math.PI * 2;
    if (slice <= 0) return;
    const endAngle = startAngle + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colorFor(item, i);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Percentage label on slices large enough to read
    if (slice > 0.28) {
      const mid = startAngle + slice / 2;
      const lx = cx + Math.cos(mid) * R * 0.62;
      const ly = cy + Math.sin(mid) * R * 0.62;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${((item.votes / total) * 100).toFixed(1)}%`, lx, ly);
      ctx.restore();
    }
    startAngle = endAngle;
  });

  // Glossy inner highlight for a polished finish.
  const gloss = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  gloss.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = gloss;
  ctx.fill();

  // Legend — color chip, name, votes and share (winner rows highlighted).
  const legendX = logicalW * 0.54;
  const legendRight = logicalW - 18;
  const rows = data.length;
  const availH = logicalH - 76;
  const rowH = Math.min(24, availH / Math.max(rows, 1));
  let legendY = 76 + (availH - rowH * rows) / 2 + rowH / 2;

  data.forEach((item, i) => {
    const pct = ((item.votes / total) * 100).toFixed(1);
    const isWinner = isWinnerByRank(item.rank, winnerCount) && item.votes > 0;

    if (isWinner) {
      ctx.fillStyle = '#FFFBEB';
      roundRectPath(ctx, legendX - 6, legendY - rowH / 2 + 1, legendRight - legendX + 12, rowH - 2, 5);
      ctx.fill();
    }

    ctx.fillStyle = colorFor(item, i);
    ctx.beginPath();
    ctx.arc(legendX + 4, legendY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isWinner ? '#92400E' : '#334155';
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateChartLabel(item.name, labelMaxLen), legendX + 16, legendY);

    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 9px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${item.votes} votes`, legendRight - 46, legendY);

    ctx.fillStyle = '#0F172A';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, legendRight, legendY);
    legendY += rowH;
  });

  return canvasToPng(canvas);
}

/* ------------------------------------------------------------------ *
 * PDF layout primitives
 * ------------------------------------------------------------------ */

const MARGIN = 16;
const FOOTER_RESERVE = 16;

function setColor(doc, kind, rgb) {
  if (kind === 'fill') doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  else if (kind === 'draw') doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

/** Slim running header for interior pages. Returns the y to start content. */
function drawRunningHeader(doc, pageWidth, title) {
  setColor(doc, 'text', C.brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('AMARVOTE', MARGIN, 14);

  setColor(doc, 'text', C.faint);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(title, pageWidth - MARGIN, 14, { align: 'right' });

  setColor(doc, 'draw', C.gold);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 17, MARGIN + 18, 17);
  setColor(doc, 'draw', C.line);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 20, 17, pageWidth - MARGIN, 17);

  return 26;
}

/** Section heading with accent rule. Returns next y. */
function drawSectionHeader(doc, x, y, title, subtitle) {
  setColor(doc, 'fill', C.brand);
  doc.roundedRect(x, y - 4, 3.2, 9, 1.2, 1.2, 'F');

  setColor(doc, 'text', C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, x + 7, y + 3);
  let next = y + 8;
  if (subtitle) {
    setColor(doc, 'text', C.sub);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(subtitle, x + 7, next + 2.5);
    next += 6;
  }
  return next + 4;
}

/* ------------------------------------------------------------------ *
 * Cover page
 * ------------------------------------------------------------------ */

function drawCoverPage(doc, pageWidth, contentWidth, opts) {
  const {
    electionData, electionId, processedResults, ranked,
    winnerCount, formatGeneratedAt,
  } = opts;

  const heroH = 96;

  // Hero background (rasterized gradient)
  const heroImg = renderHeroBackground(pageWidth * 2, heroH * 2);
  doc.addImage(heroImg, 'PNG', 0, 0, pageWidth, heroH, undefined, 'FAST');

  // Brand row
  setColor(doc, 'text', C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AMARVOTE', MARGIN, 20);
  setColor(doc, 'text', [199, 210, 254]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('SECURE • VERIFIABLE • END-TO-END ENCRYPTED', MARGIN, 25.5);

  // Eyebrow
  setColor(doc, 'text', [165, 180, 252]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('OFFICIAL ELECTION RESULTS', MARGIN, 45);

  // Title (large, wrapped)
  const title = electionData?.electionTitle || 'Untitled Election';
  setColor(doc, 'text', C.white);
  doc.setFont('helvetica', 'bold');
  let titleSize = 30;
  let titleLines = doc.splitTextToSize(title, contentWidth);
  while (titleLines.length > 2 && titleSize > 18) {
    titleSize -= 2;
    doc.setFontSize(titleSize);
    titleLines = doc.splitTextToSize(title, contentWidth);
  }
  doc.setFontSize(titleSize);
  const shown = titleLines.slice(0, 2);
  let ty = 45 + 12;
  shown.forEach((line) => {
    doc.text(line, MARGIN, ty);
    ty += titleSize * 0.42;
  });

  // Certified tag
  setColor(doc, 'text', [199, 210, 254]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Certified Tally Report  •  Generated ${formatGeneratedAt || '—'}`, MARGIN, heroH - 8);

  let y = heroH + 12;

  // Description block
  const description = electionData?.electionDescription;
  if (description && String(description).trim()) {
    setColor(doc, 'text', C.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ABOUT THIS ELECTION', MARGIN, y);
    y += 5;
    setColor(doc, 'text', C.body);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const descLines = doc.splitTextToSize(String(description).trim(), contentWidth);
    const clipped = descLines.slice(0, 4);
    doc.text(clipped, MARGIN, y);
    y += clipped.length * 4.6 + 6;
  }

  // Winner spotlight
  y = drawWinnerSpotlight(doc, pageWidth, contentWidth, y, ranked, winnerCount);

  // Key metrics
  y += 2;
  const totalCast = ranked.reduce((s, r) => s + r.votes, 0);
  drawMetricCards(doc, pageWidth, contentWidth, y, [
    { label: 'ELIGIBLE VOTERS', value: fmtNum(processedResults.totalEligibleVoters) },
    { label: 'VOTERS WHO VOTED', value: fmtNum(processedResults.totalVotedUsers ?? 0) },
    { label: 'VOTER TURNOUT', value: `${processedResults.turnoutRate ?? 0}%` },
    { label: 'CANDIDATES', value: String(ranked.length) },
  ]);
}

function fmtNum(v) {
  if (v == null || v === '—') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-US');
}

function drawWinnerSpotlight(doc, pageWidth, contentWidth, y, ranked, winnerCount) {
  const winners = ranked.filter((r) => isWinnerByRank(r.rank, winnerCount) && r.votes > 0);
  const panelH = winners.length > 3 ? 40 : 34;

  const panelImg = renderSoftPanel(contentWidth * 2, panelH * 2, '#FFFBEB', '#FEF9C3');
  doc.addImage(panelImg, 'PNG', MARGIN, y, contentWidth, panelH, undefined, 'FAST');
  setColor(doc, 'draw', C.goldLine);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, contentWidth, panelH, 3.2, 3.2, 'S');

  setColor(doc, 'text', C.goldDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(winnerCount > 1 ? `DECLARED WINNERS · TOP ${winnerCount}` : 'DECLARED WINNER', MARGIN + 7, y + 8);

  if (winners.length === 0) {
    setColor(doc, 'text', C.muted);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.text('No winner declared — no votes were recorded.', MARGIN + 7, y + 20);
    return y + panelH + 6;
  }

  if (winners.length === 1) {
    const w = winners[0];
    const imageSize = 14;
    let textX = MARGIN + 7;
    const textY = y + 22;

    if (w.candidatePicDataUrl) {
      drawCandidateImage(doc, w.candidatePicDataUrl, MARGIN + 7, y + 10, imageSize);
      textX = MARGIN + 7 + imageSize + 4;
    }

    doc.setFont('helvetica', 'bold');
    setColor(doc, 'text', C.ink);
    let size = 20;
    doc.setFontSize(size);
    let nameLines = doc.splitTextToSize(w.name, contentWidth - 70 - (w.candidatePicDataUrl ? imageSize + 4 : 0));
    while (nameLines.length > 1 && size > 12) {
      size -= 2;
      doc.setFontSize(size);
      nameLines = doc.splitTextToSize(w.name, contentWidth - 70 - (w.candidatePicDataUrl ? imageSize + 4 : 0));
    }
    doc.text(nameLines[0], textX, textY);

    // Votes / share on the right
    setColor(doc, 'text', C.goldDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(`${fmtNum(w.votes)}`, pageWidth - MARGIN - 7, y + 18, { align: 'right' });
    setColor(doc, 'text', C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`votes · ${w.percentage}% share`, pageWidth - MARGIN - 7, y + 25, { align: 'right' });
    return y + panelH + 6;
  }

  // Multiple winners — compact list
  const list = winners.slice(0, 4);
  let ly = y + 15;
  list.forEach((w) => {
    let nameX = MARGIN + 22;
    if (w.candidatePicDataUrl) {
      drawCandidateImage(doc, w.candidatePicDataUrl, MARGIN + 20, ly - 4.5, 8);
      nameX = MARGIN + 31;
    }
    setColor(doc, 'text', C.goldDark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(formatOrdinal(w.rank), MARGIN + 7, ly);
    setColor(doc, 'text', C.ink);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(w.name, contentWidth - 60 - (w.candidatePicDataUrl ? 10 : 0))[0], nameX, ly);
    setColor(doc, 'text', C.sub);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${fmtNum(w.votes)} votes · ${w.percentage}%`, pageWidth - MARGIN - 7, ly, { align: 'right' });
    ly += 6.2;
  });
  return y + panelH + 6;
}

function drawMetricCards(doc, pageWidth, contentWidth, y, stats) {
  const gap = 6;
  const cardW = (contentWidth - gap * (stats.length - 1)) / stats.length;
  const cardH = 30;
  stats.forEach((stat, i) => {
    const x = MARGIN + i * (cardW + gap);
    setColor(doc, 'fill', C.surface);
    setColor(doc, 'draw', C.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 3.5, 3.5, 'FD');

    setColor(doc, 'fill', C.brand);
    doc.roundedRect(x, y, 2.4, cardH, 1.2, 1.2, 'F');

    setColor(doc, 'text', C.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(stat.label, x + 6, y + 9);

    setColor(doc, 'text', C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text(String(stat.value), x + 6, y + 23);
  });
  return y + cardH + 8;
}

/* ------------------------------------------------------------------ *
 * Election overview page
 * ------------------------------------------------------------------ */

function drawOverviewPage(doc, pageWidth, contentWidth, opts) {
  const { electionData, electionId, processedResults, winnerCount } = opts;
  let y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  y = drawSectionHeader(doc, MARGIN, y + 2, 'Election Overview', 'Configuration, timeline and governance');

  // Config grid (2 columns of key/value cards)
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
  y = drawKeyValueGrid(doc, contentWidth, y, cfg);

  // Guardians & security
  y += 4;
  y = drawSectionHeader(doc, MARGIN, y, 'Guardians & Threshold Security',
    'Results require a quorum of guardians to jointly decrypt the tally');

  const totalGuardians = electionData?.numberOfGuardians || electionData?.totalGuardians
    || (electionData?.guardians?.length ?? 0);
  const quorum = electionData?.electionQuorum || 0;
  y = drawMetricCards(doc, pageWidth, contentWidth, y, [
    { label: 'GUARDIANS', value: String(totalGuardians) },
    { label: 'QUORUM REQUIRED', value: String(quorum) },
    { label: 'SUBMITTED KEYS', value: String(electionData?.guardiansSubmitted ?? totalGuardians) },
  ]);

  const guardians = electionData?.guardians || [];
  if (guardians.length > 0) {
    y = drawGuardianTable(doc, contentWidth, y, guardians);
  }

  // Reserved blank space (Cryptographic Verification section removed intentionally).
  y += 60;
}

function drawKeyValueGrid(doc, contentWidth, y, pairs) {
  const gap = 6;
  const colW = (contentWidth - gap) / 2;
  const rowH = 14;
  pairs.forEach((pair, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (colW + gap);
    const cy = y + row * (rowH + 4);

    setColor(doc, 'fill', C.white);
    setColor(doc, 'draw', C.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cy, colW, rowH, 2.6, 2.6, 'FD');

    setColor(doc, 'text', C.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text(String(pair[0]).toUpperCase(), x + 5, cy + 5.5);

    setColor(doc, 'text', C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const val = doc.splitTextToSize(String(pair[1] ?? '—'), colW - 10)[0];
    doc.text(val, x + 5, cy + 11);
  });
  const rows = Math.ceil(pairs.length / 2);
  return y + rows * (rowH + 4) + 2;
}

function drawGuardianTable(doc, contentWidth, y, guardians) {
  setColor(doc, 'text', C.muted);
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
      textColor: C.body,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: C.surface },
    headStyles: {
      fillColor: C.brandBg,
      textColor: C.brandDark,
      fontStyle: 'bold',
      fontSize: 7.5,
      lineColor: C.line,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', textColor: C.muted },
      1: { cellWidth: contentWidth * 0.42, fontStyle: 'bold', textColor: C.ink },
      2: { cellWidth: contentWidth * 0.42, textColor: C.sub },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_RESERVE },
  });
  return (doc.lastAutoTable?.finalY ?? y) + 4;
}

/* ------------------------------------------------------------------ *
 * Visual analytics page(s)
 * ------------------------------------------------------------------ */

/** Place a chart image scaled to `width`, preserving aspect ratio. Adds a
 *  new page (with header) first if it would not fit fully on the current page. */
function placeChart(state, dataUrl, logicalW, logicalH, width) {
  const height = width * (logicalH / logicalW);
  if (state.y + height > state.pageHeight - FOOTER_RESERVE) {
    state.doc.addPage();
    state.y = drawRunningHeader(state.doc, state.pageWidth, 'Visual Analytics');
    state.y = drawSectionHeader(state.doc, MARGIN, state.y + 2, 'Visual Analytics (continued)', null);
  }
  state.doc.addImage(dataUrl, 'PNG', MARGIN, state.y, width, height, undefined, 'FAST');
  state.y += height + 7;
}

function drawAnalyticsPage(doc, pageWidth, pageHeight, contentWidth, ranked, winnerCount) {
  let y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  y = drawSectionHeader(doc, MARGIN, y + 2, 'Visual Analytics',
    'High-resolution charts rendered at print quality · winners highlighted in amber');

  const state = { doc, pageWidth, pageHeight, y };
  const n = ranked.length;

  // Column chart — vote distribution. Widen the canvas as candidates grow so
  // columns and angled labels keep breathing room (labels adapt internally).
  const colLogicalW = Math.min(920, Math.max(660, 120 + n * 44));
  const colLogicalH = 460;
  const colImg = renderColumnChartImage(ranked, winnerCount, colLogicalW, colLogicalH);
  placeChart(state, colImg, colLogicalW, colLogicalH, contentWidth);

  // Pie chart — vote share.
  const pieLogicalW = 620;
  const pieLogicalH = Math.min(430, Math.max(230, 96 + n * 22));
  const pieImg = renderPieChartImage(ranked, winnerCount, pieLogicalW, pieLogicalH);
  placeChart(state, pieImg, pieLogicalW, pieLogicalH, contentWidth);
}

/* ------------------------------------------------------------------ *
 * Detailed ledger page(s)
 * ------------------------------------------------------------------ */

function estimateCandidateCellHeight(doc, row, colWidth) {
  const hasImage = !!row.candidatePicDataUrl;
  const textOffset = hasImage ? CANDIDATE_IMG_MM + 4 : 0;
  const innerW = colWidth - 8 - textOffset;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const nameLines = doc.splitTextToSize(row.name || '', innerW);
  let height = 5 + nameLines.length * 4;
  if (row.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const descLines = doc.splitTextToSize(row.description, innerW).slice(0, 3);
    height += 2 + descLines.length * 3.2;
  }
  const imageBlock = hasImage ? CANDIDATE_IMG_MM + 4 : 0;
  return Math.max(15, height + 5, imageBlock);
}

function drawCandidateCell(doc, cell, row, isWinner) {
  const { x, y, width, height } = cell;
  const padX = 4;
  const imageSize = CANDIDATE_IMG_MM;
  let textX = x + padX;
  let cursorY = y + 5.5;

  if (row.candidatePicDataUrl) {
    const imageY = y + Math.max(2, (height - imageSize) / 2);
    drawCandidateImage(doc, row.candidatePicDataUrl, x + padX, imageY, imageSize);
    textX = x + padX + imageSize + 3;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  setColor(doc, 'text', isWinner ? C.goldDark : C.ink);
  const nameLines = doc.splitTextToSize(row.name || '', width - (textX - x) - padX);
  doc.text(nameLines, textX, cursorY);
  cursorY += nameLines.length * 4 + 1;

  if (row.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(doc, 'text', C.muted);
    const descLines = doc.splitTextToSize(row.description, width - (textX - x) - padX).slice(0, 3);
    doc.text(descLines, textX, cursorY);
  }
}

function drawShareBar(doc, cell, pct, isWinner) {
  const { x, y, width, height } = cell;
  const barW = width - 8;
  const barX = x + 4;
  const barY = y + height - 6;
  setColor(doc, 'fill', C.line);
  doc.roundedRect(barX, barY, barW, 2.2, 1.1, 1.1, 'F');
  const fillW = Math.max((Number(pct) / 100) * barW, 0);
  if (fillW > 0) {
    setColor(doc, 'fill', isWinner ? C.gold : C.brand);
    doc.roundedRect(barX, barY, fillW, 2.2, 1.1, 1.1, 'F');
  }
}

function drawWinnerPill(doc, x, y, w, h) {
  const pillW = 22;
  const pillH = 7;
  const px = x + (w - pillW) / 2;
  const py = y + (h - pillH) / 2;
  setColor(doc, 'fill', C.goldBg);
  doc.roundedRect(px, py, pillW, pillH, 3.5, 3.5, 'F');
  setColor(doc, 'text', C.goldDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('WINNER', px + pillW / 2, py + 4.8, { align: 'center' });
}

function drawLedgerPage(doc, pageWidth, pageHeight, contentWidth, enrichedRanked, winnerCount) {
  let y = drawRunningHeader(doc, pageWidth, 'Official Election Results');
  y = drawSectionHeader(doc, MARGIN, y + 2, 'Detailed Standings Ledger',
    `Full candidate names and descriptions · ${enrichedRanked.length} candidates · competition ranking (1224) rules`);

  const colRank = contentWidth * 0.10;
  const colCandidate = contentWidth * 0.52;
  const colVotes = contentWidth * 0.13;
  const colShare = contentWidth * 0.13;
  const colStatus = contentWidth * 0.12;

  // Continuation pages need their own running header; track page count so the
  // first page (which already has a full section header) is not re-decorated.
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
      textColor: C.body,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: C.surface },
    headStyles: {
      fillColor: C.navy,
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
      if (ledgerPage === 1) return; // first page already has the full header
      drawRunningHeader(doc, pageWidth, 'Official Election Results');
      setColor(doc, 'text', C.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Detailed Standings Ledger', MARGIN, 24);
      setColor(doc, 'text', C.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('(continued)', MARGIN + 46, 24);
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
      if (winner) {
        if (data.column.index === 0) {
          data.cell.styles.textColor = C.goldDark;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 0 || data.column.index === 1) {
          data.cell.styles.fillColor = C.goldBg;
        }
      }
    },
    didDrawCell: (data) => {
      const row = enrichedRanked[data.row.index];
      if (data.section !== 'body' || !row) return;
      const winner = isWinnerByRank(row.rank, winnerCount) && row.votes > 0;
      if (data.column.index === 1) {
        drawCandidateCell(doc, data.cell, row, winner);
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
 * Footer (applied to every page at the end)
 * ------------------------------------------------------------------ */

function addCertifiedFooter(doc, pageWidth, pageHeight) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    setColor(doc, 'draw', C.line);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);

    setColor(doc, 'text', C.muted);
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

  // Page 1 — Cover
  drawCoverPage(doc, pageWidth, contentWidth, opts);

  // Page 2 — Election Overview
  doc.addPage();
  drawOverviewPage(doc, pageWidth, contentWidth, opts);

  // Page 3 — Visual Analytics
  doc.addPage();
  drawAnalyticsPage(doc, pageWidth, pageHeight, contentWidth, enrichedRanked, winnerCount);

  // Page 4+ — Detailed Standings Ledger
  doc.addPage();
  drawLedgerPage(doc, pageWidth, pageHeight, contentWidth, enrichedRanked, winnerCount);

  addCertifiedFooter(doc, pageWidth, pageHeight);

  const safeTitle = (electionData?.electionTitle || 'election')
    .replace(/[^a-z0-9]+/gi, '_')
    .slice(0, 60);
  doc.save(`election-results-${safeTitle}-${electionId}.pdf`);
}
