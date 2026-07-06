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
  const genericMessage = getHttpErrorMessage(kind, error.status);

  if (error.message) {
    if (isHtmlOrJsonParseErrorMessage(error.message)) {
      return getHttpErrorMessage(HTTP_ERROR_KIND.SERVER_UNAVAILABLE, error.status);
    }
    // Prefer explicit messages from the server or caller over generic status text
    // (e.g. wrong password on login should not show "session ended").
    if (kind === HTTP_ERROR_KIND.UNKNOWN || error.message !== genericMessage) {
      return error.message;
    }
  }

  return genericMessage;
}

export function isHtmlBody(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trimStart();
  return /^<!DOCTYPE/i.test(trimmed) || /^<html/i.test(trimmed);
}

export function isHtmlOrJsonParseErrorMessage(message) {
  if (typeof message !== 'string') return false;
  return isHtmlBody(message) || /unexpected token.*</i.test(message) || /is not valid json/i.test(message);
}

/**
 * Safely parse a fetch Response body as JSON.
 * Returns {} for HTML error pages (e.g. nginx 502) and other non-JSON bodies.
 */
export async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  const text = await response.text().catch(() => '');
  if (!text || isHtmlBody(text)) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function resolveHttpErrorMessage({ status, data, fallback } = {}) {
  if (data && typeof data === 'object') {
    const serverMessage = data.message || data.error;
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }
  }

  const kind = classifyHttpStatus(status ?? 0);
  if (kind !== HTTP_ERROR_KIND.UNKNOWN) {
    return getHttpErrorMessage(kind, status);
  }
  return fallback;
}
