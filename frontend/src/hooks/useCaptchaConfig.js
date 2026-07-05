import { useEffect, useState } from "react";
import { fetchCaptchaConfig } from "../utils/captchaConfig";

export default function useCaptchaConfig() {
  const [state, setState] = useState({ loading: true, required: false, siteKey: "" });

  useEffect(() => {
    let cancelled = false;
    fetchCaptchaConfig()
      .then((config) => {
        if (!cancelled) {
          setState({ loading: false, required: config.enabled, siteKey: config.siteKey });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, required: false, siteKey: "" });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
