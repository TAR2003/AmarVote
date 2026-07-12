import React from 'react';
import { FiUser } from 'react-icons/fi';
import AppModal from './AppModal';
import TruncatedCandidateName from './TruncatedCandidateName';

const CandidateProfileModal = ({
  isOpen,
  onClose,
  name,
  image,
  description,
  partyName,
}) => {
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Candidate Profile"
      size="lg"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48">
          <div className="aspect-square overflow-hidden rounded-2xl border border-ink/10 bg-glacier shadow-soft">
            {image ? (
              <img
                src={image}
                alt={name ? `${name} photo` : 'Candidate photo'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-brand-dark">
                <FiUser className="h-12 w-12" aria-hidden />
                <span className="font-display text-3xl font-semibold">{initial}</span>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-deep sm:text-2xl">
              <TruncatedCandidateName name={name} lines={2} />
            </h3>
            {partyName && partyName.trim() && !/^\d+$/.test(partyName.trim()) && (
              <p className="mt-1 text-sm font-medium text-brand-dark">{partyName}</p>
            )}
          </div>

          {description?.trim() ? (
            <div className="rounded-xl border border-ink/10 bg-frost/70 p-3 sm:p-4">
              <p className="section-kicker mb-2">Description / Manifesto</p>
              <div className="max-h-[40dvh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {description.trim()}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppModal>
  );
};

export default CandidateProfileModal;
