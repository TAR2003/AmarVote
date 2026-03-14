import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Layout from "./Layout";
import OtpInput from "../components/OtpInput";

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
  const [tempToken, setTempToken] = useState("");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.status === 202 && data.status === "MFA_REQUIRED") {
        setTempToken(data.tempToken || "");
        setStage(STAGES.AWAITING_MFA);
        return;
      }

      throw new Error(data.message || "Login failed");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async (codeOverride) => {
    const codeToSubmit = (codeOverride || otpCode).replace(/\D/g, "").slice(0, 6);
    if (codeToSubmit.length !== 6 || !tempToken) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ totpCode: codeToSubmit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "MFA verification failed");
      }

      setStage(STAGES.SUCCESS);
      if (setUserEmail) setUserEmail(email);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "MFA verification failed");
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
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-blue-100 bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900">
            {stage === STAGES.IDLE ? "Sign in to AmarVote" : "Verify your 2FA code"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {stage === STAGES.IDLE
              ? "Enter your email and password"
              : "Open Google Authenticator and enter the current 6-digit code"}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {stage === STAGES.IDLE ? (
            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? "Checking credentials..." : "Continue"}
              </button>

              <p className="text-center text-sm text-gray-600">
                New user?{" "}
                <Link className="font-semibold text-blue-600 hover:underline" to="/register">
                  Create account
                </Link>
              </p>
            </form>
          ) : (
            <form className="mt-6 space-y-6" onSubmit={handleVerify}>
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                onComplete={submitMfa}
                disabled={loading || stage === STAGES.SUCCESS}
              />

              <button
                type="submit"
                disabled={loading || otpCode.replace(/\D/g, "").length !== 6}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>

              <button
                type="button"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setStage(STAGES.IDLE);
                  setTempToken("");
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
