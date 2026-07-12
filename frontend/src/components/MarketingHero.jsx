import React from "react";

/**
 * Shared full-bleed marketing hero — brand atmosphere, one title, one supporting line.
 */
export default function MarketingHero({ kicker, title, subtitle, children }) {
  return (
    <section className="hero-stage px-4 py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-16 h-64 w-64 animate-aurora-drift rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-light/10 blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto max-w-3xl text-center animate-fade-up">
        {kicker && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-light">
            {kicker}
          </p>
        )}
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white text-balance sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 text-balance sm:text-lg">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

export function MarketingTabs({ tabs, active, onChange }) {
  return (
    <div className="sticky top-16 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl overflow-x-auto scrollbar-hide px-4">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`relative whitespace-nowrap px-4 py-4 text-sm font-medium transition ${
              active === id
                ? "text-brand-dark"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
            {active === id && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
