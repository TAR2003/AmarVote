import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
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
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <span className="text-5xl">🔐</span>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              {step === 1 ? "Sign in to AmarVote" : "Enter Verification Code"}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {step === 1
                ? "We'll send a verification code to your email"
                : `Code sent to ${email}`}
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 border-l-4 border-red-500">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {info && (
            <div className="rounded-md bg-glacier p-4 border-l-4 border-brand">
              <p className="text-sm text-brand-dark">{info}</p>
            </div>
          )}

          <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10 border border-gray-200">
            {step === 1 ? (
              <form className="space-y-6" onSubmit={handleRequestOTP}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <TurnstileWidget
                  onVerify={setCaptchaToken}
                  resetKey={turnstileReset}
                  className="flex justify-center"
                />

                <button
                  type="submit"
                  disabled={loading || captchaLoading || (captchaRequired && !captchaToken)}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-paper bg-brand-dark hover:bg-brand focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:bg-brand-soft disabled:text-dusk disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Continue"}
                </button>
              </form>
            ) : (
              <form className="space-y-6" onSubmit={handleVerifyOTP}>
                <div>
                  <label htmlFor="otpCode" className="block text-sm font-medium text-gray-700">
                    Verification Code
                  </label>
                  <div className="mt-1">
                    <input
                      id="otpCode"
                      name="otpCode"
                      type="text"
                      maxLength="6"
                      pattern="[0-9]{6}"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand focus:border-brand text-center text-2xl tracking-widest font-mono"
                      placeholder="000000"
                      autoComplete="off"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500 text-center">
                    {timeLeft > 0 ? (
                      <>
                        Code expires in{" "}
                        <span className="font-semibold text-brand">{formatTime(timeLeft)}</span>
                      </>
                    ) : (
                      <span className="text-red-600 font-semibold">Code expired</span>
                    )}
                  </p>
                </div>

                <div className="flex flex-col space-y-3">
                  <button
                    type="submit"
                    disabled={loading || timeLeft === 0 || otpCode.length !== 6}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-paper bg-brand-dark hover:bg-brand focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:bg-brand-soft disabled:text-dusk disabled:cursor-not-allowed"
                  >
                    {loading ? "Verifying..." : "Sign In"}
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
                    className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    Resend Code
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
                    className="text-sm text-brand hover:text-ink"
                  >
                    ← Change email address
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-gray-600">
            By signing in, you agree to AmarVote's secure voting protocols
          </p>
        </div>
      </div>
    </Layout>
  );
}
