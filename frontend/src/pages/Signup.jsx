import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Layout from "./Layout";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function Signup({ setUserEmail }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    userName: "",
    email: "",
    password: "",
    confirmPassword: "",
    nid: "",
    profilePic: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Create individual pattern checks for better visual feedback
  const passwordPatterns = {
    length: formData.password.length >= 8,
    letter: /[a-zA-Z]/.test(formData.password),
    digit: /\d/.test(formData.password),
    special: /[@#$%^&+=!]/.test(formData.password)
  };
  
  // Full password pattern for validation
  const passwordPattern = /^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[@#$%^&+=!]).{8,}$/;
  const isPasswordValid = passwordPattern.test(formData.password);
  const doPasswordsMatch = formData.password === formData.confirmPassword;

  const isValidURL = (url) => {
    try {
      if (!url) return true;
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const isFormReadyForVerification = () => {
    return (
      formData.userName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
      isPasswordValid &&
      doPasswordsMatch &&
      formData.nid.trim() &&
      isValidURL(formData.profilePic)
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const handleSendCode = async () => {
    if (!isFormReadyForVerification()) return;
    try {
      const res = await axios.post("http://localhost:8080/api/verify/send-code", {
        email: formData.email.trim(),
      });
      alert(res.data);
      setCodeSent(true);
    } catch {
      setServerError("Failed to send verification code.");
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) return alert("Please enter the verification code.");
    setVerifying(true);
    try {
      const res = await axios.post("http://localhost:8080/api/verify/verify-code", {
        code: verificationCode,
        email: formData.email.trim(),
      });
      alert(res.data);
      setIsVerified(true);
    } catch {
      setServerError("Invalid or expired verification code.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isVerified) {
      alert("Please verify your email before signing up.");
      return;
    }
    if (!isValidURL(formData.profilePic)) {
      setErrors((prev) => ({ ...prev, profilePic: "Invalid URL for profile picture." }));
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("http://localhost:8080/api/auth/register", formData);
      if (response.data.success) {
        navigate("/login", { state: { message: "Signup successful! Please login." } });
      } else {
        setServerError(response.data.message || "Registration failed.");
      }
    } catch (err) {
      const message = err.response?.data?.message || "Something went wrong. Please try again.";
      setServerError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Create your account</h2>
            <p className="text-sm mt-2 text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                Sign in
              </Link>
            </p>
          </div>

          {serverError && <div className="text-red-500 text-center text-sm">{serverError}</div>}

          <form className="bg-white p-6 rounded-lg shadow-md space-y-5" onSubmit={handleSubmit}>
            <input
              type="text"
              name="userName"
              placeholder="Username"
              value={formData.userName}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="w-full border p-2 rounded pr-10"
                required
                autoComplete="off"
              />
              {formData.password && (
                <span
                  className="absolute right-3 top-3 text-gray-600 cursor-pointer"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              )}
            </div>

            {/* Live password criteria - updated to include detailed list */}
            <ul className="text-sm text-gray-600 space-y-1 pl-4">
              <li className={passwordPatterns.length ? "text-green-600" : "text-gray-400"}>
                ✓ At least 8 characters
              </li>
              <li className={passwordPatterns.letter ? "text-green-600" : "text-gray-400"}>
                ✓ Contains a letter
              </li>
              <li className={passwordPatterns.digit ? "text-green-600" : "text-gray-400"}>
                ✓ Contains a number
              </li>
              <li className={passwordPatterns.special ? "text-green-600" : "text-gray-400"}>
                ✓ Contains a special character (@#$%^&+=!)
              </li>
            </ul>

            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full border p-2 rounded pr-10"
                required
                autoComplete="off"
              />
              {formData.confirmPassword && (
                <span
                  className="absolute right-3 top-3 text-gray-600 cursor-pointer"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              )}
            </div>

            <p className={doPasswordsMatch ? "text-green-600 text-sm" : "text-red-500 text-sm"}>
              {doPasswordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
            </p>

            <input
              type="text"
              name="nid"
              placeholder="National ID"
              value={formData.nid}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />

            <input
              type="url"
              name="profilePic"
              placeholder="Profile Picture URL (optional)"
              value={formData.profilePic}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
            {errors.profilePic && (
              <p className="text-red-500 text-sm">{errors.profilePic}</p>
            )}

            {!codeSent && (
              <button
                type="button"
                onClick={handleSendCode}
                disabled={!isFormReadyForVerification()}
                className={`w-full py-2 rounded text-white font-semibold ${
                  isFormReadyForVerification()
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-300 cursor-not-allowed"
                }`}
              >
                Send Verification Code
              </button>
            )}

            {codeSent && !isVerified && (
              <>
                <input
                  type="text"
                  placeholder="Verification Code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full border p-2 rounded"
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={verifying}
                  className="w-full py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  {verifying ? "Verifying..." : "Verify Code"}
                </button>
              </>
            )}

            {isVerified && <p className="text-green-600 text-center text-sm">✅ Email verified</p>}

            <button
              type="submit"
              disabled={loading || !isVerified}
              className={`w-full py-2 rounded text-white font-semibold ${
                loading || !isVerified
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Signing up..." : "Sign Up"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}