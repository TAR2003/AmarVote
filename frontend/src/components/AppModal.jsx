import React, { useEffect, useId, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import ModalOverlay, { ModalPanel } from './ModalOverlay';

/**
 * Light glass-panel modal shell matching the app design system.
 * Portaled full-viewport backdrop; ESC / backdrop click close when dismissible.
 * Panel fits the screen — body scrolls internally only if content overflows.
 */
const AppModal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissible = true,
  labelledBy,
  className = '',
}) => {
  const titleId = useId();
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    const onKeyDown = (e) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const t = window.setTimeout(() => {
      const closeBtn = panelRef.current?.querySelector('[data-modal-close]');
      (closeBtn || panelRef.current)?.focus?.();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(t);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose} dismissible={dismissible}>
      <ModalPanel size={size} className={className}>
        <div
          ref={panelRef}
          tabIndex={-1}
          aria-labelledby={labelledBy || (title ? titleId : undefined)}
          className="flex min-h-0 flex-1 flex-col outline-none"
        >
          {(title || dismissible) && (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink/10 px-4 py-3 sm:px-5">
              {title ? (
                <h2 id={titleId} className="font-display text-lg font-semibold text-deep sm:text-xl">
                  {title}
                </h2>
              ) : (
                <span className="sr-only">Dialog</span>
              )}
              {dismissible && (
                <button
                  type="button"
                  data-modal-close
                  onClick={onClose}
                  className="shrink-0 rounded-xl p-1.5 text-dusk transition hover:bg-frost hover:text-ink"
                  aria-label="Close"
                >
                  <FiX className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {children}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-ink/10 px-4 py-3 sm:px-5">{footer}</div>
          )}
        </div>
      </ModalPanel>
    </ModalOverlay>
  );
};

export default AppModal;
