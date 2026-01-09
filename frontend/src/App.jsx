import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import OtpLogin from "./pages/OtpLogin";
import Dashboard from "./pages/Dashboard";
import Hello from "./pages/Hello";
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import AuthenticatedLayout from "./pages/AuthenticatedLayout";
import CreateElection from "./pages/CreateElection";
import ElectionPage from "./pages/ElectionPage";
import AllElections from "./pages/AllElections";
import LoadingScreen from "./pages/Loading";
import Chatbot from "./components/Chatbot";
import About from "./pages/About";
import Features from "./pages/Features";
import AdminLogin from "./pages/AdminLogin";
import ApiLogs from "./pages/ApiLogs";

function App() {
  const [userEmail, setUserEmail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUserEmail(data.email || null);
        } else {
          setUserEmail(null);
        }
      } catch (err) {
        setUserEmail(null);
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, []);

  useEffect(() => {
    function syncLogout(event) {
      if (event.key === "logout") {
        setUserEmail(null);
      }
    }
    window.addEventListener("storage", syncLogout);
    return () => window.removeEventListener("storage", syncLogout);
  }, []);

  if (loading) return <LoadingScreen />;

  const isAuthenticated = !!userEmail;

  return (
    <Router>
      <Routes>
        <Route path="/hello" element={<Hello />} />
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/features" element={<Features />} />
        <Route
          path="/admin-login"
          element={<AdminLogin setUserEmail={setUserEmail} />}
        />
        <Route
          path="/api-logs"
          element={<ApiLogs userEmail={userEmail} />}
        />
        <Route
          path="/otp-login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <OtpLogin setUserEmail={setUserEmail} />
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
          {/* Add other authenticated routes here */}
        </Route>
      </Routes>
      
      {/* Show chatbot only for authenticated users */}
      {isAuthenticated && <Chatbot />}
    </Router>
  );
}

export default App;
