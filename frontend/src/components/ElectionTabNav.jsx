import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Election section navigation — Ink & Indigo.
 * Mobile: compact fixed bottom bar (stays visible while scrolling).
 * Desktop: horizontal top tabs with scroll fades when needed.
 */
export default function ElectionTabNav({ tabs = [], activeKey, onSelect }) {
  const listRef = useRef(null);
  const mobileBottomRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const activeTab = useMemo(
    () => tabs.find((t) => t.key === activeKey) || tabs[0],
    [tabs, activeKey]
  );

  const updateScrollFades = () => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollFades();
    const el = listRef.current;
    if (!el) return undefined;
    el.addEventListener("scroll", updateScrollFades, { passive: true });
    window.addEventListener("resize", updateScrollFades);
    return () => {
      el.removeEventListener("scroll", updateScrollFades);
      window.removeEventListener("resize", updateScrollFades);
    };
  }, [tabs]);

  useEffect(() => {
    const el = listRef.current;
    if (el && activeKey) {
      el.querySelector(`[data-tab-key="${activeKey}"]`)?.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    }
    const mobileEl = mobileBottomRef.current;
    if (mobileEl && activeKey) {
      mobileEl.querySelector(`[data-mobile-tab="${activeKey}"]`)?.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeKey]);

  const select = (key) => {
    onSelect?.(key);
  };

  if (!tabs.length) return null;

  return (
    <>
      {/* Mobile — current section label only (compact, does not steal the viewport) */}
      <div className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-dark">
            Section
          </p>
          <p className="min-w-0 truncate text-sm font-medium text-ink">
            <span className="text-dusk">
              {tabs.findIndex((t) => t.key === activeKey) + 1}/{tabs.length}
            </span>
            <span className="mx-1.5 text-ink/20">·</span>
            {activeTab?.name}
          </p>
        </div>
      </div>

      {/* Desktop tabs */}
      <div className="relative hidden border-b border-ink/10 bg-paper/90 backdrop-blur-sm md:block">
        <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
          {canScrollLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-paper to-transparent" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-paper to-transparent" />
          )}
          <div
            ref={listRef}
            className="overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
          >
            <nav className="flex min-w-max gap-1 pb-px" aria-label="Election sections">
              {tabs.map((menu) => {
                const Icon = menu.icon;
                const isActive = activeKey === menu.key;
                return (
                  <button
                    key={menu.key}
                    type="button"
                    data-tab-key={menu.key}
                    onClick={() => select(menu.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-t-xl px-3.5 py-3.5 text-base font-medium transition-colors ${
                      isActive
                        ? "border-b-2 border-brand bg-brand-soft/50 text-brand-dark"
                        : "border-b-2 border-transparent text-dusk hover:bg-frost hover:text-ink"
                    }`}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                    <span>{menu.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile — fixed bottom section bar (replaces app Home/Elections nav on this page) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-deep/95 backdrop-blur-lg shadow-nav safe-pb"
        aria-label="Election sections"
      >
        <div
          ref={mobileBottomRef}
          className="flex gap-1 overflow-x-auto px-2 py-1.5 scrollbar-hide"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeKey;
            return (
              <button
                key={tab.key}
                type="button"
                data-mobile-tab={tab.key}
                onClick={() => select(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl px-2 py-2 text-[10px] font-semibold transition-colors ${
                  isActive
                    ? "bg-brand/25 text-paper"
                    : "text-dusk-soft hover:bg-paper/5 hover:text-paper"
                }`}
              >
                {Icon ? (
                  <Icon
                    className={`mb-0.5 h-4 w-4 ${isActive ? "text-brand-light" : ""}`}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="max-w-[4.5rem] truncate">{tab.shortName || tab.name}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
