import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiUser } from 'react-icons/fi';
import CandidateThumbnail from './CandidateThumbnail';
import TruncatedCandidateName from './TruncatedCandidateName';
import CandidateProfileModal from './CandidateProfileModal';

const HOVER_DELAY_MS = 140;
const HOVER_CARD_W = 320;

function previewText(text, maxChars = 160) {
  if (!text?.trim()) return '';
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trim()}…`;
}

/**
 * Candidate name + photo with hover preview and profile modal.
 * Hover + click are always available when interactive — description is optional.
 */
const CandidateIdentity = ({
  name,
  image,
  description,
  partyName,
  size = 'md',
  showImage = true,
  enableProfile = true,
  className = '',
  nameClassName = '',
  layout = 'row', // 'row' | 'stack'
  interactive = true,
  showInlineDescription = false,
}) => {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const hoverTimer = useRef(null);
  const cardId = useId();

  const canInteract = interactive && enableProfile;
  const hasDescription = Boolean(description?.trim());

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 10;
    let left = rect.left;
    if (left + HOVER_CARD_W > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - HOVER_CARD_W - 12);
    }
    const approxH = hasDescription ? 220 : 160;
    let top = rect.bottom + gap;
    if (top + approxH > window.innerHeight) {
      top = Math.max(12, rect.top - approxH - gap);
    }
    setCoords({ top, left });
  }, [hasDescription]);

  const openHover = () => {
    if (!canInteract) return;
    if (window.matchMedia('(hover: none)').matches) return;
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => {
      updatePosition();
      setHoverOpen(true);
    }, HOVER_DELAY_MS);
  };

  const closeHover = () => {
    clearHoverTimer();
    setHoverOpen(false);
  };

  const openModal = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (!canInteract) return;
    closeHover();
    setModalOpen(true);
  };

  useEffect(() => () => clearHoverTimer(), []);

  useEffect(() => {
    if (!hoverOpen) return undefined;
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [hoverOpen, updatePosition]);

  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const isStack = layout === 'stack';

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative ${isStack ? 'flex flex-col items-center text-center' : 'flex min-w-0 items-center gap-3'} ${className}`}
        onMouseEnter={openHover}
        onMouseLeave={closeHover}
        onFocus={openHover}
        onBlur={closeHover}
      >
        {showImage && (
          <button
            type="button"
            className={`shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${canInteract ? 'cursor-pointer transition hover:brightness-105' : 'cursor-default'}`}
            onClick={canInteract ? openModal : undefined}
            aria-label={canInteract ? `View profile for ${name}` : name}
            tabIndex={canInteract ? 0 : -1}
          >
            {image ? (
              <CandidateThumbnail src={image} name={name} size={size} fallback={false} />
            ) : (
              <span
                className={`inline-flex items-center justify-center rounded-full bg-glacier font-semibold text-brand-dark ${
                  size === 'sm' ? 'h-8 w-8 text-xs' : size === 'xl' ? 'h-16 w-16 text-lg' : size === 'lg' ? 'h-12 w-12 text-lg' : 'h-10 w-10 text-sm'
                }`}
                aria-hidden
              >
                {initial || <FiUser className="h-4 w-4" />}
              </span>
            )}
          </button>
        )}

        <div className={`min-w-0 ${isStack ? 'mt-2 w-full' : 'flex-1'}`}>
          {canInteract ? (
            <div
              role="button"
              tabIndex={0}
              className={`w-full cursor-pointer text-left ${isStack ? 'text-center' : ''} ${nameClassName}`}
              onClick={openModal}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openModal(e);
              }}
              aria-describedby={hoverOpen ? cardId : undefined}
            >
              <TruncatedCandidateName name={name} lines={1} className="font-medium text-ink" />
            </div>
          ) : (
            <div className={nameClassName}>
              <TruncatedCandidateName name={name} lines={1} className="font-medium text-ink" />
            </div>
          )}
          {hasDescription && enableProfile && showInlineDescription && (
            <p className={`mt-0.5 text-xs text-dusk line-clamp-2 whitespace-pre-line ${isStack ? 'text-center' : ''}`}>
              {previewText(description, 90)}
            </p>
          )}
        </div>
      </div>

      {hoverOpen &&
        canInteract &&
        createPortal(
          <div
            id={cardId}
            role="tooltip"
            className="pointer-events-none fixed z-[55] origin-top animate-fade-in overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-lift"
            style={{ top: coords.top, left: coords.left, width: HOVER_CARD_W }}
          >
            <div className="flex gap-3.5 p-3.5">
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-soft ring-1 ring-ink/5"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-soft to-glacier font-display text-2xl font-semibold text-brand-dark ring-1 ring-ink/5">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-display text-[15px] font-semibold leading-snug tracking-tight text-deep line-clamp-2">
                  {name}
                </p>
                {partyName && partyName.trim() && !/^\d+$/.test(partyName.trim()) && (
                  <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.08em] text-brand-dark">
                    {partyName}
                  </p>
                )}
                {hasDescription ? (
                  <p className="mt-2 line-clamp-3 font-display text-[12px] font-normal leading-relaxed text-dusk">
                    {previewText(description, 160)}
                  </p>
                ) : null}
                <p className="mt-2.5 text-[11px] font-semibold tracking-wide text-brand-dark">
                  Click to view profile →
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}

      <CandidateProfileModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        name={name}
        image={image}
        description={description}
        partyName={partyName}
      />
    </>
  );
};

export default CandidateIdentity;
