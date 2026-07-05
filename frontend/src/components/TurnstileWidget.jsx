import React, { useEffect, useRef, useState } from "react";
import { fetchCaptchaConfig } from "../utils/captchaConfig";

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function TurnstileWidget({
  onVerify,
  onExpire,
  resetKey = 0,
  theme = "light",
  className = "",
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const [siteKey, setSiteKey] = useState("");
  const [loadError, setLoadError] = useState(null);

  useEffect(() => { onVerifyRef.current = onVerify; }, [onVerify]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    let cancelled = false;
    fetchCaptchaConfig().then((config) => {
      if (!cancelled) setSiteKey(config.siteKey || "");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let cancelled = false;
    setLoadError(null);

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        if (widgetIdRef.current != null) {
          turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => onVerifyRef.current?.(token),
          "expired-callback": () => {
            onVerifyRef.current?.("");
            onExpireRef.current?.();
          },
          "error-callback": () => {
            onVerifyRef.current?.("");
            setLoadError("CAPTCHA failed to load. Refresh and try again.");
          },
        });
      })
      .catch(() => {
        onVerifyRef.current?.("");
        setLoadError("CAPTCHA could not be loaded. Check your connection.");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, resetKey, theme]);

  if (!siteKey && !loadError) return null;

  return (
    <div className={className}>
      <div ref={containerRef} />
      {loadError && (
        <p className="mt-2 text-sm text-red-600 text-center" role="alert">{loadError}</p>
      )}
    </div>
  );
}
