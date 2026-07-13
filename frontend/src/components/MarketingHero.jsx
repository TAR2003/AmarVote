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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dusk-soft">
            {kicker}
          </p>
        )}
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-paper text-balance sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-dusk-soft text-balance sm:text-lg">
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
    <div className="sticky top-16 z-20 border-b border-ink/10 bg-paper/90 shadow-soft backdrop-blur-lg">
      <div className="relative mx-auto max-w-6xl">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-paper/90 to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-paper/90 to-transparent sm:hidden" />
        <div className="flex overflow-x-auto scrollbar-hide px-4 sm:px-5">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`relative whitespace-nowrap px-3.5 py-4 text-base font-medium transition sm:px-4 ${
              active === id
                ? "text-brand-dark"
                : "text-dusk hover:text-ink"
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
    </div>
  );
}
