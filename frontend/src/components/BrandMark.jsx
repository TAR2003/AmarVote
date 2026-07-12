import React from "react";

/**
 * Official AmarVote mark — ballot + verified check on guardian-gold glow.
 * Use across nav, loading, footer, and branded moments.
 */
export default function BrandMark({
  size = "md",
  className = "",
  light = false,
}) {
  const sizeClass =
    size === "sm"
      ? "h-7 w-7"
      : size === "lg"
        ? "h-12 w-12"
        : size === "xl"
          ? "h-16 w-16"
          : "h-9 w-9";

  const iconClass =
    size === "sm"
      ? "h-3.5 w-3.5"
      : size === "lg"
        ? "h-6 w-6"
        : size === "xl"
          ? "h-8 w-8"
          : "h-5 w-5";

  return (
    <div
      className={`brand-mark ${sizeClass} ${light ? "brand-mark-light" : ""} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 8V7a4 4 0 0 1 8 0v1" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    </div>
  );
}

export function BrandWordmark({ light = false, className = "" }) {
  return (
    <span className={`${light ? "brand-wordmark-light" : "brand-wordmark"} ${className}`}>
      AmarVote
    </span>
  );
}
