/**
 * User-facing copy and error normalization for the voting booth.
 * Vocabulary: "Cast" = final submission; "Challenge" = Benaloh spoil-and-verify.
 */

export const VOTER_STATUS_COPY = {
  createBallotInfo:
    'Encrypting your ballot under the election public key may take a little longer during peak voting. Remain on this page until encryption finishes.',
  createBallotLoading:
    'Encrypting your ballot with ElectionGuard under the election public key…',
  castBallotInfo:
    'Casting may take a little longer during high traffic. Remain on this page until your ballot is recorded.',
  castBallotLoading:
    'Casting your ballot. Recording the ciphertext — please wait.',
  challengeBallotInfo:
    'Challenge verification may take a moment during busy periods. Remain on this page while the challenge completes.',
  challengeBallotLoading:
    'Opening encryption randomness to verify this ballot — then it will be spoiled…',
  ballotActionsInfo:
    'Cast submits this ballot as final. Challenge verifies encryption honesty, spoils this ballot, and lets you encrypt again.',
  serviceUnavailable:
    'Temporary service issue. Wait a moment and try again.',
  requestTimeout:
    'Request is taking longer than expected — common during busy voting periods. Wait a moment and try again.',
  unexpected:
    'Something went wrong while processing your request. Try again in a moment.',
};

/**
 * Map API/network failures to respectful voter-facing messages.
 * @param {unknown} error
 * @returns {string}
 */
export function getVoterFriendlyError(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const status = error?.status;

  const isGatewayStatus =
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /\b(502|503|504)\b/i.test(message) ||
    /bad gateway|service unavailable|gateway timeout/i.test(message);

  const isNetworkFailure =
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed') ||
    (error?.name === 'TypeError' && /fetch/i.test(message));

  if (isGatewayStatus || isNetworkFailure) {
    return VOTER_STATUS_COPY.serviceUnavailable;
  }

  if (/timeout/i.test(message)) {
    return VOTER_STATUS_COPY.requestTimeout;
  }

  return message || VOTER_STATUS_COPY.unexpected;
}

const GUARDIAN_KEY_WRONG_MESSAGE = 'Please submit the right key';

/**
 * Map guardian credential / decryption failures to a plain, non-technical message.
 * @param {unknown} error
 * @returns {string}
 */
export function getGuardianKeyFriendlyError(error) {
  const message = typeof error?.message === 'string' ? error.message : String(error || '');
  const lower = message.toLowerCase();

  if (
    lower.includes('decrypt') ||
    lower.includes('credential') ||
    lower.includes('invalid credential') ||
    lower.includes('wrong key') ||
    lower.includes('incorrect') ||
    lower.includes('bad request') ||
    error?.status === 400
  ) {
    return GUARDIAN_KEY_WRONG_MESSAGE;
  }

  return message || GUARDIAN_KEY_WRONG_MESSAGE;
}
