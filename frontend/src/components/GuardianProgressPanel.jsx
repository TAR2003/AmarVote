import React, { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { electionApi } from '../utils/electionApi';
import useElectionProgressStream from '../hooks/useElectionProgressStream';
import {
  getSnapshotFromEvent,
  pickGuardians,
  shouldApplyGuardianPanelEvent,
} from '../utils/progressSnapshot';

/**
 * Clickable guardian cards — any election participant can view decryption progress.
 */
const GuardianProgressPanel = ({ electionId, guardians = [], onElectionRefresh = null }) => {
  const [progressList, setProgressList] = useState([]);
  const [selectedGuardian, setSelectedGuardian] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyGuardiansFromEvent = (event) => {
    if (!shouldApplyGuardianPanelEvent(event)) return;
    const guardiansProgress = pickGuardians(getSnapshotFromEvent(event));
    if (guardiansProgress) {
      setProgressList(guardiansProgress);
    }
  };

  const refreshProgress = async () => {
    if (!electionId) return;
    setIsRefreshing(true);
    try {
      if (onElectionRefresh) {
        await onElectionRefresh();
      }
      const data = await electionApi.getAllGuardiansDecryptionProgress(electionId);
      setProgressList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load guardian progress', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useElectionProgressStream(electionId, {
    enabled: Boolean(electionId),
    onEvent: applyGuardiansFromEvent,
  });

  useEffect(() => {
    setSelectedGuardian(null);
  }, [electionId]);

  const merged = (guardians.length ? guardians : progressList).map((g) => {
    const match = progressList.find((p) => p.guardianId === g.guardianId || p.guardianEmail === g.userEmail);
    return { ...g, ...match };
  });

  const active = selectedGuardian
    ? merged.find((g) => g.guardianId === selectedGuardian.guardianId) || selectedGuardian
    : null;

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="font-display text-sm font-semibold text-deep">Guardian Decryption Progress</h4>
        <button
          type="button"
          onClick={refreshProgress}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 btn-ghost px-2.5 py-1 text-xs"
          title="Refresh guardian progress"
        >
          <FiRefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {merged.length === 0 && progressList.length === 0 ? (
        <p className="text-sm text-slate-500">Connecting to live progress…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {merged.map((guardian) => {
            const pct = Math.round(guardian.progressPercentage || 0);
            const label = guardian.guardianName || guardian.userEmail || `Guardian ${guardian.sequenceOrder || ''}`;
            return (
              <button
                key={guardian.guardianId || guardian.userEmail}
                type="button"
                onClick={() => setSelectedGuardian(guardian)}
                className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-frost/70 p-3 transition hover:border-brand/40 hover:bg-glacier"
              >
                <div className="h-14 w-14">
                  <CircularProgressbar
                    value={pct}
                    text={`${pct}%`}
                    styles={buildStyles({
                      textSize: '22px',
                      pathColor: guardian.decryptedOrNot ? '#10b981' : '#00B4D8',
                      textColor: '#0b132b',
                      trailColor: '#e5e7eb',
                    })}
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-center text-xs font-medium text-ink">{label}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{guardian.status || 'idle'}</p>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div className="mt-4 rounded-2xl border border-brand/20 bg-glacier/60 p-4 text-sm text-ink">
          <p className="font-semibold">{active.guardianName || active.userEmail}</p>
          <p>Phase: {active.currentPhase || active.status || 'not started'}</p>
          <p>
            Chunks: {active.processedChunks ?? 0} / {active.totalChunks ?? 0}
          </p>
        </div>
      )}
    </div>
  );
};

export default GuardianProgressPanel;
