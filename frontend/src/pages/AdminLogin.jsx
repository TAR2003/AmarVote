import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import BrandMark from "../components/BrandMark";
import PasswordInput from "../components/PasswordInput";
import { readAuthResponse, resolveAuthErrorMessage } from "../utils/authApi";
import { getApiErrorMessage } from "../utils/httpErrors";

export default function AdminLogin({ setUserEmail }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const { data, ok } = await readAuthResponse(res);

      if (!ok || !data.success) {
        throw Object.assign(
          new Error(resolveAuthErrorMessage(res, data, "Invalid admin credentials")),
          { status: res.status }
        );
      }

      if (setUserEmail) setUserEmail("admin");
      navigate("/api-logs");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden bg-frost-mesh px-4 py-10 sm:py-14">
        <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-16 h-72 w-72 rounded-full bg-brand-light/15 blur-3xl" />

        <div className="glass-panel relative z-10 mx-auto w-full max-w-md p-6 sm:p-8 animate-fade-up">
          <div className="mb-7 text-center">
            <div className="mb-4 flex justify-center">
              <BrandMark size="lg" className="shadow-brand" />
            </div>
            <p className="section-kicker">Operations</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-deep sm:text-3xl">
              Admin access
            </h1>
            <p className="mt-2 text-sm text-dusk">
              Sign in to view API logs and system analytics.
            </p>
          </div>

          {error && (
            <div
              className="mb-4 rounded-xl border border-ember/30 bg-ember-soft px-4 py-3 text-sm text-ember"
              role="alert"
            >
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dusk"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="admin"
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dusk"
              >
                Password
              </label>
              <PasswordInput
                id="admin-password"
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoComplete="current-password"
                showRequirements={false}
                showValidation={false}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-brand w-full">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-dusk">
            Only authorized administrators can access this area.
          </p>
        </div>
      </div>
    </Layout>
  );
}
