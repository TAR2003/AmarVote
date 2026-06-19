/**
 * Helpers for SSE progress events that carry embedded status snapshots.
 */

export function getSnapshotFromEvent(event) {
  return event?.payload?.snapshot ?? null;
}

export function pickTally(snapshot) {
  return snapshot?.tally ?? null;
}

export function pickCombine(snapshot) {
  return snapshot?.combine ?? null;
}

export function pickGuardians(snapshot) {
  const guardians = snapshot?.guardians;
  return Array.isArray(guardians) ? guardians : null;
}

export function pickMyDecryption(snapshot) {
  return snapshot?.myDecryption ?? null;
}

export function pickDecryptionDetail(snapshot) {
  return snapshot?.decryptionDetail ?? null;
}

/**
 * Resolve decryption status for the modal from an SSE snapshot.
 * Prefers myDecryption (connect snapshot); falls back to decryptionDetail when present.
 */
export function resolveDecryptionStatus(snapshot) {
  return pickMyDecryption(snapshot) || pickDecryptionDetail(snapshot);
}

export function shouldApplyTallyEvent(event) {
  if (!event) return false;
  if (event.eventType === 'snapshot') return true;
  return event.operation === 'TALLY'
    || event.status === 'stopped'
    || event.status === 'deleted';
}

export function shouldApplyDecryptionEvent(event) {
  if (!event) return false;
  if (event.eventType === 'snapshot') return true;
  const op = event.operation || '';
  return op.includes('DECRYPTION')
    || event.status === 'stopped'
    || event.status === 'deleted';
}

export function shouldApplyCombineEvent(event) {
  if (!event) return false;
  if (event.eventType === 'snapshot') return true;
  return event.operation === 'COMBINE'
    || event.status === 'stopped'
    || event.status === 'deleted';
}

export function shouldApplyGuardianPanelEvent(event) {
  if (!event) return false;
  if (event.eventType === 'snapshot') return true;
  const op = event.operation || '';
  return op.includes('DECRYPTION')
    || event.operation === 'COMBINE'
    || event.status === 'stopped'
    || event.status === 'deleted';
}
