import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Hello from "./pages/Hello";
import ForgetPassword from "./pages/ForgotPassword";
import CreateNewPassword from "./pages/CreateNewPassword"; // ✅ Import the page
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import AuthenticatedLayout from "./pages/AuthenticatedLayout";
import Profile from "./pages/Profile";

function App() {
  const [userEmail, setUserEmail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("http://localhost:8080/api/auth/session", {
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

  if (loading) return <div>Loading...</div>;

  const isAuthenticated = !!userEmail;

  return (
    <Router>
      <Routes>
        <Route path="/hello" element={<Hello />} />
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
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
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />
          }
        />
        <Route
          element={
            <AuthenticatedLayout
              userEmail={userEmail}
              setUserEmail={setUserEmail}
            />
          }
        >
          {/* <Route path="/elections" element={<Elections />} />
          <Route path="/profile" element={<Profile />} />
          other routes */}
          <Route
            path="/profile"
            element={
              isAuthenticated ? (
                <Profile userEmail={userEmail} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          ></Route>
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
            path="/forgot-password"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <ForgetPassword />
              )
            }
          />
          <Route
            path="/create-password"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <CreateNewPassword />
              )
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
