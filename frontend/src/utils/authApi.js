import { parseJsonResponse, resolveHttpErrorMessage } from "./httpErrors.js";

export function getAuthErrorMessage(data, fallback) {
  if (!data || typeof data !== "object") {
    return fallback;
  }
  return data.message || data.error || fallback;
}

export async function readAuthResponse(response) {
  const data = await parseJsonResponse(response);
  return { data, status: response.status, ok: response.ok };
}

export function resolveAuthErrorMessage(response, data, fallback) {
  return resolveHttpErrorMessage({
    status: response.status,
    data,
    fallback,
  });
}

export function buildEmailCodePayload(email, captchaToken) {
  const payload = { email };
  if (captchaToken) {
    payload.captchaToken = captchaToken;
  }
  return payload;
}
