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
    <div className="observatory-panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-threshold">Threshold</p>
          <h4 className="font-display text-sm font-semibold text-paper">Guardian decryption progress</h4>
        </div>
        <button
          type="button"
          onClick={refreshProgress}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-paper-muted hover:text-paper disabled:opacity-50"
          title="Refresh guardian progress"
        >
          <FiRefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {merged.length === 0 && progressList.length === 0 ? (
        <p className="text-sm text-paper-muted">Connecting to live progress…</p>
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
                className="flex flex-col items-center rounded-2xl border border-white/10 bg-ink/60 p-3 transition hover:border-threshold/40"
              >
                <div className="h-14 w-14">
                  <CircularProgressbar
                    value={pct}
                    text={`${pct}%`}
                    styles={buildStyles({
                      textSize: '22px',
                      pathColor: guardian.decryptedOrNot ? '#3FC7B8' : '#8B7FE8',
                      textColor: '#F7F4EC',
                      trailColor: 'rgba(255,255,255,0.12)',
                    })}
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-center text-xs font-medium text-paper">{label}</p>
                <p className="text-[10px] uppercase tracking-wide text-paper-muted">{guardian.status || 'idle'}</p>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div className="mt-4 rounded-2xl border border-threshold/30 bg-threshold/10 p-4 text-sm text-paper">
          <p className="font-semibold">{active.guardianName || active.userEmail}</p>
          <p className="text-paper-muted">Phase: {active.currentPhase || active.status || 'not started'}</p>
          <p className="font-mono text-xs text-aurora">
            Chunks: {active.processedChunks ?? 0} / {active.totalChunks ?? 0}
          </p>
        </div>
      )}
    </div>
  );
};

export default GuardianProgressPanel;
