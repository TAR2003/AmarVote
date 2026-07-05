export function getAuthErrorMessage(data, fallback) {
  if (!data || typeof data !== "object") {
    return fallback;
  }
  return data.message || data.error || fallback;
}

export function buildEmailCodePayload(email, captchaToken) {
  const payload = { email };
  if (captchaToken) {
    payload.captchaToken = captchaToken;
  }
  return payload;
}
