import React, { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiLock, FiShield, FiMail } from "react-icons/fi";
import OtpInput from "../components/OtpInput";
import PasswordInput from "../components/PasswordInput";
import { formatPasswordErrors, getPasswordValidationErrors } from "../utils/passwordUtils";
import {
  changePassword,
  confirmProfileMfaSetup,
  disableProfileMfa,
  getProfileSettings,
  startProfileMfaSetup,
} from "../utils/api";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState({
    email: "",
    mfaEnabled: false,
    mfaRegistered: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [mfaSetup, setMfaSetup] = useState({
    qrCodeDataUri: "",
    secret: "",
  });
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableMfaCode, setDisableMfaCode] = useState("");
  const [showDisableMfaForm, setShowDisableMfaForm] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getProfileSettings();
      setProfile({
        email: data.email || "",
        mfaEnabled: !!data.mfaEnabled,
        mfaRegistered: !!data.mfaRegistered,
      });
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load profile settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 5000);
    return () => clearTimeout(timer);
  }, [success]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const passwordErrors = getPasswordValidationErrors(passwordForm.newPassword);
    if (passwordErrors.length > 0) {
      setError(formatPasswordErrors(passwordErrors));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirm password do not match");
      return;
    }

    try {
      setPasswordBusy(true);
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Password changed successfully.");
    } catch (err) {
      setError(err.message || "Failed to update password");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setError("");
    setSuccess("");

    try {
      setMfaBusy(true);
      const data = await startProfileMfaSetup();
      setMfaSetup({
        qrCodeDataUri: data.qrCodeDataUri || "",
        secret: data.secret || "",
      });
      setMfaCode("");
      setSuccess("Scan the QR code and enter the 6-digit code to enable 2FA.");
    } catch (err) {
      setError(err.message || "Failed to start 2FA setup");
    } finally {
      setMfaBusy(false);
    }
  };

  const handleConfirmMfa = async (codeOverride) => {
    const code = (codeOverride || mfaCode).replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) return;

    setError("");
    setSuccess("");

    try {
      setMfaBusy(true);
      await confirmProfileMfaSetup(code);
      setMfaSetup({ qrCodeDataUri: "", secret: "" });
      setMfaCode("");
      setSuccess("Two-step verification has been enabled.");
      await loadProfile();
    } catch (err) {
      setError(err.message || "Invalid 2FA code");
    } finally {
      setMfaBusy(false);
    }
  };

  const handleDisableMfa = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const code = disableMfaCode.replace(/\D/g, "").slice(0, 6);
    if (!disablePassword.trim()) {
      setError("Current password is required to disable 2FA");
      return;
    }
    if (code.length !== 6) {
      setError("Enter the current 6-digit 2FA code");
      return;
    }

    try {
      setMfaBusy(true);
      await disableProfileMfa(disablePassword, code);
      setMfaSetup({ qrCodeDataUri: "", secret: "" });
      setMfaCode("");
      setDisablePassword("");
      setDisableMfaCode("");
      setShowDisableMfaForm(false);
      setSuccess("Two-step verification has been disabled.");
      await loadProfile();
    } catch (err) {
      setError(err.message || "Failed to disable 2FA");
    } finally {
      setMfaBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 page-enter sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
      {loading ? (
        <div className="glass-panel flex min-h-40 items-center justify-center rounded-3xl">
          <div className="flex items-center gap-3 text-sm font-medium text-dusk">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-glacier border-t-brand" />
            Loading security settings
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-ember/30 bg-ember-soft/90 p-4 shadow-soft" role="alert">
          <div className="flex items-center gap-3 text-sm text-ember">
            <FiAlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-sage/20 bg-sage-soft p-4 shadow-soft">
          <div className="flex items-center gap-3 text-sm text-sage">
            <FiCheckCircle className="h-5 w-5" />
            <span>{success}</span>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl bg-deep shadow-lift">
        <div className="relative overflow-hidden px-5 py-8 text-paper sm:px-8 sm:py-10">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/15 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-48 w-72 rounded-full bg-sage/10 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dusk-soft">Account vault</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Account security</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-dusk-soft sm:text-base">
            Keep your AmarVote account protected with a strong password and two-step verification.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 bg-paper/5 p-4 sm:p-6">
          <div className="glass-panel grid gap-4 border border-white/10 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper/10 text-brand-light ring-1 ring-white/10">
                <FiMail className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="section-kicker text-dusk-soft">Signed-in account</p>
                <p className="mt-1 truncate font-display text-lg font-semibold text-paper">{profile.email || "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-deep/20 px-3 py-2 text-sm font-medium text-paper">
              <span className={`h-2 w-2 rounded-full ${profile.mfaEnabled ? "bg-sage" : "bg-brand"}`} />
              2FA {profile.mfaEnabled ? "enabled" : "not enabled"}
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden border border-glacier/70">
        <div className="border-b border-glacier/80 bg-frost/55 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-glacier text-brand">
              <FiShield className="h-5 w-5" />
            </div>
            <div>
              <p className="section-kicker">Two-step verification</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-deep sm:text-2xl">Secure sign-in</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-dusk">
            Use an authenticator app to help keep your account secure, even if your password is compromised.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${profile.mfaEnabled ? "bg-sage" : "bg-brand"}`} />
              <div>
                <p className="font-display text-base font-semibold text-deep">Verification status</p>
                <p className="mt-1 text-sm text-dusk">
                  {profile.mfaEnabled ? "Two-step verification is active." : "Two-step verification is currently off."}
                </p>
              </div>
            </div>

            {profile.mfaEnabled ? (
              showDisableMfaForm ? (
                <form className="w-full sm:max-w-md space-y-3" onSubmit={handleDisableMfa}>
                  <input
                    type="password"
                    required
                    placeholder="Current password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="input-field"
                  />
                  <OtpInput
                    value={disableMfaCode}
                    onChange={setDisableMfaCode}
                    disabled={mfaBusy}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="submit"
                      disabled={mfaBusy || disableMfaCode.replace(/\D/g, "").length !== 6}
                      className="btn-brand w-full bg-ember hover:bg-ember sm:w-auto"
                    >
                      {mfaBusy ? "Disabling..." : "Confirm Disable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDisableMfaForm(false);
                        setDisablePassword("");
                        setDisableMfaCode("");
                      }}
                      disabled={mfaBusy}
                      className="btn-ghost w-full sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDisableMfaForm(true)}
                  disabled={mfaBusy}
                  className="btn-ghost w-full border-ember/30 text-ember hover:border-ember/40 hover:bg-ember-soft sm:w-auto"
                >
                  Turn Off
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleStartMfaSetup}
                disabled={mfaBusy}
                className="btn-brand w-full sm:w-auto"
              >
                {mfaBusy ? "Preparing..." : "Turn On"}
              </button>
            )}
          </div>

          {!profile.mfaEnabled && mfaSetup.qrCodeDataUri ? (
            <div className="mt-6 rounded-2xl border border-brand/20 bg-glacier/45 p-4 sm:p-5">
              <p className="section-kicker">Authenticator setup</p>
              <p className="mt-1 font-display text-lg font-semibold text-deep">
                Scan this QR code with Google Authenticator, then confirm with a 6-digit code.
              </p>

              <div className="mt-4 inline-block max-w-full rounded-2xl bg-paper p-4 shadow-soft">
                <img src={mfaSetup.qrCodeDataUri} alt="MFA QR" className="h-44 w-44 sm:h-52 sm:w-52" />
              </div>

              {mfaSetup.secret ? (
                <p className="mt-4 text-xs text-deep">
                  Manual secret: <span className="font-mono font-semibold">{mfaSetup.secret}</span>
                </p>
              ) : null}

              <div className="mt-5 w-full sm:max-w-xs">
                <OtpInput value={mfaCode} onChange={setMfaCode} onComplete={handleConfirmMfa} disabled={mfaBusy} />
                <button
                  type="button"
                  onClick={() => handleConfirmMfa()}
                  disabled={mfaBusy || mfaCode.replace(/\D/g, "").length !== 6}
                  className="btn-brand mt-3 w-full"
                >
                  {mfaBusy ? "Confirming..." : "Confirm and Enable"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface-card overflow-hidden border border-glacier/70">
        <div className="border-b border-glacier/80 bg-frost/55 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-glacier text-brand">
            <FiLock className="h-5 w-5" />
          </div>
          <div>
            <p className="section-kicker">Password</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-deep sm:text-2xl">Change your password</h2>
            <p className="mt-1 text-sm leading-6 text-dusk">Choose a unique password that you do not use elsewhere.</p>
          </div>
        </div>
        </div>

        <form className="max-w-lg space-y-4 p-5 sm:p-6" onSubmit={handlePasswordChange}>
            <PasswordInput
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              placeholder="Current password"
              required
              autoComplete="current-password"
              showRequirements={false}
              showValidation={false}
              className="input-field"
            />

            <PasswordInput
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              placeholder="New password"
              required
              autoComplete="new-password"
              className="input-field"
            />

            <PasswordInput
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Confirm new password"
              required
              autoComplete="new-password"
              showRequirements={false}
              className="input-field"
            />
            {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <p className="text-xs text-ember">New password and confirm password do not match.</p>
            )}

            <button
              type="submit"
              disabled={passwordBusy}
              className="btn-brand w-full sm:w-auto"
            >
              {passwordBusy ? "Updating..." : "Update Password"}
            </button>
        </form>
      </section>
    </div>
  );
};

export default Profile;
