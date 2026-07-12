import React from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

/**
 * Live circular progress panel for async election processes (tally, combine).
 */
export default function ProcessProgressPanel({
  title,
  status,
  onRefresh,
  isRefreshing = false,
}) {
  const totalChunks = status?.totalChunks || 0;
  const processedChunks = status?.processedChunks || 0;
  const isCompleted = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isActive = status?.status === 'in_progress' || status?.status === 'pending';

  let pct = 0;
  if (isCompleted) {
    pct = 100;
  } else if (totalChunks > 0) {
    pct = Math.round((processedChunks / totalChunks) * 100);
  } else if (isActive) {
    pct = 5;
  }

  const pathColor = isFailed ? '#D9614F' : isCompleted ? '#3FC7B8' : '#5C52C4';
  const statusLabel = isFailed
    ? 'Failed'
    : isCompleted
      ? 'Completed'
      : isActive
        ? 'In progress'
        : 'Not started';

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="font-display text-sm font-semibold text-deep">{title}</h4>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 btn-ghost px-2.5 py-1 text-xs"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      <div className="flex flex-col items-center sm:flex-row sm:items-center sm:gap-6">
        <div className="h-24 w-24 flex-shrink-0">
          <CircularProgressbar
            value={pct}
            text={`${pct}%`}
            styles={buildStyles({
              textSize: '22px',
              pathColor,
              textColor: '#1B1D2E',
              trailColor: '#e5e7eb',
            })}
          />
        </div>
        <div className="mt-3 text-center sm:mt-0 sm:text-left">
          <p className="text-sm font-medium text-deep">{statusLabel}</p>
          {totalChunks > 0 && (
            <p className="mt-1 font-mono text-xs text-dusk">
              Chunks: {processedChunks} / {totalChunks}
            </p>
          )}
          {status?.message && (
            <p className="mt-1 text-xs text-dusk">{status.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
