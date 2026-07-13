import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "./Layout";
import BrandMark from "../components/BrandMark";
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
      <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden bg-frost-mesh px-4 py-10 sm:py-14">
        <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-16 h-72 w-72 rounded-full bg-brand-light/15 blur-3xl" />

        <div className="glass-panel relative z-10 mx-auto w-full max-w-md p-6 sm:p-8 animate-fade-up">
          <div className="mb-2 text-center">
            <div className="mb-4 flex justify-center">
              <BrandMark size="lg" className="shadow-brand" />
            </div>
            <p className="section-kicker">Account recovery</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-deep sm:text-3xl">
              {step === 1 && "Forgot your password?"}
              {step === 2 && "Verify your email"}
              {step === 3 && "Set a new password"}
            </h1>
          </div>

          <p className="mt-2 text-center text-sm text-dusk">
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
                className="input-field"
              />

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
                {loading ? "Sending code…" : "Send verification code"}
              </button>

              <p className="text-center text-sm text-dusk">
                Remembered your password?{" "}
                <Link className="link-brand" to="/login">
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
                className="btn-brand w-full"
              >
                {loading ? "Verifying…" : "Verify code"}
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
                className="btn-ghost w-full"
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
                className="btn-brand w-full"
              >
                {loading ? "Updating password…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
