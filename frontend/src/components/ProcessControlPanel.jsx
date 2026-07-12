import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { electionApi } from '../utils/electionApi';

const PROCESS_ACTIONS = {
  stopTally: {
    title: 'Stop Tally',
    message: 'Stop the in-progress tally for this election? Any partial tally work will be interrupted.',
    confirmLabel: 'Stop Tally',
    confirmClass: 'bg-amber-600 hover:bg-amber-700',
  },
  deleteTally: {
    title: 'Delete All Tally Data',
    message: 'Permanently delete all stored tally data for this election? You will need to run tally again from scratch.',
    confirmLabel: 'Delete Tally Data',
    confirmClass: 'bg-red-600 hover:bg-red-700',
  },
  stopDec: {
    title: 'Stop Decryption',
    message: 'Stop the in-progress decryption for the selected guardian? Any partial decryption work will be interrupted.',
    confirmLabel: 'Stop Decryption',
    confirmClass: 'bg-red-600 hover:bg-red-700',
  },
  deleteDec: {
    title: 'Delete Guardian Decryption',
    message: 'Permanently delete the selected guardian\'s decryption data? They will need to submit decryption again.',
    confirmLabel: 'Delete Decryption',
    confirmClass: 'bg-red-600 hover:bg-red-700',
  },
  stopCombine: {
    title: 'Stop Combine',
    message: 'Stop the in-progress combine decryption process? Any partial combine work will be interrupted.',
    confirmLabel: 'Stop Combine',
    confirmClass: 'bg-ink hover:bg-purple-700',
  },
  deleteCombine: {
    title: 'Delete Combined Results',
    message: 'Permanently delete the combined decryption results for this election? You will need to run combine again.',
    confirmLabel: 'Delete Combined Results',
    confirmClass: 'bg-red-600 hover:bg-red-700',
  },
};

const ProcessControlPanel = ({
  electionId,
  guardianId = null,
  guardians = [],
  canControlTally = false,
  canControlDecryption = false,
  canControlCombine = false,
  onActionComplete = null,
}) => {
  const [busy, setBusy] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [selectedGuardianId, setSelectedGuardianId] = useState(guardianId || guardians[0]?.guardianId || null);

  useEffect(() => {
    if (guardianId) {
      setSelectedGuardianId(guardianId);
    } else if (!selectedGuardianId && guardians.length > 0) {
      setSelectedGuardianId(guardians[0].guardianId);
    }
  }, [guardianId, guardians, selectedGuardianId]);

  const run = async (key, fn, successMsg) => {
    setBusy(key);
    try {
      const result = await fn();
      toast.success(result?.message || successMsg);
      if (onActionComplete) {
        onActionComplete(result);
      }
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setBusy('');
    }
  };

  const requestAction = (key, fn, successMsg) => {
    setPendingAction({ key, fn, successMsg });
  };

  const handleConfirmAction = async () => {
    if (!pendingAction || busy) return;
    const { key, fn, successMsg } = pendingAction;
    await run(key, fn, successMsg);
    setPendingAction(null);
  };

  const handleCancelAction = () => {
    if (!busy) {
      setPendingAction(null);
    }
  };

  if (!canControlTally && !canControlDecryption && !canControlCombine) {
    return null;
  }

  const activeGuardianId = selectedGuardianId || guardianId;
  const pendingConfig = pendingAction ? PROCESS_ACTIONS[pendingAction.key] : null;

  return (
    <>
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h4 className="text-sm font-semibold text-amber-900">Process Controls</h4>
      <p className="mb-3 text-xs text-amber-800">
        Stop in-flight work or remove stored results to restart from a clean state. Admin and co-admin only.
      </p>

      <div className="flex flex-wrap gap-2">
        {canControlTally && (
          <>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('stopTally', () => electionApi.stopTallyProcess(electionId), 'Tally stop requested')}
              className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy === 'stopTally' ? 'Stopping…' : 'Stop Tally'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('deleteTally', () => electionApi.deleteTallyResults(electionId), 'Tally data removed')}
              className="rounded border border-amber-600 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {busy === 'deleteTally' ? 'Deleting…' : 'Delete All Tally Data'}
            </button>
          </>
        )}

        {canControlDecryption && activeGuardianId && (
          <>
            {guardians.length > 1 && (
              <select
                value={activeGuardianId}
                onChange={(e) => setSelectedGuardianId(Number(e.target.value))}
                className="rounded border border-red-200 bg-white px-2 py-1.5 text-xs text-gray-800"
              >
                {guardians.map((g) => (
                  <option key={g.guardianId} value={g.guardianId}>
                    Guardian {g.sequenceOrder}: {g.userEmail}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('stopDec', () => electionApi.stopGuardianDecryption(electionId, activeGuardianId), 'Decryption stop requested')}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy === 'stopDec' ? 'Stopping…' : 'Stop Decryption'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('deleteDec', () => electionApi.deleteGuardianDecryption(electionId, activeGuardianId), 'Decryption data removed')}
              className="rounded border border-red-600 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              {busy === 'deleteDec' ? 'Deleting…' : 'Delete Guardian Decryption'}
            </button>
          </>
        )}

        {canControlCombine && (
          <>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('stopCombine', () => electionApi.stopCombineProcess(electionId), 'Combine stop requested')}
              className="rounded bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {busy === 'stopCombine' ? 'Stopping…' : 'Stop Combine'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('deleteCombine', () => electionApi.deleteCombineResults(electionId), 'Combined results removed')}
              className="rounded border border-purple-600 px-3 py-1.5 text-xs font-medium text-ink hover:bg-glacier disabled:opacity-50"
            >
              {busy === 'deleteCombine' ? 'Deleting…' : 'Delete Combined Results'}
            </button>
          </>
        )}
      </div>
    </div>

    {pendingConfig && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900">{pendingConfig.title}</h3>
          <p className="mt-2 text-sm text-gray-600">{pendingConfig.message}</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancelAction}
              disabled={!!busy}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-60 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAction}
              disabled={!!busy}
              className={`w-full rounded-md px-4 py-2 text-white disabled:opacity-60 sm:w-auto ${pendingConfig.confirmClass}`}
            >
              {busy === pendingAction?.key ? 'Working…' : pendingConfig.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ProcessControlPanel;
