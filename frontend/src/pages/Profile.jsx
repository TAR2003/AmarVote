import React, { useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiLock, FiShield, FiMail } from "react-icons/fi";
import OtpInput from "../components/OtpInput";
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

    if (passwordForm.newPassword.length < 8) {
      setError("New password must be at least 8 characters");
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

  const handleDisableMfa = async () => {
    setError("");
    setSuccess("");

    try {
      setMfaBusy(true);
      await disableProfileMfa();
      setMfaSetup({ qrCodeDataUri: "", secret: "" });
      setMfaCode("");
      setSuccess("Two-step verification has been disabled.");
      await loadProfile();
    } catch (err) {
      setError(err.message || "Failed to disable 2FA");
    } finally {
      setMfaBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {loading ? (
        <div className="flex justify-center items-center py-14">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      ) : null}

      {error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center gap-3 text-red-700 text-sm">
            <FiAlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      {success ? (
        <div className="bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex items-center gap-3 text-green-700 text-sm">
            <FiCheckCircle className="h-5 w-5" />
            <span>{success}</span>
          </div>
        </div>
      ) : null}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <h1 className="text-2xl font-bold">Account Security</h1>
          <p className="mt-1 text-sm text-blue-100">Manage password and two-step verification settings.</p>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 text-gray-700">
            <FiMail className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Email:</span>
            <span className="text-sm">{profile.email || "-"}</span>
          </div>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiShield className="h-5 w-5 text-indigo-600" />
                Two-Step Verification
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Status: {profile.mfaEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>

            {profile.mfaEnabled ? (
              <button
                type="button"
                onClick={handleDisableMfa}
                disabled={mfaBusy}
                className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {mfaBusy ? "Disabling..." : "Turn Off"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartMfaSetup}
                disabled={mfaBusy}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {mfaBusy ? "Preparing..." : "Turn On"}
              </button>
            )}
          </div>

          {!profile.mfaEnabled && mfaSetup.qrCodeDataUri ? (
            <div className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-sm text-indigo-900 mb-3">
                Scan this QR code with Google Authenticator, then confirm with a 6-digit code.
              </p>

              <div className="bg-white rounded-lg p-4 inline-block">
                <img src={mfaSetup.qrCodeDataUri} alt="MFA QR" className="h-52 w-52" />
              </div>

              {mfaSetup.secret ? (
                <p className="mt-3 text-xs text-indigo-900">
                  Manual secret: <span className="font-mono font-semibold">{mfaSetup.secret}</span>
                </p>
              ) : null}

              <div className="mt-4 max-w-xs">
                <OtpInput value={mfaCode} onChange={setMfaCode} onComplete={handleConfirmMfa} disabled={mfaBusy} />
                <button
                  type="button"
                  onClick={() => handleConfirmMfa()}
                  disabled={mfaBusy || mfaCode.replace(/\D/g, "").length !== 6}
                  className="mt-3 w-full rounded-md bg-indigo-700 text-white py-2 text-sm font-medium hover:bg-indigo-800 disabled:opacity-60"
                >
                  {mfaBusy ? "Confirming..." : "Confirm and Enable"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FiLock className="h-5 w-5 text-blue-600" />
            Change Password
          </h2>

          <form className="mt-4 space-y-4 max-w-lg" onSubmit={handlePasswordChange}>
            <input
              type="password"
              required
              placeholder="Current password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />

            <input
              type="password"
              required
              minLength={8}
              placeholder="New password (min 8 characters)"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />

            <input
              type="password"
              required
              minLength={8}
              placeholder="Confirm new password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />

            <button
              type="submit"
              disabled={passwordBusy}
              className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {passwordBusy ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
