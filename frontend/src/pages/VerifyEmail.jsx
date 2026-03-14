import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import Layout from "./Layout";
import { firebaseAuth } from "../firebase";

export default function VerifyEmail({ setUserEmail }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Verifying your email link...");
  const [error, setError] = useState(null);

  useEffect(() => {
    async function verifyEmailLink() {
      try {
        const currentUrl = window.location.href;

        if (!isSignInWithEmailLink(firebaseAuth, currentUrl)) {
          throw new Error("Invalid or expired sign-in link");
        }

        let email = window.localStorage.getItem("emailForSignIn");
        if (!email) {
          email = window.prompt("Please confirm your email to continue:") || "";
        }

        if (!email) {
          throw new Error("Email is required to complete sign-in");
        }

        const result = await signInWithEmailLink(firebaseAuth, email, currentUrl);
        window.localStorage.removeItem("emailForSignIn");

        const firebaseIdToken = await result.user.getIdToken(true);
        const backendResponse = await fetch("/api/auth/firebase-login", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firebaseIdToken}`,
          },
          credentials: "include",
        });

        if (!backendResponse.ok) {
          const errorPayload = await backendResponse.json().catch(() => ({}));
          throw new Error(errorPayload.message || "Backend login failed");
        }

        setUserEmail?.(result.user.email || email);
        setStatus("Email verified. Redirecting to dashboard...");
        navigate("/dashboard", { replace: true });
      } catch (err) {
        setError(err.message || "Email verification failed");
      }
    }

    verifyEmailLink();
  }, [navigate, setUserEmail]);

  return (
    <Layout>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-white py-8 px-6 shadow rounded-lg border border-gray-200 text-center">
          {!error ? (
            <>
              <div className="text-4xl mb-4">⏳</div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying email</h1>
              <p className="text-sm text-gray-600">{status}</p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Verification failed</h1>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button
                type="button"
                onClick={() => navigate("/otp-login")}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
