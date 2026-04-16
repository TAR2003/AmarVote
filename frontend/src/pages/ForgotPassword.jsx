import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "./Layout";
import OtpInput from "../components/OtpInput";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1=email, 2=verify-code, 3=set-password
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resetPasswordToken, setResetPasswordToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const sendResetCode = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/password/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send verification code");
      }

      setStep(2);
      setSuccess("Verification code sent. Please check your email.");
    } catch (err) {
      setError(err.message || "Failed to send verification code");
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid verification code");
      }

      if (data.status !== "PASSWORD_RESET_CODE_VERIFIED" || !data.resetPasswordToken) {
        throw new Error("Unexpected response from server");
      }

      setResetPasswordToken(data.resetPasswordToken);
      setStep(3);
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
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
        body: JSON.stringify({ resetPasswordToken, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      setSuccess("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-blue-100 bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 1 && "Forgot your password?"}
            {step === 2 && "Verify your email"}
            {step === 3 && "Set a new password"}
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            {step === 1 && "Enter your email to receive a verification code."}
            {step === 2 && `Enter the 6-digit code sent to ${email}.`}
            {step === 3 && "Create your new password and sign in again."}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? "Sending code..." : "Send verification code"}
              </button>

              <p className="text-center text-sm text-gray-600">
                Remembered your password?{" "}
                <Link className="font-semibold text-blue-600 hover:underline" to="/login">
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
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? "Verifying..." : "Verify code"}
              </button>

              <button
                type="button"
                onClick={sendResetCode}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Resend code
              </button>
            </form>
          )}

          {step === 3 && (
            <form className="mt-6 space-y-4" onSubmit={submitNewPassword}>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
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
