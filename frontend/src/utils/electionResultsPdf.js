import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatOrdinal, isWinnerByRank } from './electionRankings';

const BRAND = {
  primary: [30, 58, 138],
  primaryMid: [37, 99, 235],
  primaryLight: [219, 234, 254],
  slate: [51, 65, 85],
  slateMuted: [100, 116, 139],
  surface: [248, 250, 252],
  border: [226, 232, 240],
  winner: [245, 158, 11],
  winnerBg: [254, 243, 199],
  winnerText: [146, 64, 14],
  white: [255, 255, 255],
};

const CHART_COLORS = [
  '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777',
  '#0891B2', '#4F46E5', '#16A34A', '#EA580C', '#9333EA',
];

/** Short label for charts — keeps the start of the name to avoid clutter. */
export function truncateChartLabel(name, maxLen = 16) {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(4, maxLen - 1))}…`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function drawRoundRect(ctx, x, y, w, h, r) {
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

function renderHorizontalBarChart(data, { title, labelMaxLen = 16 } = {}) {
  const barHeight = 28;
  const gap = 10;
  const padding = { top: 48, right: 72, bottom: 24, left: 148 };
  const chartWidth = 720;
  const chartHeight = padding.top + padding.bottom + data.length * (barHeight + gap);
  const canvas = document.createElement('canvas');
  canvas.width = chartWidth;
  canvas.height = Math.max(chartHeight, 180);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 15px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText(title, 20, 28);

  const maxVotes = Math.max(...data.map((d) => d.votes), 1);
  const plotW = chartWidth - padding.left - padding.right;

  data.forEach((item, i) => {
    const y = padding.top + i * (barHeight + gap);
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const barW = Math.max((item.votes / maxVotes) * plotW, item.votes > 0 ? 6 : 0);

    ctx.fillStyle = '#64748B';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateChartLabel(item.name, labelMaxLen), padding.left - 10, y + barHeight / 2);

    drawRoundRect(ctx, padding.left, y, plotW, barHeight, 6);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();

    if (barW > 0) {
      drawRoundRect(ctx, padding.left, y, barW, barHeight, 6);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(item.votes), padding.left + barW + 8, y + barHeight / 2);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${item.percentage}%`, chartWidth - 16, y + barHeight / 2);
  });

  return canvas.toDataURL('image/png');
}

function renderDonutChart(data, { title, labelMaxLen = 18 } = {}) {
  const size = 360;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = 118;
  const cy = size / 2 + 12;
  const outerR = 88;
  const innerR = 52;
  const total = data.reduce((sum, d) => sum + d.votes, 0);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 15px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 16, 28);

  if (total === 0) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('No votes recorded', cx - 40, cy);
    return canvas.toDataURL('image/png');
  }

  let startAngle = -Math.PI / 2;
  data.forEach((item, i) => {
    const slice = (item.votes / total) * Math.PI * 2;
    const endAngle = startAngle + slice;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    startAngle = endAngle;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(total), cx, cy - 6);
  ctx.fillStyle = '#64748B';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('total votes', cx, cy + 14);

  const legendX = 210;
  let legendY = 56;
  const rowH = 22;
  data.forEach((item, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legendX, legendY + 6, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = truncateChartLabel(item.name, labelMaxLen);
    const pct = total > 0 ? ((item.votes / total) * 100).toFixed(1) : '0.0';
    ctx.fillText(`${label}  ·  ${pct}%`, legendX + 12, legendY + 6);
    legendY += rowH;
  });

  return canvas.toDataURL('image/png');
}

function renderTurnoutGauge(turnoutRate) {
  const w = 200;
  const h = 120;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const cx = w / 2;
  const cy = h - 12;
  const r = 72;
  const rate = Math.min(100, Math.max(0, Number(turnoutRate) || 0));
  const start = Math.PI;
  const end = Math.PI * 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();

  const progressEnd = start + (rate / 100) * Math.PI;
  const [pr, pg, pb] = hexToRgb(rate >= 50 ? '#2563EB' : '#F59E0B');
  ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, progressEnd);
  ctx.stroke();

  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${rate}%`, cx, cy - 4);
  ctx.fillStyle = '#64748B';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('turnout', cx, cy + 14);

  return canvas.toDataURL('image/png');
}

function drawHeader(doc, pageWidth, margin, electionTitle) {
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setFillColor(...BRAND.primaryMid);
  doc.rect(0, 32, pageWidth, 3, 'F');

  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AmarVote', margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Election Results Report', margin, 22);

  doc.setFontSize(8);
  doc.setTextColor(219, 234, 254);
  const title = electionTitle || 'Untitled Election';
  const truncated = doc.splitTextToSize(title, pageWidth - margin * 2 - 50);
  doc.text(truncated[0], pageWidth - margin, 14, { align: 'right' });
  if (truncated.length > 1) {
    doc.text(truncated[1], pageWidth - margin, 20, { align: 'right' });
  }

  return 44;
}

function drawKpiRow(doc, margin, y, pageWidth, stats) {
  const gap = 4;
  const cardW = (pageWidth - margin * 2 - gap * 3) / 4;
  const cardH = 22;

  stats.forEach((stat, i) => {
    const x = margin + i * (cardW + gap);
    doc.setFillColor(...BRAND.surface);
    doc.setDrawColor(...BRAND.border);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.slateMuted);
    doc.text(stat.label, x + 4, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.primary);
    doc.text(String(stat.value), x + 4, y + 16);
  });

  return y + cardH + 6;
}

function addFooter(doc, pageWidth, pageHeight, margin) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.border);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.slateMuted);
    doc.text('Generated by AmarVote · Confidential election report', margin, pageHeight - 7);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }
}

/**
 * Build a polished multi-section election results PDF with charts and tables.
 */
export function generateElectionResultsPdf({
  electionData,
  electionId,
  processedResults,
  ranked,
  winnerCount,
  formatGeneratedAt,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  let y = drawHeader(doc, pageWidth, margin, electionData?.electionTitle);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BRAND.slate);
  doc.text('Executive Summary', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.slateMuted);
  const metaLeft = [
    `Election ID: ${electionId}`,
    `Generated: ${formatGeneratedAt}`,
    `Max choices per voter: ${electionData?.maxChoices || 1}`,
  ];
  const metaRight = [
    `Winners declared: top ${winnerCount}`,
    `Status: Results finalized`,
    `Report type: Official tally`,
  ];
  metaLeft.forEach((line, i) => {
    doc.text(line, margin, y + i * 5);
    doc.text(metaRight[i], margin + contentWidth / 2, y + i * 5);
  });
  y += metaLeft.length * 5 + 4;

  const totalVotes = ranked.reduce((sum, r) => sum + r.votes, 0);
  y = drawKpiRow(doc, margin, y, pageWidth, [
    { label: 'Eligible voters', value: processedResults.totalEligibleVoters ?? '—' },
    { label: 'Voters who voted', value: processedResults.totalVotedUsers ?? 0 },
    { label: 'Total votes cast', value: totalVotes },
    { label: 'Candidates', value: ranked.length },
  ]);

  const turnoutImg = renderTurnoutGauge(processedResults.turnoutRate);
  doc.addImage(turnoutImg, 'PNG', pageWidth - margin - 42, y - 2, 42, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.slateMuted);
  doc.text(`Voter turnout: ${processedResults.turnoutRate}%`, margin, y + 4);
  y += 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.slate);
  doc.text('Visual Analytics', margin, y);
  y += 4;

  const barImg = renderHorizontalBarChart(ranked, {
    title: 'Vote distribution by candidate',
    labelMaxLen: 18,
  });
  const donutImg = renderDonutChart(ranked, {
    title: 'Vote share breakdown',
    labelMaxLen: 16,
  });

  const chartBlockH = 62;
  doc.setFillColor(...BRAND.surface);
  doc.setDrawColor(...BRAND.border);
  doc.roundedRect(margin, y, contentWidth, chartBlockH + 8, 2, 2, 'FD');

  const halfW = (contentWidth - 6) / 2;
  doc.addImage(barImg, 'PNG', margin + 2, y + 2, halfW, chartBlockH);
  doc.addImage(donutImg, 'PNG', margin + halfW + 4, y + 2, halfW, chartBlockH);
  y += chartBlockH + 14;

  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.slate);
  doc.text('Detailed Results', margin, y);
  y += 4;

  doc.autoTable({
    startY: y,
    head: [['Rank', 'Candidate', 'Votes', 'Share', 'Status']],
    body: ranked.map((row) => {
      const winner = isWinnerByRank(row.rank, winnerCount);
      return [
        formatOrdinal(row.rank),
        row.name,
        String(row.votes),
        `${row.percentage}%`,
        winner ? 'Winner' : '—',
      ];
    }),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak',
      lineColor: BRAND.border,
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: BRAND.surface },
    headStyles: {
      fillColor: BRAND.primary,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: contentWidth - 18 - 20 - 20 - 22 },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 22, halign: 'center' },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw === 'Winner') {
        data.cell.styles.fillColor = BRAND.winnerBg;
        data.cell.styles.textColor = BRAND.winnerText;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 0) {
        const rankText = data.cell.raw;
        const winner = ranked.some(
          (r) => formatOrdinal(r.rank) === rankText && isWinnerByRank(r.rank, winnerCount),
        );
        if (winner) {
          data.cell.styles.textColor = BRAND.winnerText;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ?? y + 20;
  if (tableEndY < pageHeight - 24) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.slateMuted);
    doc.text(
      'Full candidate names are listed in the table above. Chart labels are abbreviated for readability.',
      margin,
      tableEndY + 6,
    );
  }

  addFooter(doc, pageWidth, pageHeight, margin);

  const safeTitle = (electionData?.electionTitle || 'election')
    .replace(/[^a-z0-9]+/gi, '_')
    .slice(0, 60);
  doc.save(`election-results-${safeTitle}-${electionId}.pdf`);
}
