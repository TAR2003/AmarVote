import React from 'react';
import { Circle, G, Rect, Svg, Text as SvgText } from '@react-pdf/renderer';
import { truncate } from '../../utils/certifiedLedger/data';
import { CHART_INNER_WIDTH_PT, tokens } from '../../utils/certifiedLedger/tokens';

export function BarChart({ candidates, maxLabelChars }) {
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
        const fill = c.isWinner ? tokens.violet : tokens.violetSoft;
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
            {c.isWinner ? (
              <Rect
                x={x}
                y={baseline - barHeight - 6}
                width={barWidth}
                height={3}
                fill={tokens.gold}
                rx={1}
              />
            ) : null}
            <SvgText
              x={x + barWidth / 2}
              y={baseline - barHeight - 12}
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
 * Donut with shared `colors` array (same order as legend).
 * Ivory gaps between slices keep boundaries legible when tones are close.
 */
export function DonutChart({ candidates, colors }) {
  const size = 300;
  const cx = 150;
  const cy = 150;
  const radius = 80;
  const stroke = 40;
  const circumference = 2 * Math.PI * radius;
  const total = candidates.reduce((s, c) => s + (c.votes || 0), 0) || 1;
  /** ~2pt visual gap along the arc between adjacent slices. */
  const gap = candidates.length > 1 ? Math.min(4, circumference * 0.008) : 0;

  let offsetAccum = 0;
  const slices = candidates.map((c, i) => {
    const fraction = (c.votes || 0) / total;
    const raw = fraction * circumference;
    const dash = Math.max(0, raw - gap);
    const el = {
      key: `${c.name}-${i}`,
      color: colors[i] || tokens.violetSoft,
      dasharray: `${dash} ${circumference - dash}`,
      dashOffset: -offsetAccum,
    };
    offsetAccum += raw;
    return el;
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      {/* Track so empty vote share still reads as a ring */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={tokens.ivory}
        strokeWidth={stroke}
      />
      {slices.map((s) => (
        <Circle
          key={s.key}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={s.dasharray}
          strokeDashoffset={s.dashOffset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      {/* Ornamental gold ring — not data */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius + 26}
        fill="none"
        stroke={tokens.gold}
        strokeWidth={1}
        opacity={0.55}
      />
      <Circle cx={cx} cy={cy} r={radius - stroke / 2 - 2} fill={tokens.ivory} />
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
