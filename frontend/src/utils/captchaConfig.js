let cachedPromise = null;

/** Site key from backend (~/.env → VITE_TURNSTILE_SITE_KEY). No build-time or GitHub secrets. */
export function fetchCaptchaConfig() {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      try {
        const res = await fetch("/api/auth/captcha-config", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const siteKey = (data.siteKey || "").trim();
          return { enabled: Boolean(data.enabled && siteKey), siteKey };
        }
      } catch {
        // backend unreachable
      }
      return { enabled: false, siteKey: "" };
    })();
  }
  return cachedPromise;
}

export function resetCaptchaConfigCache() {
  cachedPromise = null;
}
