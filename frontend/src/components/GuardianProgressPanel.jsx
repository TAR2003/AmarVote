import React, { useEffect, useState } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { electionApi } from '../utils/electionApi';
import useElectionProgressStream from '../hooks/useElectionProgressStream';

/**
 * Clickable guardian cards — any election participant can view decryption progress.
 */
const GuardianProgressPanel = ({ electionId, guardians = [] }) => {
  const [progressList, setProgressList] = useState([]);
  const [selectedGuardian, setSelectedGuardian] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadProgress = async () => {
    if (!electionId) return;
    setLoading(true);
    try {
      const data = await electionApi.getAllGuardiansDecryptionProgress(electionId);
      setProgressList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load guardian progress', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [electionId]);

  useElectionProgressStream(electionId, {
    enabled: Boolean(electionId),
    onEvent: (event) => {
      if (event?.operation?.includes('DECRYPTION') || event?.status === 'deleted' || event?.status === 'stopped') {
        loadProgress();
      }
    },
  });

  const merged = (guardians.length ? guardians : progressList).map((g) => {
    const match = progressList.find((p) => p.guardianId === g.guardianId || p.guardianEmail === g.userEmail);
    return { ...g, ...match };
  });

  const active = selectedGuardian
    ? merged.find((g) => g.guardianId === selectedGuardian.guardianId) || selectedGuardian
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Guardian Decryption Progress</h4>
        {loading && <span className="text-xs text-gray-500">Updating…</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {merged.map((guardian) => {
          const pct = Math.round(guardian.progressPercentage || 0);
          const label = guardian.guardianName || guardian.userEmail || `Guardian ${guardian.sequenceOrder || ''}`;
          return (
            <button
              key={guardian.guardianId || guardian.userEmail}
              type="button"
              onClick={() => setSelectedGuardian(guardian)}
              className="flex flex-col items-center rounded-lg border border-gray-100 bg-gray-50 p-3 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="h-14 w-14">
                <CircularProgressbar
                  value={pct}
                  text={`${pct}%`}
                  styles={buildStyles({
                    textSize: '22px',
                    pathColor: guardian.decryptedOrNot ? '#16a34a' : '#2563eb',
                    textColor: '#111827',
                    trailColor: '#e5e7eb',
                  })}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-center text-xs font-medium text-gray-800">{label}</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{guardian.status || 'idle'}</p>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-gray-800">
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
