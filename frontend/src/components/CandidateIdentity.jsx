import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiUser } from 'react-icons/fi';
import CandidateThumbnail from './CandidateThumbnail';
import TruncatedCandidateName from './TruncatedCandidateName';
import CandidateProfileModal from './CandidateProfileModal';

const HOVER_DELAY_MS = 160;
const PREVIEW_LINES = 3;

function previewText(text, maxChars = 160) {
  if (!text?.trim()) return '';
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trim()}…`;
}

/**
 * Candidate name + photo with hover preview and profile modal.
 * Reuses app tokens; works with keyboard (Enter/Space) and mobile tap.
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

  const hasProfileContent = Boolean(image || description?.trim());
  const canInteract = interactive && enableProfile;

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
    const cardWidth = 280;
    const gap = 8;
    let left = rect.left;
    if (left + cardWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - cardWidth - 12);
    }
    let top = rect.bottom + gap;
    if (top + 200 > window.innerHeight) {
      top = Math.max(12, rect.top - 200 - gap);
    }
    setCoords({ top, left });
  }, []);

  const openHover = () => {
    if (!canInteract || !hasProfileContent) return;
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
            className={`shrink-0 rounded-full focus-visible:outline-none ${canInteract ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={canInteract ? openModal : undefined}
            aria-label={canInteract ? `View profile for ${name}` : name}
            tabIndex={canInteract ? 0 : -1}
          >
            {image ? (
              <CandidateThumbnail src={image} name={name} size={size} fallback={false} />
            ) : (
              <span
                className={`inline-flex items-center justify-center rounded-full bg-glacier font-semibold text-brand-dark ${
                  size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-12 w-12 text-lg' : 'h-10 w-10 text-sm'
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
          {description?.trim() && enableProfile && showInlineDescription && (
            <p className={`mt-0.5 text-xs text-dusk line-clamp-2 whitespace-pre-line ${isStack ? 'text-center' : ''}`}>
              {previewText(description, 90)}
            </p>
          )}
        </div>
      </div>

      {hoverOpen &&
        hasProfileContent &&
        createPortal(
          <div
            id={cardId}
            role="tooltip"
            className="pointer-events-none fixed z-[55] w-[280px] origin-top animate-fade-in rounded-2xl border border-ink/10 bg-paper p-3 shadow-lift transition-transform duration-200"
            style={{ top: coords.top, left: coords.left }}
          >
            <div className="flex gap-3">
              {image ? (
                <img src={image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-glacier text-lg font-semibold text-brand-dark">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold text-deep">{name}</p>
                {partyName && partyName.trim() && !/^\d+$/.test(partyName.trim()) && (
                  <p className="truncate text-xs text-brand-dark">{partyName}</p>
                )}
                {description?.trim() ? (
                  <p className="mt-1 line-clamp-3 text-xs leading-snug text-dusk">
                    {previewText(description, 180)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-dusk">View full profile</p>
                )}
                <p className="mt-1.5 text-[11px] font-medium text-brand-dark">View Profile →</p>
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
