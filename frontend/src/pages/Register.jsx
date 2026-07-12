import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import Layout from "./Layout";
import BrandMark from "../components/BrandMark";
import OtpInput from "../components/OtpInput";
import PasswordInput from "../components/PasswordInput";
import TurnstileWidget from "../components/TurnstileWidget";
import useCaptchaConfig from "../hooks/useCaptchaConfig";
import { formatPasswordErrors, getPasswordValidationErrors } from "../utils/passwordUtils";
import { buildEmailCodePayload, getAuthErrorMessage, readAuthResponse, resolveAuthErrorMessage } from "../utils/authApi";
import { getApiErrorMessage } from "../utils/httpErrors";
import { buildAuthUrl, consumeReturnPath, readReturnPath } from "../utils/authRedirect";

export default function Register({ setUserEmail }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = readReturnPath(searchParams);
  const loginHref = returnPath ? buildAuthUrl(returnPath, "login") : "/login";
  const { loading: captchaLoading, required: captchaRequired } = useCaptchaConfig();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [qrCodeDataUri, setQrCodeDataUri] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const goAfterAuth = () => {
    navigate(consumeReturnPath(searchParams), { replace: true });
  };

  const resetCaptcha = () => {
    setCaptchaToken("");
    setTurnstileReset((value) => value + 1);
  };

  const handleSendEmailCode = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    setError("");
    setInfo("");

    if (captchaRequired && !captchaToken) {
      setError("Please complete the CAPTCHA verification.");
      return false;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register/send-email-code", {
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

      if (data.status !== "EMAIL_CODE_SENT") {
        throw new Error("Unexpected response from server");
      }

      setStep(2);
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

      const { data, ok } = await readAuthResponse(res);
      if (!ok) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Invalid verification code")),
          { status: res.status }
        );
      }

      if (data.status !== "EMAIL_VERIFIED") {
        throw new Error("Unexpected verification response");
      }

      setStep(3);
    } catch (err) {
      setError(getApiErrorMessage(err));
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

    const passwordErrors = getPasswordValidationErrors(password);
    if (passwordErrors.length > 0) {
      setError(formatPasswordErrors(passwordErrors));
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

      const { data, ok } = await readAuthResponse(res);
      if (!ok) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Registration failed")),
          { status: res.status }
        );
      }

      if (data.status === "REGISTERED_NO_MFA") {
        if (setUserEmail) setUserEmail(email);
        goAfterAuth();
        return;
      }

      if (data.status !== "MFA_SETUP_REQUIRED") {
        throw new Error(data.message || "Unexpected registration response");
      }

      setSecret(data.secret || "");
      setQrCodeDataUri(data.qrCodeDataUri || "");
      setStep(4);
    } catch (err) {
      setError(getApiErrorMessage(err));
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

      const { data, ok } = await readAuthResponse(res);
      if (!ok) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Invalid MFA code")),
          { status: res.status }
        );
      }

      if (setUserEmail) setUserEmail(email);
      goAfterAuth();
    } catch (err) {
      setError(getApiErrorMessage(err));
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
      <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden bg-frost-mesh px-4 py-10 sm:py-14">
        <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-16 h-72 w-72 rounded-full bg-brand-light/15 blur-3xl" />

        <div className="glass-panel relative z-10 mx-auto w-full max-w-md p-6 sm:p-8 animate-fade-up">
          <div className="mb-2 text-center">
            <div className="mb-4 flex justify-center">
              <BrandMark size="lg" className="shadow-brand" />
            </div>
            <p className="section-kicker">Join AmarVote</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-deep sm:text-3xl">
              {step === 1 && "Create your account"}
              {step === 2 && "Verify your email"}
              {step === 3 && "Set your password"}
              {step === 4 && "Secure with authenticator"}
            </h1>
            <p className="mt-2 text-sm text-dusk">
              {returnPath
                ? "Complete registration and we’ll bring you back to the election."
                : null}
              {!returnPath && step === 1 && "Enter your email to receive a 6-digit verification code."}
              {!returnPath && step === 2 && `Enter the 6-digit code sent to ${email}.`}
              {!returnPath && step === 3 && "Create a strong password. MFA can be enabled later in Profile."}
              {!returnPath && step === 4 && "Scan the QR code, then enter the 6-digit authenticator code."}
              {returnPath && step === 1 && " Enter your email to receive a verification code."}
              {returnPath && step === 2 && ` Enter the code sent to ${email}.`}
              {returnPath && step === 3 && " Set a password to finish."}
              {returnPath && step === 4 && " Confirm your authenticator to finish."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5" aria-label={`Step ${step} of 4`}>
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={`h-1.5 rounded-full transition-all ${
                    n === step ? "w-6 bg-brand" : n < step ? "w-4 bg-brand/50" : "w-3 bg-ink/10"
                  }`}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-ember/30 bg-ember-soft px-4 py-3 text-sm text-ember">
              {error}
            </div>
          )}

          {info && (
            <div className="mt-4 rounded-xl border border-brand/20 bg-glacier px-4 py-3 text-sm text-brand-dark">
              {info}
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
                className="input-field"
                autoComplete="email"
              />

              <TurnstileWidget
                onVerify={setCaptchaToken}
                resetKey={turnstileReset}
                className="flex justify-center"
              />

              <button
                type="submit"
                disabled={loading || captchaLoading || (captchaRequired && !captchaToken)}
                className="btn-brand w-full py-3 shadow-brand"
              >
                {loading ? "Sending code..." : "Send verification code"}
              </button>

              <p className="text-center text-sm text-dusk">
                Already registered?{" "}
                <Link className="link-brand font-semibold" to={loginHref}>
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
                className="btn-brand w-full py-3 shadow-brand"
              >
                {loading ? "Verifying..." : "Verify email"}
              </button>

              <TurnstileWidget
                onVerify={setCaptchaToken}
                resetKey={turnstileReset}
                className="flex justify-center"
              />

              <button
                type="button"
                onClick={handleSendEmailCode}
                disabled={loading || captchaLoading || (captchaRequired && !captchaToken)}
                className="btn-ghost w-full"
              >
                Resend code
              </button>
            </form>
          )}

          {step === 3 && (
            <form className="mt-6 space-y-4" onSubmit={handleRegister}>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="new-password"
              />
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                autoComplete="new-password"
                showRequirements={false}
                showValidation={confirmPassword.length > 0 && password !== confirmPassword}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-ember">Password and confirm password do not match.</p>
              )}

              <div className="rounded-lg border border-brand/20 bg-glacier px-3 py-3 text-sm text-deep">
                <strong>Why 2FA is important:</strong> it protects your account even if your password is exposed.
                Create your account first, then go to your profile after login to enable 2FA.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-brand w-full py-3 shadow-brand"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}

          {step === 4 && (
            <form className="mt-6 space-y-6" onSubmit={handleConfirmSetup}>
              {qrCodeDataUri ? (
                <div className="rounded-xl border border-ink/10 bg-frost p-4">
                  <img src={qrCodeDataUri} alt="AmarVote MFA QR" className="mx-auto h-56 w-56" />
                </div>
              ) : null}

              <div className="rounded-lg border border-ceremonial/40 bg-ceremonial-soft px-4 py-3 text-sm text-ink">
                Scan this QR code with your Google Authenticator app, then enter the 6-digit code below.
              </div>

              {secret ? (
                <div className="rounded-xl border border-ink/10 bg-frost px-4 py-3 text-xs text-ink">
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
                className="btn-brand w-full py-3 shadow-brand"
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
