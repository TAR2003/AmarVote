import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiCheck, FiGrid } from "react-icons/fi";

/**
 * Election section navigation.
 * Mobile: all tabs as scrollable chips + full section sheet.
 * Desktop: horizontal tabs with scroll fades.
 */
export default function ElectionTabNav({ tabs = [], activeKey, onSelect }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const listRef = useRef(null);
  const mobileChipsRef = useRef(null);
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
    if (!sheetOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  useEffect(() => {
    const el = listRef.current;
    if (el && activeKey) {
      el.querySelector(`[data-tab-key="${activeKey}"]`)?.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    }
    const mobileEl = mobileChipsRef.current;
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
    setSheetOpen(false);
  };

  if (!tabs.length) return null;

  const ActiveIcon = activeTab?.icon;

  return (
    <>
      {/* Mobile: current section + ALL tabs as chips */}
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-md md:hidden">
        <div className="mx-auto max-w-7xl px-3 py-2.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200/90 bg-frost px-3 py-2.5 text-left shadow-soft transition active:scale-[0.99]"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-glow text-white shadow-soft">
                {ActiveIcon ? <ActiveIcon className="h-4 w-4" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-dark">
                  Section · {tabs.length} available
                </span>
                <span className="block truncate font-display text-[15px] font-semibold text-deep">
                  {activeTab?.name || "Navigate"}
                </span>
              </span>
              <FiChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex h-[3.25rem] w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-ink shadow-soft"
              aria-label="Show all election sections"
            >
              <FiGrid className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={mobileChipsRef}
            className="mt-2.5 -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 scrollbar-hide"
            aria-label="All election sections"
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
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-deep text-white shadow-soft"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  <span>{tab.shortName || tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop tabs */}
      <div className="relative hidden border-b border-slate-200/80 bg-white/90 backdrop-blur-sm md:block">
        <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
          {canScrollLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent" />
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
                    className={`flex items-center gap-2 whitespace-nowrap rounded-t-xl px-3.5 py-3.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-b-2 border-brand bg-glacier/50 text-brand-dark"
                        : "border-b-2 border-transparent text-slate-500 hover:bg-frost hover:text-ink"
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

      {/* Mobile full section sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Election sections">
          <button
            type="button"
            className="absolute inset-0 bg-deep/45 backdrop-blur-[2px]"
            aria-label="Close sections"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] animate-fade-up overflow-hidden rounded-t-3xl bg-white shadow-glass">
            <div className="flex justify-center pt-3">
              <span className="h-1 w-10 rounded-full bg-slate-200" />
            </div>
            <div className="border-b border-slate-100 px-5 pb-3 pt-2">
              <p className="section-kicker">All sections</p>
              <h2 className="mt-1 font-display text-xl font-bold text-deep">
                {tabs.length} places in this election
              </h2>
            </div>
            <div className="overflow-y-auto px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
              <ul className="space-y-1">
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  const isActive = tab.key === activeKey;
                  return (
                    <li key={tab.key}>
                      <button
                        type="button"
                        onClick={() => select(tab.key)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left transition ${
                          isActive
                            ? "bg-glacier text-brand-dark ring-1 ring-brand/25"
                            : "text-ink hover:bg-frost"
                        }`}
                      >
                        <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-400">
                          {index + 1}
                        </span>
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            isActive ? "bg-brand-glow text-white" : "bg-frost text-slate-500"
                          }`}
                        >
                          {Icon ? <Icon className="h-5 w-5" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[15px] font-semibold">
                            {tab.name}
                          </span>
                          {tab.hint ? (
                            <span className="mt-0.5 block text-xs text-slate-500">{tab.hint}</span>
                          ) : null}
                        </span>
                        {isActive ? <FiCheck className="h-5 w-5 shrink-0 text-brand" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
