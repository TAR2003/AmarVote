/**
 * Voter lifecycle helpers — matches production rules:
 *   - unlimited create-encrypted-ballot before casting
 *   - one cast per email per election
 *   - after cast: no more encrypt or cast
 */

export function encryptWarmupIters() {
  const n = Number(__ENV.ENCRYPT_WARMUP_ITERS || '2');
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2;
}

export function parseEligibility(eligRes) {
  try {
    return eligRes.json();
  } catch {
    return {};
  }
}

/** Eligibility API says this email already voted. */
export function voterHasAlreadyCast(eligBody) {
  if (!eligBody) return false;
  if (eligBody.hasVoted === true) return true;
  if (eligBody.reason === 'Already voted') return true;
  const msg = eligBody.message || '';
  return msg.toLowerCase().includes('already voted');
}

/** Encrypt/cast API returned already-voted (HTTP 200/400 body). */
export function isAlreadyVotedApi(res) {
  if (!res || (res.status !== 200 && res.status !== 400)) return false;
  try {
    const body = res.json();
    return body.errorReason === 'Already voted' || (body.message || '').toLowerCase().includes('already voted');
  } catch {
    return false;
  }
}
