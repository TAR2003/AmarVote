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

  const validate = () => {
    const newErrors = {};

    if (!formData.userName.trim()) newErrors.userName = "Username is required";
    if (!formData.email.trim()) newErrors.email = "Valid Email Address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email address";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (!formData.confirmPassword)
      newErrors.confirmPassword = "Confirm Password is required";
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
    setServerError(""); // Clear server error on any input
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setServerError("");

    try {
      const response = await axios.post("http://localhost:8080/api/auth/register", formData);
      const data = response.data;

      if (data.success) {
        navigate("/login", { state: { message: "Signup successful! Please login." } });
      } else {
        setServerError(data.message || "Registration failed.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setServerError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Sign Up</h2>

        {serverError && <p className="text-red-500 mb-4 text-center">{serverError}</p>}

        {/* Username */}
        <input
          type="text"
          name="userName"
          placeholder="Username"
          value={formData.userName}
          onChange={handleChange}
          className="w-full px-3 py-2 mb-1 border rounded"
        />
        {errors.userName && <p className="text-red-500 text-sm mb-3">{errors.userName}</p>}

        {/* Email */}
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-3 py-2 mb-1 border rounded"
        />
        {errors.email && <p className="text-red-500 text-sm mb-3">{errors.email}</p>}

        {/* Password */}
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          className="w-full px-3 py-2 mb-1 border rounded"
        />
        {errors.password && <p className="text-red-500 text-sm mb-3">{errors.password}</p>}

        {/* Confirm Password */}
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="w-full px-3 py-2 mb-1 border rounded"
        />
        {errors.confirmPassword && <p className="text-red-500 text-sm mb-3">{errors.confirmPassword}</p>}

        {/* NID */}
        <input
          type="text"
          name="nid"
          placeholder="NID"
          value={formData.nid}
          onChange={handleChange}
          className="w-full px-3 py-2 mb-1 border rounded"
        />
        {errors.nid && <p className="text-red-500 text-sm mb-3">{errors.nid}</p>}

        {/* Profile Pic (optional) */}
        <input
          type="text"
          name="profilePic"
          placeholder="Profile Picture URL (optional)"
          value={formData.profilePic}
          onChange={handleChange}
          className="w-full px-3 py-2 mb-4 border rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
}
