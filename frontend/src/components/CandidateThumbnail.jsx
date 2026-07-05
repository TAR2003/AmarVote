import React from 'react';

const SIZE_CLASS = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const CandidateThumbnail = ({ src, name, size = 'md', className = '' }) => {
  if (!src) return null;

  return (
    <img
      src={src}
      alt={name ? `${name} photo` : 'Candidate photo'}
      className={`${SIZE_CLASS[size] || SIZE_CLASS.md} rounded-full object-cover flex-shrink-0 ${className}`}
    />
  );
};

export default CandidateThumbnail;
