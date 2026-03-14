import React, { useState } from "react";
import Layout from "./Layout";
import { sendSignInLinkToEmail } from "firebase/auth";
import { firebaseAuth } from "../firebase";

export default function OtpLogin() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSendMagicLink(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(firebaseAuth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setMessage("A secure sign-in link has been sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to send sign-in link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <span className="text-5xl">🔐</span>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Sign in to AmarVote
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Enter your email to receive a passwordless sign-in link
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 border-l-4 border-red-500">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {message && (
            <div className="rounded-md bg-green-50 p-4 border-l-4 border-green-500">
              <p className="text-sm text-green-700">{message}</p>
            </div>
          )}

          <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10 border border-gray-200">
            <form className="space-y-6" onSubmit={handleSendMagicLink}>
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending link..." : "Send sign-in link"}
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-xs text-gray-600">
            We verify email ownership only at login. Voter-list checks happen later
            in voting endpoints.
          </p>
        </div>
      </div>
    </Layout>
  );
}
