import React from 'react';
import { Circle, G, Path, Rect, Svg, Text as SvgText } from '@react-pdf/renderer';
import { truncate } from '../../utils/certifiedLedger/data';
import { CHART_INNER_WIDTH_PT, tokens } from '../../utils/certifiedLedger/tokens';

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Filled donut wedge path (outer arc → inner arc).
 * Angles in degrees, 0 = top, clockwise positive to match vote accumulation.
 */
function describeDonutSlice(cx, cy, outerR, innerR, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep <= 0.001) return '';

  // Full circle can't be a single arc — use two half-rings.
  if (sweep >= 359.999) {
    const mid = startAngle + 180;
    const o0 = polarToCartesian(cx, cy, outerR, startAngle);
    const o1 = polarToCartesian(cx, cy, outerR, mid);
    const o2 = polarToCartesian(cx, cy, outerR, endAngle);
    const i0 = polarToCartesian(cx, cy, innerR, endAngle);
    const i1 = polarToCartesian(cx, cy, innerR, mid);
    const i2 = polarToCartesian(cx, cy, innerR, startAngle);
    return [
      `M ${o0.x} ${o0.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${o1.x} ${o1.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${o2.x} ${o2.y}`,
      `L ${i0.x} ${i0.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${i2.x} ${i2.y}`,
      'Z',
    ].join(' ');
  }

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export function BarChart({ candidates, colors, maxLabelChars }) {
  const barCount = Math.max(1, candidates.length);
  const chartWidth = CHART_INNER_WIDTH_PT;
  const gap = barCount > 8 ? 8 : 16;
  const barWidth = Math.min(70, (chartWidth - gap * (barCount - 1)) / barCount);
  const maxVotes = Math.max(1, ...candidates.map((c) => c.votes || 0));
  const baseline = 240;
  const totalWidth = barCount * barWidth + (barCount - 1) * gap;
  const offsetX = Math.max(0, (chartWidth - totalWidth) / 2);

  return (
    <Svg width={chartWidth} height={280}>
      {candidates.map((c, i) => {
        const barHeight = ((c.votes || 0) / maxVotes) * 200;
        const x = offsetX + i * (barWidth + gap);
        const fill = colors?.[i] || (c.isWinner ? tokens.gold : tokens.violet);
        return (
          <G key={`${c.name}-${i}`}>
            <Rect
              x={x}
              y={baseline - barHeight}
              width={barWidth}
              height={Math.max(1, barHeight)}
              fill={fill}
              rx={2}
            />
            <SvgText
              x={x + barWidth / 2}
              y={baseline - barHeight - 10}
              textAnchor="middle"
              style={{
                fontSize: 8,
                fontFamily: 'JetBrains Mono',
                fill: tokens.ink,
              }}
            >
              {String(c.votes)}
            </SvgText>
            <SvgText
              x={x + barWidth / 2}
              y={baseline + 16}
              textAnchor="middle"
              style={{
                fontSize: 7,
                fontFamily: 'Inter',
                fill: tokens.duskOnLight,
              }}
            >
              {truncate(c.name, maxLabelChars)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/**
 * True proportional donut via filled Path wedges (not stroke-dash circles).
 * Blank gaps from strokeDasharray are avoided — every vote share is a solid slice.
 */
export function DonutChart({ candidates, colors }) {
  const size = 300;
  const cx = 150;
  const cy = 150;
  const outerR = 105;
  const innerR = 58;
  const total = candidates.reduce((s, c) => s + (c.votes || 0), 0) || 1;

  let angle = 0;
  const slices = candidates
    .map((c, i) => {
      const votes = Math.max(0, Number(c.votes) || 0);
      const sweep = (votes / total) * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle = endAngle;
      if (sweep <= 0) return null;
      const d = describeDonutSlice(cx, cy, outerR, innerR, startAngle, endAngle);
      if (!d) return null;
      return {
        key: `${c.name}-${i}`,
        d,
        color: colors?.[i] || tokens.violet,
      };
    })
    .filter(Boolean);

  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      {slices.map((s) => (
        <Path
          key={s.key}
          d={s.d}
          fill={s.color}
          stroke={tokens.ivory}
          strokeWidth={1.5}
        />
      ))}
      <Circle
        cx={cx}
        cy={cy}
        r={outerR + 8}
        fill="none"
        stroke={tokens.gold}
        strokeWidth={1}
        opacity={0.45}
      />
      <Circle cx={cx} cy={cy} r={innerR - 1} fill={tokens.ivory} />
      <SvgText
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        style={{
          fontSize: 9,
          fontFamily: 'Inter',
          fill: tokens.duskOnLight,
        }}
      >
        TOTAL
      </SvgText>
      <SvgText
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        style={{
          fontSize: 16,
          fontFamily: 'Fraunces',
          fill: tokens.ink,
        }}
      >
        {String(total)}
      </SvgText>
    </Svg>
  );
}
