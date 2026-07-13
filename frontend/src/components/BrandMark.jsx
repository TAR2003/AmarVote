import React from "react";

/**
 * Official AmarVote mark — ballot + verified check (public/amarvote-icon.svg).
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

  return (
    <img
      src="/amarvote-icon.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`brand-mark ${sizeClass} ${light ? "brand-mark-light" : ""} ${className}`}
    />
  );
}

export function BrandWordmark({ light = false, className = "" }) {
  return (
    <span className={`${light ? "brand-wordmark-light" : "brand-wordmark"} ${className}`}>
      AmarVote
    </span>
  );
}
