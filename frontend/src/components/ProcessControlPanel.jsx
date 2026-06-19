import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { electionApi } from '../utils/electionApi';

const ProcessControlPanel = ({
  electionId,
  guardianId = null,
  canControlTally = false,
  canControlDecryption = false,
  canControlCombine = false,
}) => {
  const [busy, setBusy] = useState('');

  const run = async (key, fn, successMsg) => {
    setBusy(key);
    try {
      const result = await fn();
      toast.success(result?.message || successMsg);
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setBusy('');
    }
  };

  if (!canControlTally && !canControlDecryption && !canControlCombine) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h4 className="text-sm font-semibold text-amber-900">Process Controls</h4>
      <p className="mb-3 text-xs text-amber-800">
        Stop in-flight work or remove stored results to restart from a clean state.
      </p>

      <div className="flex flex-wrap gap-2">
        {canControlTally && (
          <>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('stopTally', () => electionApi.stopTallyProcess(electionId), 'Tally stop requested')}
              className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy === 'stopTally' ? 'Stopping…' : 'Stop Tally'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('deleteTally', () => electionApi.deleteTallyResults(electionId), 'Tally data removed')}
              className="rounded border border-amber-600 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {busy === 'deleteTally' ? 'Deleting…' : 'Delete All Tally Data'}
            </button>
          </>
        )}

        {canControlDecryption && guardianId && (
          <>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('stopDec', () => electionApi.stopGuardianDecryption(electionId, guardianId), 'Decryption stop requested')}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy === 'stopDec' ? 'Stopping…' : 'Stop Decryption'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('deleteDec', () => electionApi.deleteGuardianDecryption(electionId, guardianId), 'Decryption data removed')}
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
              onClick={() => run('stopCombine', () => electionApi.stopCombineProcess(electionId), 'Combine stop requested')}
              className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {busy === 'stopCombine' ? 'Stopping…' : 'Stop Combine'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('deleteCombine', () => electionApi.deleteCombineResults(electionId), 'Combined results removed')}
              className="rounded border border-purple-600 px-3 py-1.5 text-xs font-medium text-purple-800 hover:bg-purple-50 disabled:opacity-50"
            >
              {busy === 'deleteCombine' ? 'Deleting…' : 'Delete Combined Results'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProcessControlPanel;
