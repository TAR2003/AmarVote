import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Hello from "./pages/Hello";

function App() {
  // Use userEmail (or isAuthenticated boolean) instead of token
  const [userEmail, setUserEmail] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app load, check if user session exists by hitting backend endpoint
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("http://localhost:8080/api/auth/session", {
          method: "GET",
          credentials: "include", // send cookies
        });
        if (res.ok) {
          const data = await res.json();
          if (data.email) {
            setUserEmail(data.email);
          } else {
            setUserEmail(null);
          }
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

  // Listen for logout events from other tabs
  useEffect(() => {
    function syncLogout(event) {
      if (event.key === "logout") {
        // Another tab logged out, clear userEmail here too
        setUserEmail(null);
      }
    }
    window.addEventListener("storage", syncLogout);

    return () => {
      window.removeEventListener("storage", syncLogout);
    };
  }, []);

  if (loading) {
    return <div>Loading...</div>; // or a spinner component
  }

  const isAuthenticated = !!userEmail;

  return (
    <Router>
      <Routes>
        <Route path="/hello" element={<Hello />} />
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
          path="/signup"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Signup />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard userEmail={userEmail} setUserEmail={setUserEmail} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
