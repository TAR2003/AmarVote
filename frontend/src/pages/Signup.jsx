import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Layout from "./Layout";

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

  const validate = () => {
    const newErrors = {};
    if (!formData.userName.trim()) newErrors.userName = "Username is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email address";
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (!formData.confirmPassword)
      newErrors.confirmPassword = "Confirm password is required";
    else if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    if (!formData.nid.trim()) newErrors.nid = "NID is required";
    return newErrors;
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    setServerError("");
  };

  const handleSendCode = async () => {
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrors((prev) => ({
        ...prev,
        email: "Please enter a valid email first",
      }));
      return;
    }
    try {
      const res = await axios.post(
        "http://localhost:8080/api/verify/send-code",
        {
          email: formData.email,
        }
      );
      alert(res.data);
      setCodeSent(true);
    } catch {
      setServerError("Failed to send verification code.");
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim())
      return alert("Please enter the verification code.");
    setVerifying(true);
    try {
      const res = await axios.post(
        "http://localhost:8080/api/verify/verify-code",
        {
          code: verificationCode,
          email: formData.email,
        }
      );
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
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!isVerified) {
      alert("Please verify your email before signing up.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:8080/api/auth/register",
        formData
      );
      if (response.data.success) {
        navigate("/login", {
          state: { message: "Signup successful! Please login." },
        });
      } else {
        setServerError(response.data.message || "Registration failed.");
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Something went wrong. Please try again.";
      setServerError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <span className="text-5xl">📝</span>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in
              </Link>
            </p>
          </div>

          {serverError && (
            <div className="rounded-md bg-red-50 p-4 border-l-4 border-red-500">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-500">✗</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{serverError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10 border border-gray-200">
            <form className="mb-0 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="userName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Username
                </label>
                <div className="mt-1">
                  <input
                    id="userName"
                    name="userName"
                    type="text"
                    required
                    value={formData.userName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Your username"
                  />
                </div>
                {errors.userName && (
                  <p className="mt-1 text-sm text-red-600">{errors.userName}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirm Password
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="nid"
                  className="block text-sm font-medium text-gray-700"
                >
                  National ID (NID)
                </label>
                <div className="mt-1">
                  <input
                    id="nid"
                    name="nid"
                    type="text"
                    required
                    value={formData.nid}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Your national ID number"
                  />
                </div>
                {errors.nid && (
                  <p className="mt-1 text-sm text-red-600">{errors.nid}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="profilePic"
                  className="block text-sm font-medium text-gray-700"
                >
                  Profile Picture URL (optional)
                </label>
                <div className="mt-1">
                  <input
                    id="profilePic"
                    name="profilePic"
                    type="text"
                    value={formData.profilePic}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://example.com/profile.jpg"
                  />
                </div>
              </div>

              {!codeSent && (
                <button
                  type="button"
                  onClick={handleSendCode}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Send Verification Code
                </button>
              )}

              {codeSent && !isVerified && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="verificationCode"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Verification Code
                    </label>
                    <div className="mt-1">
                      <input
                        id="verificationCode"
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter code sent to your email"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={verifying}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                      verifying ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                  >
                    {verifying ? (
                      <span className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Verifying...
                      </span>
                    ) : (
                      "Verify Code"
                    )}
                  </button>
                </div>
              )}

              {isVerified && (
                <div className="rounded-md bg-green-50 p-4 border-l-4 border-green-500">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-green-500">✓</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700">
                        Email verified successfully!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading || !isVerified}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading || !isVerified
                      ? "opacity-75 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Signing up...
                    </span>
                  ) : (
                    "Sign Up"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
