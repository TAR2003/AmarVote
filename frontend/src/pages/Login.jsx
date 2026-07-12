import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Layout from "./Layout";
import BrandMark from "../components/BrandMark";
import OtpInput from "../components/OtpInput";
import PasswordInput from "../components/PasswordInput";
import { getCsrfToken } from "../utils/api";
import { readAuthResponse, resolveAuthErrorMessage } from "../utils/authApi";
import { getApiErrorMessage } from "../utils/httpErrors";

const STAGES = {
  IDLE: "IDLE",
  AWAITING_MFA: "AWAITING_MFA",
  SUCCESS: "SUCCESS",
};

export default function Login({ setUserEmail }) {
  const navigate = useNavigate();

  const [stage, setStage] = useState(STAGES.IDLE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": getCsrfToken() || "",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const { data, ok, status } = await readAuthResponse(res);

      if (ok && data.status === "LOGIN_SUCCESS") {
        setStage(STAGES.SUCCESS);
        if (setUserEmail) setUserEmail(email);
        navigate("/dashboard");
        return;
      }

      if (status === 202 && data.status === "MFA_REQUIRED") {
        setStage(STAGES.AWAITING_MFA);
        return;
      }

      throw Object.assign(
        new Error(resolveAuthErrorMessage(res, data, "Login failed")),
        { status }
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async (codeOverride) => {
    const codeToSubmit = (codeOverride || otpCode).replace(/\D/g, "").slice(0, 6);
    if (codeToSubmit.length !== 6) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": getCsrfToken() || "",
        },
        credentials: "include",
        body: JSON.stringify({ totpCode: codeToSubmit }),
      });

      const { data, ok } = await readAuthResponse(res);
      if (!ok) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "MFA verification failed")),
          { status: res.status }
        );
      }

      setStage(STAGES.SUCCESS);
      if (setUserEmail) setUserEmail(email);
      navigate("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    await submitMfa();
  };

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
            <p className="section-kicker">Secure access</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-deep sm:text-3xl">
              {stage === STAGES.IDLE ? "Sign in to AmarVote" : "Verify your identity"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {stage === STAGES.IDLE
                ? "Encrypted sessions. MFA when your account requires it."
                : "Open your authenticator and enter the current 6-digit code."}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {stage === STAGES.IDLE ? (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@organization.com"
                  className="input-field"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password
                </label>
                <PasswordInput
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  showValidation={false}
                />
              </div>

              <button type="submit" disabled={loading} className="btn-brand w-full py-3 shadow-brand">
                {loading ? "Checking credentials..." : "Continue"}
              </button>

              <div className="text-right text-sm">
                <Link className="link-brand" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>

              <p className="text-center text-sm text-slate-600">
                New here?{" "}
                <Link className="link-brand font-semibold" to="/register">
                  Create an account
                </Link>
              </p>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleVerify}>
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                onComplete={submitMfa}
                disabled={loading || stage === STAGES.SUCCESS}
              />

              <button
                type="submit"
                disabled={loading || otpCode.replace(/\D/g, "").length !== 6}
                className="btn-brand w-full py-3 shadow-brand"
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>

              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => {
                  setStage(STAGES.IDLE);
                  setOtpCode("");
                }}
                disabled={loading}
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
