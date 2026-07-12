import React, { useMemo } from 'react';

/**
 * Shared N-of-M guardian quorum visualization.
 * Gold = authority/ceremony, indigo = threshold shares, teal = proof/complete.
 * Filled vs unfilled nodes — never color alone.
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
    ? 'border-aurora/50 bg-aurora/15 text-aurora shadow-aurora'
    : quorumMet
      ? mode === 'decryption' || mode === 'combine'
        ? 'border-brand/50 bg-brand/15 text-brand shadow-brand'
        : 'border-threshold/50 bg-threshold/15 text-threshold shadow-threshold'
      : 'border-white/15 bg-ink/80 text-paper-muted';

  const preferReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-observatory p-4 text-paper ${className}`}
      role="img"
      aria-label={`${modeLabel}: ${filledCount} of ${n} guardians contributed. Threshold ${k} of ${n} required.${quorumMet ? ' Quorum met.' : ''} ${combined ? 'Combined.' : ''}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-threshold">
            Guardian quorum
          </p>
          <p className="mt-0.5 font-display text-sm font-semibold text-paper">{modeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-threshold/35 bg-threshold/10 px-2.5 py-1 text-xs font-semibold text-threshold">
            <span className="h-1.5 w-1.5 rounded-full bg-threshold" aria-hidden />
            {k} of {n} required
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              quorumMet
                ? 'border-aurora/35 bg-aurora/10 text-aurora'
                : 'border-white/15 bg-white/5 text-paper-muted'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${quorumMet ? 'bg-aurora' : 'bg-paper-muted'}`}
              aria-hidden
            />
            {filledCount} of {n} responded
          </span>
        </div>
      </div>

      <div className="relative mx-auto" style={{ width: size, height: size }}>
        {/* Orbital ring */}
        <div
          className="absolute inset-[18%] rounded-full border border-dashed border-white/10"
          aria-hidden
        />

        {/* Shard rays toward center */}
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
                stroke={combined ? '#3FDDC4' : '#7C6FF0'}
                strokeWidth="1.25"
                strokeOpacity={preferReduced ? 0.55 : undefined}
                className={preferReduced ? undefined : 'quorum-shard-ray'}
              />
            );
          })}
        </svg>

        {/* Center joint key / combine point */}
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

        {/* Guardian nodes */}
        {nodes.map((node, i) => {
          const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius * 2.05;
          const y = cy + Math.sin(angle) * radius * 2.05;
          const isFilled = node.filled;
          const fillClass = isFilled
            ? mode === 'decryption' || mode === 'combine'
              ? 'border-threshold bg-threshold text-paper shadow-threshold'
              : 'border-brand bg-brand text-deep shadow-brand'
            : 'border-white/20 bg-ink/70 text-paper-muted';

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
              <span className="mt-1 max-w-[4.5rem] truncate text-center text-[9px] text-paper-muted">
                {node.label}
              </span>
              {node.secondaryFilled && (
                <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-aurora">
                  backup
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-center text-xs text-paper-muted">
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