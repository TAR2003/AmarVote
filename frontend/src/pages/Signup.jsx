import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Layout from "./Layout";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { load } from '@fingerprintjs/botd';

export default function Signup({ setUserEmail }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    userName: "",
    email: "",
    password: "",
    confirmPassword: "",
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
  const [botDetection, setBotDetection] = useState({ loading: true, isBot: false, error: null });

  // Track bot detection state changes
  useEffect(() => {
    console.log('🔄 [BOT STATE] Bot detection state changed:', {
      loading: botDetection.loading,
      isBot: botDetection.isBot,
      error: botDetection.error
    });
  }, [botDetection]);

  // Initialize botD on component mount
  useEffect(() => {
    console.log('🚀 [BOT DETECTION] Component mounted - Starting bot detection initialization...');
    
    const initBotDetection = async () => {
      try {
        console.log('📡 [BOT DETECTION] Loading botD library...');
        const botd = await load();
        console.log('✅ [BOT DETECTION] BotD library loaded successfully');
        
        console.log('🔍 [BOT DETECTION] Running bot detection analysis...');
        const result = await botd.detect();
        
        console.log('📊 [BOT DETECTION] Detection completed. Full result:', result);
        console.log(`🤖 [BOT DETECTION] Is Bot: ${result.bot}`);
        console.log(`📈 [BOT DETECTION] Confidence Score: ${result.requestId ? 'Available' : 'Not available'}`);
        
        setBotDetection({
          loading: false,
          isBot: result.bot,
          error: null
        });

        if (result.bot) {
          console.warn('🚨 [BOT DETECTION] BOT DETECTED! User will be blocked from registration.');
        } else {
          console.log('✅ [BOT DETECTION] Human user detected. Registration allowed.');
        }
      } catch (error) {
        console.error('❌ [BOT DETECTION] Bot detection failed with error:', error);
        console.log('🛡️ [BOT DETECTION] Falling back to allowing registration (fail-safe mode)');
        setBotDetection({
          loading: false,
          isBot: false, // Allow registration if detection fails
          error: error.message
        });
      }
    };

    initBotDetection();
  }, []);

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
    console.log('📧 [SEND CODE] User clicked "Send Verification Code" button');
    console.log('📋 [SEND CODE] Checking form validation...');
    
    if (!isFormReadyForVerification()) {
      console.log('❌ [SEND CODE] Form validation failed - form not ready');
      return;
    }
    console.log('✅ [SEND CODE] Form validation passed');
    
    // Check bot detection result
    console.log('🔍 [SEND CODE] Checking bot detection status...');
    console.log(`🤖 [SEND CODE] Bot detection loading: ${botDetection.loading}`);
    console.log(`🤖 [SEND CODE] Is bot detected: ${botDetection.isBot}`);
    console.log(`🤖 [SEND CODE] Detection error: ${botDetection.error}`);
    
    if (botDetection.isBot) {
      console.warn('🚨 [SEND CODE] BLOCKED: Bot detected - preventing code send');
      setServerError("Security check failed. Automated registrations are not allowed.");
      return;
    }
    
    if (botDetection.loading) {
      console.log('⏳ [SEND CODE] BLOCKED: Bot detection still in progress');
      setServerError("Security check in progress. Please wait a moment and try again.");
      return;
    }
    
    console.log('✅ [SEND CODE] Bot check passed - proceeding to send verification code');
    
    try {
      console.log('📤 [SEND CODE] Sending verification code to:', formData.email.trim());
      const res = await axios.post("/api/verify/send-code", {
        email: formData.email.trim(),
      });
      console.log('✅ [SEND CODE] Verification code sent successfully');
      alert(res.data);
      setCodeSent(true);
    } catch (error) {
      console.error('❌ [SEND CODE] Failed to send verification code:', error);
      setServerError("Failed to send verification code.");
    }
  };

  const handleVerifyCode = async () => {
    console.log('🔐 [VERIFY CODE] User attempting to verify code');
    
    if (!verificationCode.trim()) {
      console.log('❌ [VERIFY CODE] No verification code entered');
      return alert("Please enter the verification code.");
    }
    
    console.log('📝 [VERIFY CODE] Verification code entered, proceeding...');
    setVerifying(true);
    
    try {
      console.log('📤 [VERIFY CODE] Sending verification request to server');
      const res = await axios.post("/api/verify/verify-code", {
        code: verificationCode,
        email: formData.email.trim(),
      });
      console.log('✅ [VERIFY CODE] Verification successful');
      alert(res.data);
      setIsVerified(true);
    } catch (error) {
      console.error('❌ [VERIFY CODE] Verification failed:', error);
      setServerError("Invalid or expired verification code.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 [REGISTRATION] User clicked "Sign Up" button - Starting final registration');
    
    if (!isVerified) {
      console.log('❌ [REGISTRATION] BLOCKED: Email not verified');
      alert("Please verify your email before signing up.");
      return;
    }
    console.log('✅ [REGISTRATION] Email verification check passed');
    
    // Final bot check before registration
    console.log('🔍 [REGISTRATION] Performing final bot detection check...');
    console.log(`🤖 [REGISTRATION] Bot detection loading: ${botDetection.loading}`);
    console.log(`🤖 [REGISTRATION] Is bot detected: ${botDetection.isBot}`);
    console.log(`🤖 [REGISTRATION] Detection error: ${botDetection.error}`);
    
    if (botDetection.isBot) {
      console.warn('🚨 [REGISTRATION] BLOCKED: Bot detected during final registration attempt');
      setServerError("Security check failed. Automated registrations are not allowed.");
      return;
    }
    console.log('✅ [REGISTRATION] Final bot check passed');
    
    if (!isValidURL(formData.profilePic)) {
      console.log('❌ [REGISTRATION] BLOCKED: Invalid profile picture URL');
      setErrors((prev) => ({ ...prev, profilePic: "Invalid URL for profile picture." }));
      return;
    }
    console.log('✅ [REGISTRATION] Profile picture URL validation passed');

    console.log('📤 [REGISTRATION] All checks passed - submitting registration to server');
    setLoading(true);
    
    try {
      console.log('🌐 [REGISTRATION] Sending registration request...');
      const response = await axios.post("/api/auth/register", formData);
      
      if (response.data.success) {
        console.log('🎉 [REGISTRATION] Registration successful! Redirecting to login...');
        navigate("/login", { state: { message: "Signup successful! Please login." } });
      } else {
        console.error('❌ [REGISTRATION] Registration failed:', response.data.message);
        setServerError(response.data.message || "Registration failed.");
      }
    } catch (err) {
      console.error('❌ [REGISTRATION] Registration error:', err);
      const message = err.response?.data?.message || "Something went wrong. Please try again.";
      setServerError(message);
    } finally {
      setLoading(false);
      console.log('🏁 [REGISTRATION] Registration process completed');
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

          {/* Bot detection status */}
          {botDetection.loading && (
            <div className="text-blue-500 text-center text-sm">
              🔒 Running security checks...
            </div>
          )}
          
          {!botDetection.loading && !botDetection.isBot && (
            <div className="text-green-600 text-center text-sm">
              ✅ Security check passed
            </div>
          )}
          
          {botDetection.isBot && (
            <div className="text-red-500 text-center text-sm">
              🚫 Security check failed - Automated access detected
            </div>
          )}

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
                disabled={!isFormReadyForVerification() || botDetection.loading || botDetection.isBot}
                className={`w-full py-2 rounded text-white font-semibold ${
                  isFormReadyForVerification() && !botDetection.loading && !botDetection.isBot
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-300 cursor-not-allowed"
                }`}
              >
                {botDetection.loading 
                  ? "Security Check..." 
                  : botDetection.isBot 
                    ? "Access Denied" 
                    : "Send Verification Code"}
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
              disabled={loading || !isVerified || botDetection.loading || botDetection.isBot}
              className={`w-full py-2 rounded text-white font-semibold ${
                loading || !isVerified || botDetection.loading || botDetection.isBot
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading 
                ? "Signing up..." 
                : botDetection.isBot 
                  ? "Access Denied" 
                  : "Sign Up"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

