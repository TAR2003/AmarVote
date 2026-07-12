import React, { useMemo } from 'react';

/**
 * Shared N-of-M guardian quorum visualization.
 * Violet = key fragments / threshold shares, teal = proof/complete.
 * Filled vs unfilled nodes — never color alone. Skippable via prefers-reduced-motion.
 */
export default function GuardianQuorumViz({
  total = 0,
  filled = 0,
  threshold = 0,
  guardians = [],
  mode = 'ceremony',
  combined = false,
  title,
  className = '',
}) {
  const n = Math.max(0, Number(total) || 0);
  const k = Math.max(0, Number(threshold) || n);
  const filledCount = Math.min(n, Math.max(0, Number(filled) || 0));
  const quorumMet = filledCount >= k && k > 0;

  const nodes = useMemo(() => {
    if (guardians.length > 0) {
      return guardians.slice(0, n || guardians.length).map((g, i) => ({
        id: g.id || g.userEmail || g.guardianId || `g-${i}`,
        label: g.label || g.userName || g.userEmail || `G${i + 1}`,
        filled: Boolean(g.filled ?? (i < filledCount)),
        secondaryFilled: Boolean(g.secondaryFilled),
      }));
    }
    return Array.from({ length: n }, (_, i) => ({
      id: `g-${i}`,
      label: `G${i + 1}`,
      filled: i < filledCount,
      secondaryFilled: false,
    }));
  }, [guardians, n, filledCount]);

  const radius = nodes.length > 8 ? 42 : 38;
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;

  const modeLabel =
    title ||
    (mode === 'decryption'
      ? 'Partial decryption'
      : mode === 'combine'
        ? 'Threshold combine'
        : mode === 'ceremony-r2'
          ? 'Backup shares'
          : 'Key ceremony');

  const centerTone = combined
    ? 'border-aurora/50 bg-aurora/15 text-aurora-muted shadow-aurora'
    : quorumMet
      ? mode === 'decryption' || mode === 'combine'
        ? 'border-brand/50 bg-brand/15 text-brand-dark shadow-brand'
        : 'border-threshold/50 bg-threshold/15 text-brand-dark shadow-threshold'
      : 'border-brand/20 bg-paper text-dusk';

  const preferReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  return (
    <div
      className={`rounded-2xl border border-brand/20 bg-observatory p-4 text-ink ${className}`}
      role="img"
      aria-label={`${modeLabel}: ${filledCount} of ${n} guardians contributed. Threshold ${k} of ${n} required.${quorumMet ? ' Quorum met.' : ''} ${combined ? 'Combined.' : ''}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-dark">
            Guardian quorum
          </p>
          <p className="mt-0.5 font-display text-sm font-semibold text-ink">{modeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            {k} of {n} required
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              quorumMet
                ? 'border-aurora/35 bg-sage-soft text-aurora-muted'
                : 'border-ink/10 bg-paper text-dusk'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${quorumMet ? 'bg-aurora' : 'bg-dusk'}`}
              aria-hidden
            />
            {filledCount} of {n} responded
          </span>
        </div>
      </div>

      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <div
          className="absolute inset-[18%] rounded-full border border-dashed border-brand/25"
          aria-hidden
        />

        <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${size} ${size}`} aria-hidden>
          {nodes.map((node, i) => {
            if (!node.filled) return null;
            const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius * 2.05;
            const y = cy + Math.sin(angle) * radius * 2.05;
            return (
              <line
                key={`ray-${node.id}`}
                x1={x}
                y1={y}
                x2={cx}
                y2={cy}
                stroke={combined ? '#3FC7B8' : '#8B7FE8'}
                strokeWidth="1.25"
                strokeOpacity={preferReduced ? 0.55 : undefined}
                className={preferReduced ? undefined : 'quorum-shard-ray'}
              />
            );
          })}
        </svg>

        <div
          className={`absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-center ${centerTone} ${
            combined && !preferReduced ? 'animate-cipher-reveal' : ''
          }`}
        >
          <span className="font-mono text-[9px] uppercase tracking-wider opacity-80">
            {combined ? 'joint' : quorumMet ? 'ready' : 'key'}
          </span>
          <span className="font-display text-[11px] font-semibold leading-tight">
            {combined ? 'formed' : `${filledCount}/${k}`}
          </span>
        </div>

        {nodes.map((node, i) => {
          const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius * 2.05;
          const y = cy + Math.sin(angle) * radius * 2.05;
          const isFilled = node.filled;
          const fillClass = isFilled
            ? mode === 'decryption' || mode === 'combine'
              ? 'border-brand bg-brand-dark text-paper shadow-brand'
              : 'border-brand-dark bg-brand-dark text-paper shadow-brand'
            : 'border-brand/25 bg-paper text-dusk';

          return (
            <div
              key={node.id}
              className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: x, top: y }}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[10px] font-bold ${fillClass} ${
                  isFilled && !preferReduced && !combined ? 'quorum-node-pulse' : ''
                }`}
                title={node.label}
              >
                {i + 1}
              </div>
              <span className="mt-1 max-w-[4.5rem] truncate text-center text-[9px] text-dusk">
                {node.label}
              </span>
              {node.secondaryFilled && (
                <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-aurora-muted">
                  backup
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-center text-xs text-dusk">
        {combined
          ? mode === 'combine' || mode === 'decryption'
            ? 'Threshold shares combined into the election result.'
            : 'Guardian public keys combined into the election public key.'
          : quorumMet
            ? `Threshold met — ${k} of ${n} guardians. Decryption can proceed.`
            : `Waiting for quorum — ${Math.max(0, k - filledCount)} more guardian${k - filledCount === 1 ? '' : 's'} needed.`}
      </p>
    </div>
  );
}
