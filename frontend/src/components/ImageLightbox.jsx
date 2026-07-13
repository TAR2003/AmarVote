import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

/** Dark backdrop image viewer — ESC / backdrop / close button. */
const ImageLightbox = ({ src, alt = 'Image', isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-deep/85 p-4 backdrop-blur-sm"
      style={{ width: '100vw', height: '100dvh', left: 0, top: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-xl bg-paper/10 p-2 text-paper transition hover:bg-paper/20"
        aria-label="Close image"
      >
        <FiX className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90dvh] max-w-full rounded-xl object-contain shadow-lift"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
};

export default ImageLightbox;
