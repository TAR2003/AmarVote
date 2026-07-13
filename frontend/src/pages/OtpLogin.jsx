import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import BrandMark from "../components/BrandMark";
import TurnstileWidget from "../components/TurnstileWidget";
import useCaptchaConfig from "../hooks/useCaptchaConfig";
import { buildEmailCodePayload, getAuthErrorMessage, readAuthResponse, resolveAuthErrorMessage } from "../utils/authApi";
import { getApiErrorMessage } from "../utils/httpErrors";

export default function OtpLogin({ setUserEmail }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const navigate = useNavigate();
  const { loading: captchaLoading, required: captchaRequired } = useCaptchaConfig();

  useEffect(() => {
    if (step === 2 && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetCaptcha = () => {
    setCaptchaToken("");
    setTurnstileReset((value) => value + 1);
  };

  async function requestOtpCode() {
    setError(null);
    setInfo(null);

    if (captchaRequired && !captchaToken) {
      setError("Please complete the CAPTCHA verification.");
      return false;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEmailCodePayload(email, captchaToken)),
      });

      const { data, ok, status } = await readAuthResponse(res);

      if (status === 429) {
        throw new Error(getAuthErrorMessage(data, "Please wait before requesting another verification code."));
      }

      if (!ok || !data.success) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Failed to send verification code")),
          { status }
        );
      }

      setStep(2);
      setTimeLeft(300);
      setInfo(data.message || "Verification code sent to your email.");
      resetCaptcha();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err));
      resetCaptcha();
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOTP(e) {
    e.preventDefault();
    await requestOtpCode();
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otpCode }),
      });

      const { data, ok } = await readAuthResponse(res);

      if (!ok || !data.success) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Invalid verification code")),
          { status: res.status }
        );
      }

      if (setUserEmail) setUserEmail(email);
      navigate("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOTP() {
    const sent = await requestOtpCode();
    if (sent) {
      setOtpCode("");
    }
  }

  return (
    <Layout>
      <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden bg-frost-mesh px-4 py-10 sm:py-14">
        <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-16 h-72 w-72 rounded-full bg-brand-light/15 blur-3xl" />

        <div className="glass-panel relative z-10 mx-auto w-full max-w-md p-6 sm:p-8 animate-fade-up">
          <div className="mb-7 text-center">
            <div className="mb-4 flex justify-center">
              <BrandMark size="lg" className="shadow-brand" />
            </div>
            <p className="section-kicker">Email code</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-deep sm:text-3xl">
              {step === 1 ? "Sign in to AmarVote" : "Enter verification code"}
            </h1>
            <p className="mt-2 text-sm text-dusk">
              {step === 1
                ? "We'll send a verification code to your email."
                : `Code sent to ${email}`}
            </p>
          </div>

          {error && (
            <div
              className="mb-4 rounded-xl border border-ember/30 bg-ember-soft px-4 py-3 text-sm text-ember"
              role="alert"
            >
              {error}
            </div>
          )}

          {info && (
            <div className="mb-4 rounded-xl border border-brand/25 bg-glacier px-4 py-3 text-sm text-brand-dark">
              {info}
            </div>
          )}

          {step === 1 ? (
            <form className="space-y-4" onSubmit={handleRequestOTP}>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dusk"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>

              <TurnstileWidget
                onVerify={setCaptchaToken}
                resetKey={turnstileReset}
                className="flex justify-center"
              />

              <button
                type="submit"
                disabled={loading || captchaLoading || (captchaRequired && !captchaToken)}
                className="btn-brand w-full"
              >
                {loading ? "Sending…" : "Continue"}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleVerifyOTP}>
              <div>
                <label
                  htmlFor="otpCode"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dusk"
                >
                  Verification code
                </label>
                <input
                  id="otpCode"
                  name="otpCode"
                  type="text"
                  maxLength="6"
                  pattern="[0-9]{6}"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="input-field text-center font-mono text-2xl tracking-widest"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
                <p className="mt-2 text-center text-sm text-dusk">
                  {timeLeft > 0 ? (
                    <>
                      Code expires in{" "}
                      <span className="font-semibold text-brand-dark">{formatTime(timeLeft)}</span>
                    </>
                  ) : (
                    <span className="font-semibold text-ember">Code expired</span>
                  )}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || timeLeft === 0 || otpCode.length !== 6}
                className="btn-brand w-full"
              >
                {loading ? "Verifying…" : "Sign in"}
              </button>

              <TurnstileWidget
                onVerify={setCaptchaToken}
                resetKey={turnstileReset}
                className="flex justify-center"
              />

              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading || captchaLoading || (captchaRequired && !captchaToken)}
                className="btn-ghost w-full"
              >
                Resend code
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtpCode("");
                  setError(null);
                  setInfo(null);
                  resetCaptcha();
                }}
                className="w-full text-sm link-brand"
              >
                ← Change email address
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-dusk">
            By signing in, you agree to AmarVote&apos;s secure voting protocols.
          </p>
        </div>
      </div>
    </Layout>
  );
}
