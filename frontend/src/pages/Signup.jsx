import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Signup() {
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
    if (!formData.email.trim()) newErrors.email = "Valid Email Address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email address";
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (!formData.confirmPassword) newErrors.confirmPassword = "Confirm Password is required";
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
      setErrors((prev) => ({ ...prev, email: "Please enter a valid email first" }));
      return;
    }
    try {
      const res = await axios.post("http://localhost:8080/api/verify/send-code", {
        email: formData.email,
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
      const response = await axios.post("http://localhost:8080/api/auth/register", formData);
      if (response.data.success) {
        navigate("/login", { state: { message: "Signup successful! Please login." } });
      } else {
        setServerError(response.data.message || "Registration failed.");
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Something went wrong. Please try again.";
      setServerError(message); 
    }finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-green-100 p-4">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md animate-fade-in"
        >
          <h2 className="text-3xl font-bold text-center text-blue-600 mb-6">Create Account</h2>

          {serverError && (
            <p className="text-red-500 text-sm text-center mb-4">{serverError}</p>
          )}

          <div className="space-y-4">
            <div>
              <input
                type="text"
                name="userName"
                placeholder="Username"
                value={formData.userName}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
              />
              {errors.userName && (
                <p className="text-red-500 text-sm">{errors.userName}</p>
              )}
            </div>

            <div>
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
              />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email}</p>
              )}
            </div>

            <div>
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
              />
              {errors.password && (
                <p className="text-red-500 text-sm">{errors.password}</p>
              )}
            </div>

            <div>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm">{errors.confirmPassword}</p>
              )}
            </div>

            <div>
              <input
                type="text"
                name="nid"
                placeholder="NID"
                value={formData.nid}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
              />
              {errors.nid && (
                <p className="text-red-500 text-sm">{errors.nid}</p>
              )}
            </div>

            <div>
              <input
                type="text"
                name="profilePic"
                placeholder="Profile Picture URL (optional)"
                value={formData.profilePic}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
              />
            </div>

            {/* Verification Section at the End */}
            {!codeSent && (
              <button
                type="button"
                onClick={handleSendCode}
                className="text-sm text-blue-600 underline hover:text-blue-800"
              >
                Send Verification Code
              </button>
            )}

            {codeSent && !isVerified && (
              <>
                <input
                  type="text"
                  placeholder="Enter verification code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={verifying}
                  className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition"
                >
                  {verifying ? "Verifying..." : "Verify Code"}
                </button>
              </>
            )}

            {isVerified && (
              <p className="text-green-600 text-sm text-center font-medium">
                ✅ Email verified successfully!
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg mt-4 hover:bg-blue-700 transition font-semibold"
            >
              {loading ? "Signing up..." : "Sign Up"}
            </button>
          </div>
        </form>
      </div>
    );
  }
