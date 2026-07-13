import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

/**
 * Election section navigation — Ink & Indigo.
 * Mobile: fixed bottom bar with paging carousel (4 tabs + arrow controls).
 * Desktop: horizontal top tabs with scroll fades when needed.
 */

const FIRST_PAGE_SIZE = 4;
const MIDDLE_PAGE_SIZE = 3;

function buildPages(tabs) {
  if (!tabs.length) return [];
  if (tabs.length <= 5) {
    return [{ start: 0, count: tabs.length }];
  }

  const pages = [];
  let idx = 0;
  while (idx < tabs.length) {
    const isFirst = pages.length === 0;
    const remaining = tabs.length - idx;
    let take;
    if (isFirst) {
      take = Math.min(FIRST_PAGE_SIZE, remaining);
    } else if (remaining > FIRST_PAGE_SIZE) {
      take = MIDDLE_PAGE_SIZE;
    } else {
      take = remaining;
    }
    pages.push({ start: idx, count: take });
    idx += take;
  }
  return pages;
}

export default function ElectionTabNav({ tabs = [], activeKey, onSelect }) {
  const listRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [slideDir, setSlideDir] = useState(0);

  const pages = useMemo(() => buildPages(tabs), [tabs]);
  const totalPages = pages.length;

  const activeTab = useMemo(
    () => tabs.find((t) => t.key === activeKey) || tabs[0],
    [tabs, activeKey]
  );

  // Keep the active tab's page visible
  useEffect(() => {
    if (!tabs.length || !totalPages) return;
    const activeIdx = tabs.findIndex((t) => t.key === activeKey);
    if (activeIdx < 0) return;
    const pageForActive = pages.findIndex(
      (p) => activeIdx >= p.start && activeIdx < p.start + p.count
    );
    if (pageForActive >= 0 && pageForActive !== pageIndex) {
      setSlideDir(pageForActive > pageIndex ? 1 : -1);
      setPageIndex(pageForActive);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when active tab or tab list changes
  }, [activeKey, tabs, pages, totalPages]);

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
    if (!el || !activeKey) return;
    const tabEl = el.querySelector(`[data-tab-key="${activeKey}"]`);
    // jsdom does not implement scrollIntoView; guard so tests/SSR don't crash.
    tabEl?.scrollIntoView?.({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeKey]);

  const select = (key) => {
    onSelect?.(key);
  };

  const goPage = (next) => {
    if (next < 0 || next >= totalPages) return;
    setSlideDir(next > pageIndex ? 1 : -1);
    setPageIndex(next);
  };

  if (!tabs.length) return null;

  const safePage = Math.min(pageIndex, Math.max(0, totalPages - 1));
  const page = pages[safePage] || pages[0];
  const pageTabs = tabs.slice(page.start, page.start + page.count);
  const hasPrev = safePage > 0;
  const hasNext = safePage < totalPages - 1;
  const showPager = totalPages > 1;

  const arrowBtnClass =
    "flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold text-brand-light transition-colors hover:bg-brand/20";

  return (
    <>
      {/* Mobile — current section label only */}
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

      {/* Mobile — paging carousel bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-deep/95 backdrop-blur-lg shadow-nav safe-pb"
        aria-label="Election sections"
      >
        <div
          key={`${safePage}-${slideDir}`}
          className={`flex items-stretch gap-0.5 px-1.5 py-1.5 ${
            slideDir > 0
              ? "animate-tab-slide-in-right"
              : slideDir < 0
                ? "animate-tab-slide-in-left"
                : ""
          }`}
        >
          {hasPrev && (
            <button
              type="button"
              onClick={() => goPage(safePage - 1)}
              className={arrowBtnClass}
              aria-label="Previous sections"
            >
              <span className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-paper shadow-brand">
                <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-dusk-soft">More</span>
            </button>
          )}

          {pageTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeKey;
            return (
              <button
                key={tab.key}
                type="button"
                data-mobile-tab={tab.key}
                onClick={() => select(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors ${
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
                <span className="max-w-full truncate px-0.5">
                  {tab.shortName || tab.name}
                </span>
              </button>
            );
          })}

          {hasNext && (
            <button
              type="button"
              onClick={() => goPage(safePage + 1)}
              className={arrowBtnClass}
              aria-label="More sections"
            >
              <span className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-paper shadow-brand">
                <FiChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-dusk-soft">More</span>
            </button>
          )}
        </div>

        {showPager && (
          <div className="flex items-center justify-center gap-1.5 pb-1" aria-hidden="true">
            {pages.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === safePage ? "w-3 bg-brand" : "w-1 bg-paper/25"
                }`}
              />
            ))}
          </div>
        )}
      </nav>
    </>
  );
}
