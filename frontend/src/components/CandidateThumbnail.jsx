import React from 'react';
import { FiUser } from 'react-icons/fi';

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const CandidateThumbnail = ({ src, name, size = 'md', className = '', fallback = true }) => {
  const sizeCls = SIZE_CLASS[size] || SIZE_CLASS.md;
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  if (!src) {
    if (!fallback) return null;
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-glacier font-semibold text-brand-dark ${sizeCls} ${className}`}
        aria-hidden={!name}
        title={name || undefined}
      >
        {initial || <FiUser className="h-4 w-4" />}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name ? `${name} photo` : 'Candidate photo'}
      className={`${sizeCls} shrink-0 rounded-full object-cover ${className}`}
    />
  );
};

export default CandidateThumbnail;
