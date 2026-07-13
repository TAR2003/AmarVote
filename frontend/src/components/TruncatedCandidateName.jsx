import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * CSS line-clamp truncation with See more / See less.
 * Default: 1 line (names). Pass lines={2|3} for longer previews.
 */
const TruncatedCandidateName = ({ name, className = '', lines = 1 }) => {
  const [expanded, setExpanded] = useState(false);
  const [needsTruncate, setNeedsTruncate] = useState(false);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    setExpanded(false);
  }, [name, lines]);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;

    const check = () => {
      setNeedsTruncate(el.scrollHeight > el.clientHeight + 1);
    };
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [name, lines, expanded]);

  if (!name) return null;

  const clampClass = expanded
    ? 'transition-[max-height] duration-200 ease-out'
    : lines <= 1
      ? 'line-clamp-1'
      : lines === 2
        ? 'line-clamp-2'
        : 'line-clamp-3';

  return (
    <span className={`inline-block max-w-full align-top ${className}`}>
      <span ref={textRef} className={`block break-words ${clampClass}`}>
        {name}
      </span>
      {needsTruncate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-0.5 text-xs font-medium text-brand-dark hover:underline"
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      )}
    </span>
  );
};

export default TruncatedCandidateName;
