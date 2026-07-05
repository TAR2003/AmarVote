import React, { useState } from 'react';

const TruncatedCandidateName = ({ name, className = '', maxLen = 48 }) => {
  const [expanded, setExpanded] = useState(false);
  const needsTruncate = name && name.length > maxLen;

  if (!needsTruncate || expanded) {
    return (
      <span className={className}>
        {name}
        {needsTruncate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="ml-1 text-xs text-blue-600 hover:underline font-medium"
          >
            show less
          </button>
        )}
      </span>
    );
  }

  return (
    <span className={className}>
      {name.slice(0, maxLen)}…
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
        className="ml-1 text-xs text-blue-600 hover:underline font-medium"
      >
        show more
      </button>
    </span>
  );
};

export default TruncatedCandidateName;
