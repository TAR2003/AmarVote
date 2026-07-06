export const HTTP_ERROR_KIND = {
  SESSION_EXPIRED: 'session_expired',
  RATE_LIMITED: 'rate_limited',
  SERVER_UNAVAILABLE: 'server_unavailable',
  NETWORK_ERROR: 'network_error',
  UNKNOWN: 'unknown',
};

export function classifyHttpStatus(status) {
  if (status === 401 || status === 403) return HTTP_ERROR_KIND.SESSION_EXPIRED;
  if (status === 429) return HTTP_ERROR_KIND.RATE_LIMITED;
  if (status >= 500 || status === 502 || status === 503 || status === 504) {
    return HTTP_ERROR_KIND.SERVER_UNAVAILABLE;
  }
  return HTTP_ERROR_KIND.UNKNOWN;
}

export function classifyFetchError(error, status) {
  if (status != null) return classifyHttpStatus(status);
  if (error?.status != null) return classifyHttpStatus(error.status);
  if (error?.kind) return error.kind;
  if (
    error?.name === 'TypeError' ||
    (typeof error?.message === 'string' && /failed to fetch|network|load failed/i.test(error.message))
  ) {
    return HTTP_ERROR_KIND.NETWORK_ERROR;
  }
  return HTTP_ERROR_KIND.UNKNOWN;
}

export function getHttpErrorTitle(kind) {
  switch (kind) {
    case HTTP_ERROR_KIND.SESSION_EXPIRED:
      return 'Session expired';
    case HTTP_ERROR_KIND.RATE_LIMITED:
      return 'Too many requests';
    case HTTP_ERROR_KIND.SERVER_UNAVAILABLE:
      return 'Service temporarily unavailable';
    case HTTP_ERROR_KIND.NETWORK_ERROR:
      return 'Connection problem';
    default:
      return 'Something went wrong';
  }
}

export function getHttpErrorMessage(kind, status) {
  switch (kind) {
    case HTTP_ERROR_KIND.SESSION_EXPIRED:
      return 'Your sign-in session has ended. Please sign in again to continue.';
    case HTTP_ERROR_KIND.RATE_LIMITED:
      return 'The server is receiving too many requests right now. Wait a moment and try again — your session is still active.';
    case HTTP_ERROR_KIND.SERVER_UNAVAILABLE:
      return status
        ? `The server returned an error (${status}). The service may be restarting or under heavy load. Please try again shortly.`
        : 'The server is temporarily unavailable. Please try again in a few moments.';
    case HTTP_ERROR_KIND.NETWORK_ERROR:
      return 'Could not reach the server. Check your internet connection and try again.';
    default:
      return status
        ? `Request failed (${status}). Please try again.`
        : 'An unexpected error occurred. Please try again.';
  }
}

export function buildHttpError({ status, message, kind } = {}) {
  const resolvedKind = kind || classifyHttpStatus(status ?? 0);
  return {
    kind: resolvedKind,
    status: status ?? null,
    title: getHttpErrorTitle(resolvedKind),
    message: message || getHttpErrorMessage(resolvedKind, status),
  };
}

export function getApiErrorMessage(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';
  if (error.userMessage) return error.userMessage;

  const kind = classifyFetchError(error, error.status);
  if (error.message && kind === HTTP_ERROR_KIND.UNKNOWN) {
    return error.message;
  }
  return getHttpErrorMessage(kind, error.status);
}
