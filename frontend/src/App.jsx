import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Hello from "./pages/Hello";
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import AuthenticatedLayout from "./pages/AuthenticatedLayout";
import CreateElection from "./pages/CreateElection";
import ElectionPage from "./pages/ElectionPage";
import AllElections from "./pages/AllElections";
import LoadingScreen from "./pages/Loading";
import About from "./pages/About";
import Features from "./pages/Features";
import ApiLogs from "./pages/ApiLogs";
import Architecture from "./pages/Architecture";
import Security from "./pages/Security";
import Profile from "./pages/Profile";
import AuthenticatedUsers from "./pages/AuthenticatedUsers";
import Documentation from "./pages/Documentation";
import ReceiptDownload from "./pages/ReceiptDownload";
import {
  buildHttpError,
  classifyHttpStatus,
  HTTP_ERROR_KIND,
} from "./utils/httpErrors";

const SESSION_CHECK_MAX_ATTEMPTS = 3;
const SESSION_CHECK_RETRY_MS = 1200;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSessionState() {
  const res = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
  });

  if (res.ok) {
    const data = await res.json();
    return { email: data.email || null, error: null };
  }

  const kind = classifyHttpStatus(res.status);
  if (kind === HTTP_ERROR_KIND.SESSION_EXPIRED) {
    return {
      email: null,
      error: buildHttpError({ status: res.status, kind }),
    };
  }

  return {
    email: null,
    error: buildHttpError({ status: res.status, kind }),
    retryable: kind === HTTP_ERROR_KIND.RATE_LIMITED || kind === HTTP_ERROR_KIND.SERVER_UNAVAILABLE,
  };
}

async function checkSessionWithRetry() {
  let lastResult = null;

  for (let attempt = 0; attempt < SESSION_CHECK_MAX_ATTEMPTS; attempt += 1) {
    try {
      lastResult = await fetchSessionState();
      if (lastResult.email || !lastResult.retryable || attempt === SESSION_CHECK_MAX_ATTEMPTS - 1) {
        return lastResult;
      }
    } catch {
      lastResult = {
        email: null,
        error: buildHttpError({ kind: HTTP_ERROR_KIND.NETWORK_ERROR }),
        retryable: true,
      };
      if (attempt === SESSION_CHECK_MAX_ATTEMPTS - 1) {
        return lastResult;
      }
    }

    await delay(SESSION_CHECK_RETRY_MS * (attempt + 1));
  }

  return lastResult || { email: null, error: buildHttpError({ kind: HTTP_ERROR_KIND.UNKNOWN }) };
}

function App() {
  const [userEmail, setUserEmail] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [loading, setLoading] = useState(true);

  const runSessionCheck = useCallback(async () => {
    setLoading(true);
    setSessionError(null);

    const result = await checkSessionWithRetry();
    setUserEmail(result.email);
    setSessionError(result.error);
    setLoading(false);
    return result;
  }, []);

  useEffect(() => {
    runSessionCheck();
  }, [runSessionCheck]);

  useEffect(() => {
    function syncLogout(event) {
      if (event.key === "logout") {
        setUserEmail(null);
      }
    }
    window.addEventListener("storage", syncLogout);
    return () => window.removeEventListener("storage", syncLogout);
  }, []);

  if (loading && !window.location.pathname.startsWith('/receipt/download')) {
    return <LoadingScreen />;
  }

  const isAuthenticated = !!userEmail;

  return (
    <Router>
      <Routes>
        <Route path="/hello" element={<Hello />} />
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/features" element={<Features />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/security" element={<Security />} />
        <Route path="/documentation" element={<Documentation />} />
        <Route path="/receipt/download" element={<ReceiptDownload />} />
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login setUserEmail={setUserEmail} />
            )
          }
        />
        <Route
          path="/otp-login"
          element={<Navigate to="/login" replace />}
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Register setUserEmail={setUserEmail} />
            )
          }
        />
        <Route
          path="/forgot-password"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ForgotPassword />
            )
          }
        />
        {/* Signup route removed per design change */}

        {/* AuthenticatedLayout routes - Authentication is handled by AuthenticatedLayout */}
        <Route
          element={
            <AuthenticatedLayout
              userEmail={userEmail}
              setUserEmail={setUserEmail}
              sessionError={sessionError}
              onRetrySession={runSessionCheck}
            />
          }
        >
          <Route
            path="/dashboard"
            element={<Dashboard userEmail={userEmail} setUserEmail={setUserEmail} />}
          />
          <Route path="/create-election" element={<CreateElection />} />
          <Route path="/election-page/:id" element={<ElectionPage />} />
          <Route path="/election-page/:id/:tab" element={<ElectionPage />} />
          <Route path="/all-elections" element={<AllElections />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/authenticated-users" element={<AuthenticatedUsers />} />
          <Route path="/api-logs" element={<ApiLogs />} />
          {/* Add other authenticated routes here */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
