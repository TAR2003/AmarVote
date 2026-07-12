import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-viewport modal backdrop via portal.
 * Escapes layout scroll/transform containing blocks so left/right gutters dim and dismiss.
 */
export default function ModalOverlay({
  children,
  onClose,
  dismissible = true,
  className = '',
  zIndexClass = 'z-[100]',
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [dismissible, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-end justify-center bg-deep/65 p-0 backdrop-blur-sm sm:items-center sm:p-4 ${className}`}
      style={{ width: '100vw', height: '100dvh', left: 0, top: 0 }}
      onClick={() => dismissible && onClose?.()}
      role="presentation"
    >
      {children}
    </div>,
    document.body
  );
}

/**
 * Panel shell: fits the viewport, scrolls internally only when content overflows.
 */
export function ModalPanel({
  children,
  className = '',
  size = 'md',
  onClick,
  surface = 'glass',
}) {
  const maxWidth =
    size === 'sm'
      ? 'max-w-md'
      : size === 'lg'
        ? 'max-w-2xl'
        : size === 'xl'
          ? 'max-w-3xl'
          : size === 'full'
            ? 'max-w-4xl'
            : 'max-w-lg';

  const maxHeight =
    size === 'xl' || size === 'full'
      ? 'max-h-[min(92dvh,760px)]'
      : 'max-h-[min(88dvh,680px)]';

  const surfaceClass =
    surface === 'deep'
      ? 'modal-surface'
      : 'glass-panel';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`${surfaceClass} relative flex w-full ${maxWidth} ${maxHeight} min-h-[min(28dvh,200px)] flex-col overflow-hidden rounded-t-3xl shadow-lift sm:min-h-0 sm:rounded-2xl ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {children}
    </div>
  );
}
