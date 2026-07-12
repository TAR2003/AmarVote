import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import BrandMark, { BrandWordmark } from "../components/BrandMark";

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
  const [scrolled, setScrolled] = useState(false);

  const isActiveRoute = (path) => location.pathname === path;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <nav
        className={`nav-deep sticky top-0 z-50 transition-shadow duration-300 ${
          scrolled ? "shadow-nav" : "shadow-none"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="group flex items-center gap-2.5"
            onClick={() => setMobileOpen(false)}
          >
            <BrandMark className="transition duration-300 group-hover:scale-105 group-hover:shadow-brand" />
            <BrandWordmark light />
          </Link>

          <div className="hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition duration-200 ${
                  isActiveRoute(path)
                    ? "text-brand-light"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {label}
                {isActiveRoute(path) && (
                  <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-light" />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost-light hidden px-3.5 py-2 sm:inline-flex">
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

        <div
          className={`overflow-hidden border-t border-white/10 bg-deep-soft transition-all duration-300 md:hidden ${
            mobileOpen ? "max-h-96 opacity-100" : "max-h-0 border-transparent opacity-0"
          }`}
        >
          <div className="space-y-1 px-4 py-3 safe-pb">
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
        </div>
      </nav>

      <main className="flex-grow page-enter">{children}</main>

      <footer className="relative overflow-hidden bg-deep text-slate-300">
        <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Product</h3>
              <ul className="mt-4 space-y-3">
                <li><Link to="/features" className="transition hover:text-brand-light">Features</Link></li>
                <li><Link to="/security" className="transition hover:text-brand-light">Security</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resources</h3>
              <ul className="mt-4 space-y-3">
                <li><Link to="/documentation" className="transition hover:text-brand-light">Documentation</Link></li>
                <li><Link to="/how-it-works" className="transition hover:text-brand-light">How It Works</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company</h3>
              <ul className="mt-4 space-y-3">
                <li><Link to="/about" className="transition hover:text-brand-light">About</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Platform</h3>
              <ul className="mt-4 space-y-3">
                <li><Link to="/architecture" className="transition hover:text-brand-light">Architecture</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <BrandMark size="sm" />
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
