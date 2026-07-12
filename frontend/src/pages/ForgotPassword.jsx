import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "./Layout";
import OtpInput from "../components/OtpInput";
import PasswordInput from "../components/PasswordInput";
import TurnstileWidget from "../components/TurnstileWidget";
import useCaptchaConfig from "../hooks/useCaptchaConfig";
import { formatPasswordErrors, getPasswordValidationErrors } from "../utils/passwordUtils";
import { buildEmailCodePayload, getAuthErrorMessage, readAuthResponse, resolveAuthErrorMessage } from "../utils/authApi";
import { getApiErrorMessage } from "../utils/httpErrors";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { loading: captchaLoading, required: captchaRequired } = useCaptchaConfig();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const resetCaptcha = () => {
    setCaptchaToken("");
    setTurnstileReset((value) => value + 1);
  };

  const sendResetCode = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }

    setError("");
    setSuccess("");

    if (captchaRequired && !captchaToken) {
      setError("Please complete the CAPTCHA verification.");
      return false;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/password/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEmailCodePayload(email, captchaToken)),
      });

      const { data, ok, status } = await readAuthResponse(res);

      if (status === 429) {
        throw new Error(getAuthErrorMessage(data, "Please wait before requesting another verification code."));
      }

      if (!ok) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Failed to send verification code")),
          { status }
        );
      }

      setStep(2);
      setSuccess(data.message || "Verification code sent. Please check your email.");
      resetCaptcha();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err));
      resetCaptcha();
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (codeOverride) => {
    const codeToSubmit = (codeOverride || verificationCode).replace(/\D/g, "").slice(0, 6);
    if (codeToSubmit.length !== 6) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/password/verify-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: codeToSubmit }),
      });

      const { data, ok } = await readAuthResponse(res);
      if (!ok) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Invalid verification code")),
          { status: res.status }
        );
      }

      if (data.status !== "PASSWORD_RESET_CODE_VERIFIED") {
        throw new Error("Unexpected response from server");
      }

      setStep(3);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const passwordErrors = getPasswordValidationErrors(newPassword);
    if (passwordErrors.length > 0) {
      setError(formatPasswordErrors(passwordErrors));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password and confirm password do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword }),
      });

      const { data, ok } = await readAuthResponse(res);
      if (!ok) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Failed to reset password")),
          { status: res.status }
        );
      }

      setSuccess("Password reset successful. Two-factor authentication has been turned off — log in and re-enable it from Profile if you want. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-frost-mesh px-4 py-10 sm:py-14">
        <div className="glass-panel mx-auto w-full max-w-md p-6 sm:p-8 animate-fade-up">
          <h1 className="text-2xl font-bold text-ink">
            {step === 1 && "Forgot your password?"}
            {step === 2 && "Verify your email"}
            {step === 3 && "Set a new password"}
          </h1>

          <p className="mt-2 text-sm text-dusk">
            {step === 1 && "Enter your email to receive a verification code."}
            {step === 2 && `Enter the 6-digit code sent to ${email}.`}
            {step === 3 && "Create your new password and sign in again."}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-ember/30 bg-ember-soft px-4 py-3 text-sm text-ember">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-aurora/30 bg-sage-soft px-4 py-3 text-sm text-sage">
              {success}
            </div>
          )}

          {step === 1 && (
            <form className="mt-6 space-y-4" onSubmit={sendResetCode}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-ink/15 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
              />

              <TurnstileWidget
                onVerify={setCaptchaToken}
                resetKey={turnstileReset}
                className="flex justify-center"
              />

              <button
                type="submit"
                disabled={loading || captchaLoading || (captchaRequired && !captchaToken)}
                className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-paper transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand-soft"
              >
                {loading ? "Sending code..." : "Send verification code"}
              </button>

              <p className="text-center text-sm text-dusk">
                Remembered your password?{" "}
                <Link className="font-semibold text-brand hover:underline" to="/login">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {step === 2 && (
            <form
              className="mt-6 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                verifyCode();
              }}
            >
              <OtpInput
                value={verificationCode}
                onChange={setVerificationCode}
                onComplete={verifyCode}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || verificationCode.replace(/\D/g, "").length !== 6}
                className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-paper transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand-soft"
              >
                {loading ? "Verifying..." : "Verify code"}
              </button>

              <TurnstileWidget
                onVerify={setCaptchaToken}
                resetKey={turnstileReset}
                className="flex justify-center"
              />

              <button
                type="button"
                onClick={sendResetCode}
                disabled={loading || captchaLoading || (captchaRequired && !captchaToken)}
                className="w-full rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-dusk hover:bg-frost disabled:cursor-not-allowed disabled:bg-frost"
              >
                Resend code
              </button>
            </form>
          )}

          {step === 3 && (
            <form className="mt-6 space-y-4" onSubmit={submitNewPassword}>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                required
                autoComplete="new-password"
              />

              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
                showRequirements={false}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-ember">Password and confirm password do not match.</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-paper transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand-soft"
              >
                {loading ? "Updating password..." : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
