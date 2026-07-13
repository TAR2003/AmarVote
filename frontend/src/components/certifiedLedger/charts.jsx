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

export function DonutChart({ candidates, colors }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 72;
  const stroke = 28;
  const circumference = 2 * Math.PI * radius;
  const total = candidates.reduce((s, c) => s + (c.votes || 0), 0) || 1;

  let offset = 0;
  const slices = candidates.map((c, i) => {
    const portion = (c.votes || 0) / total;
    const length = portion * circumference;
    const dashOffset = -offset;
    offset += length;
    return {
      key: `${c.name}-${i}`,
      color: colors[i] || tokens.violetSoft,
      dasharray: `${length} ${circumference - length}`,
      dashOffset,
    };
  });

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx}
        cy={cy}
        r={radius + stroke / 2 + 8}
        stroke={tokens.gold}
        strokeWidth={1}
        fill="none"
      />
      {slices.map((s) => (
        <Circle
          key={s.key}
          cx={cx}
          cy={cy}
          r={radius}
          stroke={s.color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={s.dasharray}
          strokeDashoffset={s.dashOffset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
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
