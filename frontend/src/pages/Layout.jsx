import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";

const NAV_LINKS = [
  { path: "/features", label: "Features" },
  { path: "/how-it-works", label: "How It Works" },
  { path: "/architecture", label: "Architecture" },
  { path: "/security", label: "Security" },
  { path: "/about", label: "About" },
];

const Layout = ({ children }) => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActiveRoute = (path) => location.pathname === path;

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <nav className="nav-deep sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
            <div className="brand-mark transition group-hover:scale-105">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 12 2 2 4-4" />
                <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <span className="brand-wordmark-light">AmarVote</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActiveRoute(path)
                    ? "bg-white/10 text-brand-light"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-xl border border-white/20 px-3.5 py-2 text-sm font-semibold text-white transition hover:border-brand/50 hover:bg-white/5 sm:inline-flex"
            >
              Log in
            </Link>
            <Link to="/register" className="btn-brand hidden px-4 py-2 sm:inline-flex">
              Register
            </Link>
            <button
              type="button"
              className="inline-flex rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/10 bg-deep-soft px-4 py-3 md:hidden safe-pb">
            <div className="space-y-1">
              {NAV_LINKS.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActiveRoute(path)
                      ? "bg-brand/15 text-brand-light"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl border border-white/20 py-2.5 text-center text-sm font-semibold text-white"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="btn-brand py-2.5 text-center"
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-grow">{children}</main>

      <footer className="bg-deep text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Product</h3>
              <ul className="mt-4 space-y-3">
                <li><Link to="/features" className="hover:text-brand-light transition">Features</Link></li>
                <li><Link to="/security" className="hover:text-brand-light transition">Security</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resources</h3>
              <ul className="mt-4 space-y-3">
                <li><Link to="/documentation" className="hover:text-brand-light transition">Documentation</Link></li>
                <li><Link to="/how-it-works" className="hover:text-brand-light transition">How It Works</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company</h3>
              <ul className="mt-4 space-y-3">
                <li><Link to="/about" className="hover:text-brand-light transition">About</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Platform</h3>
              <ul className="mt-4 space-y-3">
                <li><Link to="/architecture" className="hover:text-brand-light transition">Architecture</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="brand-mark h-8 w-8">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 12 2 2 4-4" />
                  <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <span className="font-display font-semibold text-white">AmarVote</span>
            </div>
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} AmarVote. Secure, verifiable digital democracy.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
