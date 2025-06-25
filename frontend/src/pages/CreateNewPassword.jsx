import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function CreateNewPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const passwordPattern = {
    length: newPassword.length >= 8,
    letter: /[a-zA-Z]/.test(newPassword),
    digit: /\d/.test(newPassword),
    special: /[@#$%^&+=!]/.test(newPassword),
  };

  const isPasswordValid = Object.values(passwordPattern).every(Boolean);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isPasswordValid) {
      setError(
        "Password must be at least 8 characters long and contain letters, numbers, and a special character."
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/password/create-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken: token, newPassword }),
      });

      const data = await res.text();
      if (!res.ok) throw new Error(data);

      setSuccess("Password reset successfully!");
      setTimeout(() => navigate("/login", { state: { message: data } }), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow">
        <h2 className="text-2xl font-bold mb-4 text-center">Reset Password</h2>

        {success && <p className="text-green-600 mb-4">{success}</p>}
        {error && <p className="text-red-600 mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              className="w-full px-3 py-2 border border-gray-300 rounded pr-10"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute top-2.5 right-3 text-sm text-gray-500"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* Live password criteria */}
          <ul className="text-sm text-gray-600 space-y-1 pl-4">
            <li className={passwordPattern.length ? "text-green-600" : "text-gray-400"}>
              ✓ At least 8 characters
            </li>
            <li className={passwordPattern.letter ? "text-green-600" : "text-gray-400"}>
              ✓ Contains a letter
            </li>
            <li className={passwordPattern.digit ? "text-green-600" : "text-gray-400"}>
              ✓ Contains a number
            </li>
            <li className={passwordPattern.special ? "text-green-600" : "text-gray-400"}>
              ✓ Contains a special character (@#$%^&+=!)
            </li>
          </ul>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
