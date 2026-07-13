import React, { useEffect, useState } from 'react';
import ModalOverlay, { ModalPanel } from './ModalOverlay';
import toast from 'react-hot-toast';
import { electionApi } from '../utils/electionApi';

const PROCESS_ACTIONS = {
  stopTally: {
    title: 'Stop Tally',
    message: 'Stop the in-progress tally for this election? Any partial tally work will be interrupted.',
    confirmLabel: 'Stop Tally',
    confirmClass: 'bg-ceremonial hover:bg-ceremonial',
  },
  deleteTally: {
    title: 'Delete All Tally Data',
    message: 'Permanently delete all stored tally data for this election? You will need to run tally again from scratch.',
    confirmLabel: 'Delete Tally Data',
    confirmClass: 'bg-ember hover:bg-ember',
  },
  stopDec: {
    title: 'Stop Decryption',
    message: 'Stop the in-progress decryption for the selected guardian? Any partial decryption work will be interrupted.',
    confirmLabel: 'Stop Decryption',
    confirmClass: 'bg-ember hover:bg-ember',
  },
  deleteDec: {
    title: 'Delete Guardian Decryption',
    message: 'Permanently delete the selected guardian\'s decryption data? They will need to submit decryption again.',
    confirmLabel: 'Delete Decryption',
    confirmClass: 'bg-ember hover:bg-ember',
  },
  stopCombine: {
    title: 'Stop Combine',
    message: 'Stop the in-progress combine decryption process? Any partial combine work will be interrupted.',
    confirmLabel: 'Stop Combine',
    confirmClass: 'bg-deep hover:bg-ink',
  },
  deleteCombine: {
    title: 'Delete Combined Results',
    message: 'Permanently delete the combined decryption results for this election? You will need to run combine again.',
    confirmLabel: 'Delete Combined Results',
    confirmClass: 'bg-ember hover:bg-ember',
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
    <div className="mt-4 rounded-2xl border border-ceremonial/40 bg-ceremonial-soft/80 p-4 shadow-soft">
      <h4 className="text-sm font-semibold text-ink">Process Controls</h4>
      <p className="mb-3 text-xs text-ink">
        Stop in-flight work or remove stored results to restart from a clean state. Admin and co-admin only.
      </p>

      <div className="flex flex-wrap gap-2">
        {canControlTally && (
          <>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('stopTally', () => electionApi.stopTallyProcess(electionId), 'Tally stop requested')}
              className="rounded-xl bg-ceremonial px-3 py-1.5 text-xs font-medium text-paper shadow-soft hover:bg-ceremonial disabled:opacity-50"
            >
              {busy === 'stopTally' ? 'Stopping…' : 'Stop Tally'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('deleteTally', () => electionApi.deleteTallyResults(electionId), 'Tally data removed')}
              className="rounded-xl border border-ceremonial px-3 py-1.5 text-xs font-medium text-ink hover:bg-ceremonial-soft disabled:opacity-50"
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
                className="rounded border border-ember/30 bg-paper px-2 py-1.5 text-xs text-ink"
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
              className="rounded bg-ember px-3 py-1.5 text-xs font-medium text-paper hover:bg-ember disabled:opacity-50"
            >
              {busy === 'stopDec' ? 'Stopping…' : 'Stop Decryption'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('deleteDec', () => electionApi.deleteGuardianDecryption(electionId, activeGuardianId), 'Decryption data removed')}
              className="rounded-xl border border-red-600 px-3 py-1.5 text-xs font-medium text-ember hover:bg-ember-soft disabled:opacity-50"
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
              className="rounded-xl bg-deep px-3 py-1.5 text-xs font-medium text-paper shadow-soft hover:bg-ink disabled:opacity-50"
            >
              {busy === 'stopCombine' ? 'Stopping…' : 'Stop Combine'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => requestAction('deleteCombine', () => electionApi.deleteCombineResults(electionId), 'Combined results removed')}
              className="rounded-xl border border-brand/40 px-3 py-1.5 text-xs font-medium text-ink hover:bg-glacier disabled:opacity-50"
            >
              {busy === 'deleteCombine' ? 'Deleting…' : 'Delete Combined Results'}
            </button>
          </>
        )}
      </div>
    </div>

    {pendingConfig && (
      <ModalOverlay onClose={handleCancelAction} dismissible={!busy}>
        <ModalPanel size="sm" className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-deep">{pendingConfig.title}</h3>
          <p className="mt-2 text-sm text-dusk">{pendingConfig.message}</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancelAction}
              disabled={!!busy}
              className="btn-ghost w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAction}
              disabled={!!busy}
              className={`w-full rounded-xl px-4 py-2 text-paper shadow-soft disabled:opacity-60 sm:w-auto ${pendingConfig.confirmClass}`}
            >
              {busy === pendingAction?.key ? 'Working…' : pendingConfig.confirmLabel}
            </button>
          </div>
        </ModalPanel>
      </ModalOverlay>
    )}
    </>
  );
};

export default ProcessControlPanel;
