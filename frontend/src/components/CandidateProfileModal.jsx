import React from 'react';
import { FiUser } from 'react-icons/fi';
import AppModal from './AppModal';
import TruncatedCandidateName from './TruncatedCandidateName';

/**
 * Full candidate profile — large photo, display typography.
 * Description is optional; modal still opens when none is provided.
 */
const CandidateProfileModal = ({
  isOpen,
  onClose,
  name,
  image,
  description,
  partyName,
}) => {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const hasDescription = Boolean(description?.trim());
  const showParty = Boolean(partyName?.trim() && !/^\d+$/.test(partyName.trim()));

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Candidate Profile"
      size="xl"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch sm:gap-8">
        {/* Large portrait — primary visual for voters */}
        <div className="mx-auto w-full max-w-[220px] shrink-0 sm:mx-0 sm:w-[240px] sm:max-w-none">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-ink/10 bg-glacier shadow-soft">
            {image ? (
              <img
                src={image}
                alt={name ? `${name} photo` : 'Candidate photo'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand-soft via-glacier to-frost text-brand-dark">
                <FiUser className="h-14 w-14 opacity-80" aria-hidden />
                <span className="font-display text-5xl font-semibold tracking-tight">{initial}</span>
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-deep/25 to-transparent"
              aria-hidden
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center space-y-5 py-1">
          <header className="space-y-2 border-b border-ink/10 pb-4">
            <p className="section-kicker !mb-0">On the ballot</p>
            <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight text-deep sm:text-3xl lg:text-[2rem]">
              <TruncatedCandidateName name={name} lines={3} />
            </h3>
            {showParty && (
              <p className="text-sm font-medium uppercase tracking-[0.12em] text-brand-dark">
                {partyName.trim()}
              </p>
            )}
          </header>

          {hasDescription ? (
            <div className="relative">
              <div
                className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-brand/50"
                aria-hidden
              />
              <div className="pl-4 sm:pl-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dusk">
                  Description / Manifesto
                </p>
                <div className="max-h-[min(42dvh,320px)] overflow-y-auto overscroll-contain">
                  <p className="whitespace-pre-wrap font-display text-[15px] font-normal leading-[1.75] text-ink/90 sm:text-base sm:leading-[1.85]">
                    {description.trim()}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppModal>
  );
};

export default CandidateProfileModal;
