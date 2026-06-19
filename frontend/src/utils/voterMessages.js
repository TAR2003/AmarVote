/**
 * User-facing copy and error normalization for the voting booth.
 */

export const VOTER_STATUS_COPY = {
  createBallotInfo:
    'During peak voting periods, creating your encrypted ballot may take a little longer than usual. Please remain on this page and allow the process to complete.',
  createBallotLoading:
    'Creating your encrypted ballot. This may take a moment when many voters are participating — thank you for your patience.',
  castBallotInfo:
    'During periods of high traffic, casting your vote may take a little longer than usual. Please remain on this page and allow the process to complete.',
  castBallotLoading:
    'Casting your vote. Please wait while we securely record your ballot — thank you for your patience.',
  challengeBallotInfo:
    'Ballot verification may take a moment during busy voting periods. Please remain on this page while the challenge completes.',
  challengeBallotLoading:
    'Verifying your encrypted ballot. This may take a moment — thank you for your patience.',
  ballotActionsInfo:
    'During periods of high traffic, casting your vote or verifying your ballot may take a little longer than usual. Please remain on this page and allow the process to complete.',
  serviceUnavailable:
    'We are sorry, but we have encountered a temporary service issue. Our team is working to resolve it. Please wait a moment and try again.',
  requestTimeout:
    'Your request is taking longer than expected, which can happen during busy voting periods. Please wait a moment and try again.',
  unexpected:
    'Something went wrong while processing your request. Please try again in a moment.',
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
