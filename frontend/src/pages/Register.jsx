import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Layout from "./Layout";
import OtpInput from "../components/OtpInput";

const EMAIL_CODE_RATE_LIMIT_MESSAGE = "You can only request email verifcation code 1 time in 10 minutes";

export default function Register({ setUserEmail }) {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1=email, 2=verify-email-code, 3=set-password, 4=totp-setup
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [qrCodeDataUri, setQrCodeDataUri] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendEmailCode = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 429) {
        throw new Error(EMAIL_CODE_RATE_LIMIT_MESSAGE);
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to send verification code");
      }

      if (data.status !== "EMAIL_CODE_SENT") {
        throw new Error("Unexpected response from server");
      }

      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailCode = async (codeOverride) => {
    const codeToSubmit = (codeOverride || emailCode).replace(/\D/g, "").slice(0, 6);
    if (codeToSubmit.length !== 6) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register/verify-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: codeToSubmit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid verification code");
      }

      if (data.status !== "EMAIL_VERIFIED") {
        throw new Error("Unexpected verification response");
      }

      setStep(3);
    } catch (err) {
      setError(err.message || "Email verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e) => {
    e.preventDefault();
    await verifyEmailCode();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, enableMfa: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      if (data.status === "REGISTERED_NO_MFA") {
        if (setUserEmail) setUserEmail(email);
        navigate("/dashboard");
        return;
      }

      if (data.status !== "MFA_SETUP_REQUIRED") {
        throw new Error(data.message || "Unexpected registration response");
      }

      setSecret(data.secret || "");
      setQrCodeDataUri(data.qrCodeDataUri || "");
      setStep(4);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const submitMfaSetup = async (codeOverride) => {
    const codeToSubmit = (codeOverride || otpCode).replace(/\D/g, "").slice(0, 6);
    if (codeToSubmit.length !== 6) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/confirm-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, totpCode: codeToSubmit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid MFA code");
      }

      if (setUserEmail) setUserEmail(email);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "MFA setup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSetup = async (e) => {
    e.preventDefault();
    await submitMfaSetup();
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-2xl border border-blue-100 bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 1 && "Create your AmarVote account"}
            {step === 2 && "Verify your email"}
            {step === 3 && "Set your password"}
            {step === 4 && "Complete Google Authenticator setup"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {step === 1 && "Enter your email to receive a 6-digit verification code."}
            {step === 2 && `Enter the 6-digit code sent to ${email}.`}
            {step === 3 && "Create and confirm your password. 2FA is optional and can be enabled later in Profile."}
            {step === 4 && "Scan the QR code with Google Authenticator, then enter the 6-digit code."}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <form className="mt-6 space-y-4" onSubmit={handleSendEmailCode}>
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
                Already registered?{" "}
                <Link className="font-semibold text-blue-600 hover:underline" to="/login">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {step === 2 && (
            <form className="mt-6 space-y-6" onSubmit={handleVerifyEmailCode}>
              <OtpInput
                value={emailCode}
                onChange={setEmailCode}
                onComplete={verifyEmailCode}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || emailCode.replace(/\D/g, "").length !== 6}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? "Verifying..." : "Verify email"}
              </button>

              <button
                type="button"
                onClick={handleSendEmailCode}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Resend code
              </button>
            </form>
          )}

          {step === 3 && (
            <form className="mt-6 space-y-4" onSubmit={handleRegister}>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                <strong>Why 2FA is important:</strong> it protects your account even if your password is exposed.
                Create your account first, then go to your profile after login to enable 2FA.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}

          {step === 4 && (
            <form className="mt-6 space-y-6" onSubmit={handleConfirmSetup}>
              {qrCodeDataUri ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <img src={qrCodeDataUri} alt="AmarVote MFA QR" className="mx-auto h-56 w-56" />
                </div>
              ) : null}

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Scan this QR code with your Google Authenticator app, then enter the 6-digit code below.
              </div>

              {secret ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
                  Manual secret: <span className="font-mono font-semibold">{secret}</span>
                </div>
              ) : null}

              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                onComplete={submitMfaSetup}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || otpCode.replace(/\D/g, "").length !== 6}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? "Verifying..." : "Finish registration"}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
