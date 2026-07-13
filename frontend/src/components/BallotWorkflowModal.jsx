import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  FiX,
  FiLoader,
  FiCheckCircle,
  FiShield,
  FiCheck,
  FiDownload,
  FiFileText,
  FiKey,
  FiInfo,
  FiCopy,
  FiSave,
  FiAlertCircle,
  FiTrash2,
  FiChevronDown,
} from 'react-icons/fi';
import { VOTER_STATUS_COPY } from '../utils/voterMessages';
import CandidateIdentity from './CandidateIdentity';
import ModalOverlay, { ModalPanel } from './ModalOverlay';

const HOLD_MS = 1800;

/**
 * Press-and-hold cast control — gold authority fill, weighted (no bounce).
 */
function HoldToConfirm({ onConfirm, label = 'Hold to cast this ballot', disabled = false }) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const doneRef = useRef(false);
  const pointerIdRef = useRef(null);

  const clear = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    pointerIdRef.current = null;
    setHolding(false);
    setProgress(0);
    doneRef.current = false;
  }, []);

  const tick = useCallback(
    (now) => {
      const elapsed = now - startRef.current;
      const next = Math.min(1, elapsed / HOLD_MS);
      setProgress(next);
      if (next >= 1 && !doneRef.current) {
        doneRef.current = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(28);
        }
        onConfirm?.();
        clear();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [clear, onConfirm]
  );

  const startHold = useCallback(
    (event) => {
      if (disabled || doneRef.current || rafRef.current) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        pointerIdRef.current = event.pointerId;
      } catch {
        /* setPointerCapture may fail for non-pointer events */
      }
      startRef.current = performance.now();
      setHolding(true);
      setProgress(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
    [disabled, tick]
  );

  const endHold = useCallback(
    (event) => {
      if (
        pointerIdRef.current != null &&
        event?.pointerId != null &&
        event.pointerId !== pointerIdRef.current
      ) {
        return;
      }
      clear();
    },
    [clear]
  );

  useEffect(() => () => clear(), [clear]);

  const pct = Math.round(progress * 100);
  const remainingSec = Math.max(0, ((1 - progress) * HOLD_MS) / 1000);
  const statusText = holding
    ? progress > 0.85
      ? 'Almost there…'
      : 'Keep holding…'
    : label;
  const hintText = holding
    ? `Release to cancel · ${remainingSec.toFixed(1)}s left`
    : 'Press and hold — watch the bar fill to cast';

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={startHold}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onLostPointerCapture={endHold}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.repeat) return;
        if (e.key === ' ' || e.key === 'Enter') startHold(e);
      }}
      onKeyUp={endHold}
      aria-label={label}
      aria-pressed={holding}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="group relative flex w-full touch-none select-none items-center gap-3 overflow-hidden rounded-2xl border border-brand/40 bg-gradient-to-br from-brand-dark to-brand px-4 py-4 text-left text-paper shadow-brand transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 bg-deep/[0.06]"
        style={{ width: '100%' }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-y-0 left-0 origin-left bg-deep/20 will-change-transform"
        style={{
          width: '100%',
          transform: `scaleX(${holding || progress > 0 ? progress : 0})`,
          transition: holding ? 'none' : 'transform 180ms ease-out',
        }}
        aria-hidden
      />
      {holding && progress > 0 && progress < 1 && (
        <span
          className="pointer-events-none absolute inset-y-0 w-8 bg-gradient-to-r from-transparent to-deep/25"
          style={{ left: `calc(${pct}% - 2rem)` }}
          aria-hidden
        />
      )}

      <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-deep/10 ring-2 ring-deep/20">
        <FiCheck className={`h-5 w-5 transition-transform duration-150 ${holding ? 'scale-110' : ''}`} />
      </span>

      <span className="relative z-10 min-w-0 flex-1">
        <span className="block font-display text-base font-semibold tracking-tight">
          {statusText}
        </span>
        <span className="mt-0.5 block text-xs text-paper/80">
          {hintText}
        </span>
      </span>

      <span
        className={`relative z-10 shrink-0 tabular-nums text-sm font-semibold tracking-tight transition-opacity ${
          holding ? 'opacity-100' : 'opacity-70'
        }`}
        aria-hidden
      >
        {holding ? `${pct}%` : 'Hold'}
      </span>
    </button>
  );
}

function ciphertextPreview(encryptedBallotData) {
  const raw =
    typeof encryptedBallotData?.encrypted_ballot === 'string'
      ? encryptedBallotData.encrypted_ballot
      : encryptedBallotData?.ballot_hash ||
        encryptedBallotData?.ballot_tracking_code ||
        '';
  const compact = String(raw).replace(/\s+/g, '');
  if (!compact) return 'α·β · ciphertext pending…';
  return compact.length > 64 ? `${compact.slice(0, 64)}…` : compact;
}

/**
 * Plaintext → ciphertext dissolve for the encryption step.
 * Reduced motion: static before/after cards with the same copy.
 */
function EncryptionMorph({ selectionLabels, encryptedBallotData, phase }) {
  const preferReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const ready = phase === 'actions' && !!encryptedBallotData;
  const cipher = ciphertextPreview(encryptedBallotData);
  const labels =
    selectionLabels?.length > 0 ? selectionLabels : ['Your selections'];

  if (preferReduced) {
    return (
      <div className="space-y-3" aria-live="polite">
        <div className="rounded-xl border border-ink/10 bg-frost p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dusk">
            Selections
          </p>
          <ul className="mt-2 space-y-1">
            {labels.map((label) => (
              <li key={label} className="font-display text-sm text-ink">
                {label}
              </li>
            ))}
          </ul>
        </div>
        {ready && (
          <div className="rounded-xl border border-aurora/30 bg-aurora/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora">
              Encrypted
            </p>
            <p className="crypto-mono mt-2 break-all text-xs leading-relaxed">{cipher}</p>
          </div>
        )}
        {!ready && (
          <p className="text-sm text-dusk">
            Your selections are being encrypted under the election public key by ElectionGuard…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-[7.5rem]" aria-live="polite">
      <div
        className={`rounded-xl border border-ink/10 bg-frost p-3 transition-opacity duration-700 ${
          ready ? 'pointer-events-none absolute inset-0 opacity-0' : 'opacity-100'
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dusk">
          Selections
        </p>
        <ul className="mt-2 space-y-1">
          {labels.map((label) => (
            <li
              key={label}
              className={`font-display text-sm text-ink ${
                phase === 'creating' ? 'animate-cipher-dissolve' : ''
              }`}
            >
              {label}
            </li>
          ))}
        </ul>
        {phase === 'creating' && (
          <p className="mt-3 text-xs text-dusk">
            Encrypting under the election public key via ElectionGuard…
          </p>
        )}
      </div>

      <div
        className={`rounded-xl border border-aurora/30 bg-aurora/5 p-3 ${
          ready ? 'animate-cipher-reveal' : 'opacity-0'
        }`}
      >
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora">
          <FiShield className="h-3.5 w-3.5" aria-hidden />
          Encrypted ballot
        </p>
        <p className="crypto-mono mt-2 break-all text-xs leading-relaxed">{cipher}</p>
      </div>
    </div>
  );
}

function BenalohLearnMore() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-xl border border-aurora/20 bg-aurora/5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium text-aurora"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        Learn more about the Benaloh challenge
        <FiChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div id={panelId} className="border-t border-aurora/15 px-3 py-2.5 text-xs leading-relaxed text-dusk">
          A challenge reveals the encryption randomness for this specific ballot so you can confirm
          the ciphertext matches your selections. That ballot is then spoiled (discarded) and cannot
          be cast — you encrypt again to vote for real. This is a cast-or-spoil proof: the system
          cannot both cheat and survive a challenge.
        </div>
      )}
    </div>
  );
}

/**
 * Single modal for the entire post-"Create Encrypted Ballot" workflow.
 * Phase: creating | create-error | actions | challenge-pick | challenging | challenge-result | casting | cast-success
 */
const BallotWorkflowModal = ({
  isOpen,
  phase,
  onClose,
  encryptedBallotData,
  voteResult,
  challengeResult,
  createBallotError,
  castBallotError,
  challengeError,
  electionData,
  selectedCandidates = [],
  challengeCandidateChoices,
  onChallengeCandidateToggle,
  onCastVote,
  onStartChallenge,
  onConfirmChallenge,
  onDiscard,
  onDownloadFile,
  onDownloadBallotInfo,
  onCopyToClipboard,
  onSaveVoteDetails,
}) => {
  if (!isOpen) return null;

  const isBusy = phase === 'creating' || phase === 'casting' || phase === 'challenging';
  const canDismiss = !isBusy;
  const maxChoices = electionData?.maxChoices || 1;

  const selectionLabels =
    electionData?.electionChoices
      ?.filter((c) => selectedCandidates.includes(String(c.choiceId)))
      .map((c) => c.optionTitle) || [];

  const handleBackdropClick = () => {
    if (canDismiss) onClose();
  };

  const handleCloseClick = () => {
    if (canDismiss) onClose();
  };

  const modalTitle = (() => {
    switch (phase) {
      case 'creating':
        return 'Encrypting ballot';
      case 'create-error':
        return 'Unable to create ballot';
      case 'actions':
        return 'Encrypted ballot ready';
      case 'challenge-pick':
        return 'Challenge this encryption';
      case 'challenging':
        return 'Verifying encryption';
      case 'challenge-result':
        return challengeResult?.match ? 'Challenge passed' : 'Challenge failed';
      case 'casting':
        return 'Casting ballot';
      case 'cast-success':
        return 'Ballot cast';
      default:
        return 'Ballot';
    }
  })();

  const statusAnnouncement = (() => {
    switch (phase) {
      case 'creating':
        return 'Encrypting your ballot under the election public key with ElectionGuard.';
      case 'actions':
        return 'Ballot encrypted. You may challenge this encryption to verify it, or cast it as your final vote.';
      case 'challenging':
        return 'Verifying encryption honesty. This ballot will be spoiled after the challenge.';
      case 'cast-success':
        return 'Ballot cast. Save your tracking code to verify inclusion later without revealing your choice.';
      default:
        return modalTitle;
    }
  })();

  return (
    <ModalOverlay onClose={handleBackdropClick} dismissible={canDismiss}>
      <ModalPanel size="md" className="p-4 sm:p-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <p id="ballot-workflow-status" className="sr-only" aria-live="polite">
          {statusAnnouncement}
        </p>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">
              ElectionGuard
            </p>
            <h3
              id="ballot-workflow-title"
              className="mt-1 font-display text-lg font-semibold text-ink sm:text-xl"
            >
              {modalTitle}
            </h3>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={handleCloseClick}
              className="shrink-0 rounded-xl p-1.5 text-dusk transition hover:bg-frost hover:text-ink"
              aria-label="Close"
            >
              <FiX className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
        </div>

        {/* Creating */}
        {phase === 'creating' && (
          <div className="space-y-5 py-2">
            <EncryptionMorph
              selectionLabels={selectionLabels}
              encryptedBallotData={null}
              phase={phase}
            />
            <div className="flex items-center justify-center gap-2 text-dusk">
              <FiLoader className="h-5 w-5 animate-spin text-aurora" aria-hidden />
              <p className="text-sm">{VOTER_STATUS_COPY.createBallotLoading}</p>
            </div>
          </div>
        )}

        {/* Create error */}
        {phase === 'create-error' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-ember/40 bg-ember/10 p-4 text-center">
              <FiAlertCircle className="mx-auto mb-3 h-10 w-10 text-ember" aria-hidden />
              <p className="text-sm text-ink">
                {createBallotError || VOTER_STATUS_COPY.unexpected}
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-ghost w-full">
              Close
            </button>
          </div>
        )}

        {/* Actions: cast / challenge / discard */}
        {phase === 'actions' && encryptedBallotData && (
          <div className="space-y-5">
            <EncryptionMorph
              selectionLabels={selectionLabels}
              encryptedBallotData={encryptedBallotData}
              phase={phase}
            />

            <p className="text-sm leading-relaxed text-dusk">
              Prove it&apos;s honest, then vote for real — or cast this ballot as your final vote.
              Challenge reveals encryption randomness for verification; that ballot is then spoiled
              and you encrypt again.
            </p>

            <BenalohLearnMore />

            <div className="rounded-xl border border-ink/10 bg-frost/80 p-3">
              <h4 className="mb-2 flex items-center text-sm font-semibold text-ink">
                <FiDownload className="mr-2 h-4 w-4 text-brand" aria-hidden />
                Cryptographic artifacts
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    onDownloadFile(
                      encryptedBallotData.encrypted_ballot,
                      'encrypted_ballot.txt',
                      'Encrypted Ballot'
                    )
                  }
                  className="flex items-center justify-center rounded-lg border border-aurora/25 bg-aurora/5 p-2 text-xs font-medium text-aurora hover:bg-aurora/10"
                >
                  <FiFileText className="mr-1.5 h-4 w-4" aria-hidden />
                  Ballot
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onDownloadFile(
                      encryptedBallotData.encrypted_ballot_with_nonce,
                      'encrypted_ballot_with_nonce.txt',
                      'Encrypted Ballot with Nonce'
                    )
                  }
                  className="flex items-center justify-center rounded-lg border border-ink/10 bg-frost p-2 text-xs font-medium text-ink hover:bg-glacier"
                >
                  <FiKey className="mr-1.5 h-4 w-4" aria-hidden />
                  With nonce
                </button>
                <button
                  type="button"
                  onClick={onDownloadBallotInfo}
                  className="flex items-center justify-center rounded-lg border border-ink/10 bg-frost p-2 text-xs font-medium text-dusk hover:bg-glacier"
                >
                  <FiInfo className="mr-1.5 h-4 w-4" aria-hidden />
                  Info
                </button>
              </div>
            </div>

            {castBallotError && (
              <div className="rounded-lg border border-ember/40 bg-ember/10 p-3 text-sm text-ink">
                {castBallotError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <HoldToConfirm onConfirm={onCastVote} label="Hold to cast this ballot" />
              <button
                type="button"
                onClick={onStartChallenge}
                className="flex items-center justify-center rounded-xl border border-aurora/40 bg-aurora/10 px-4 py-3 text-sm font-semibold text-aurora transition hover:bg-aurora/15"
              >
                <FiShield className="mr-2 h-4 w-4" aria-hidden />
                Challenge this encryption
              </button>
              <button
                type="button"
                onClick={onDiscard}
                className="btn-ghost w-full py-2.5"
              >
                <FiTrash2 className="h-4 w-4" aria-hidden />
                Discard ballot
              </button>
            </div>

            <p className="text-center text-xs text-dusk">
              {VOTER_STATUS_COPY.ballotActionsInfo}
            </p>
          </div>
        )}

        {/* Challenge candidate pick */}
        {phase === 'challenge-pick' && electionData?.electionChoices && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-dusk">
              Re-select the candidate(s) you chose using the checkbox on each row. The system opens
              this ballot&apos;s encryption randomness so you can confirm the ciphertext matches —
              then this ballot is spoiled.
            </p>

            <div className="max-h-60 space-y-2 overflow-y-auto">
              {electionData.electionChoices.map((choice) => {
                const idStr = choice.choiceId.toString();
                const isChecked = challengeCandidateChoices.includes(idStr);
                const isDisabled = !isChecked && challengeCandidateChoices.length >= maxChoices;
                return (
                  <div
                    key={choice.choiceId}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 transition-all ${
                      isDisabled
                        ? 'cursor-not-allowed border-ink/10 opacity-50'
                        : isChecked
                          ? 'border-brand-dark bg-brand/10 ring-1 ring-brand/40'
                          : 'border-ink/10 hover:border-brand/40'
                    }`}
                    onClick={() => !isDisabled && onChallengeCandidateToggle(idStr)}
                  >
                    <input
                      type={maxChoices > 1 ? 'checkbox' : 'radio'}
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => {}}
                      tabIndex={-1}
                      aria-hidden
                      className={`pointer-events-none ${maxChoices > 1 ? 'av-checkbox' : 'av-radio'}`}
                    />
                    <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                      <CandidateIdentity
                        name={choice.optionTitle}
                        image={choice.candidatePic}
                        description={choice.optionDescription}
                        partyName={choice.partyName}
                        size="md"
                        enableProfile
                        nameClassName="font-display text-sm font-medium text-ink"
                      />
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                        isChecked ? 'text-brand-dark' : 'text-dusk'
                      }`}
                    >
                      {isChecked ? 'Selected' : 'Tap to select'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-xs text-dusk">
              <strong className="text-brand-dark">Important:</strong> After challenging, this ballot
              cannot be cast. Challenge verifies honesty only — then encrypt again to vote for real.
            </div>

            <BenalohLearnMore />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1 py-2.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmChallenge}
                disabled={!challengeCandidateChoices.length}
                className={
                  challengeCandidateChoices.length
                    ? 'btn-brand flex-1'
                    : 'flex-1 cursor-not-allowed rounded-xl bg-frost py-2.5 text-sm font-semibold text-dusk'
                }
              >
                Challenge ballot
              </button>
            </div>
          </div>
        )}

        {/* Challenging */}
        {phase === 'challenging' && (
          <div className="space-y-4 py-6 text-center">
            <FiLoader className="mx-auto h-12 w-12 animate-spin text-aurora" aria-hidden />
            <p className="text-sm text-dusk">{VOTER_STATUS_COPY.challengeBallotLoading}</p>
          </div>
        )}

        {/* Challenge result */}
        {phase === 'challenge-result' && (
          <div className="space-y-4">
            {challengeError ? (
              <div className="rounded-lg border border-ember/40 bg-ember/10 p-4 text-center">
                <FiAlertCircle className="mx-auto mb-3 h-10 w-10 text-ember" aria-hidden />
                <p className="text-sm text-ink">{challengeError}</p>
              </div>
            ) : challengeResult ? (
              <div
                className={`rounded-lg border p-4 text-center ${
                  challengeResult.match
                    ? 'border-aurora/40 bg-aurora/10'
                    : 'border-ember/40 bg-ember/10'
                }`}
              >
                <div
                  className={`mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full ${
                    challengeResult.match ? 'bg-aurora/20' : 'bg-ember/20'
                  }`}
                >
                  {challengeResult.match ? (
                    <FiCheckCircle className="h-7 w-7 text-aurora" aria-hidden />
                  ) : (
                    <FiX className="h-7 w-7 text-ember" aria-hidden />
                  )}
                </div>
                <h4
                  className={`mb-2 font-display text-lg font-semibold ${
                    challengeResult.match ? 'text-aurora' : 'text-ember'
                  }`}
                >
                  {challengeResult.match
                    ? 'Encryption verified — ballot spoiled'
                    : 'Challenge verification failed'}
                </h4>
                <p className="text-sm text-dusk">{challengeResult.message}</p>
                {challengeResult.detailed_message && (
                  <div className="mt-3 rounded-lg border border-ink/10 bg-frost p-3 text-left text-sm text-dusk">
                    {challengeResult.detailed_message}
                  </div>
                )}
                {challengeResult.match && (
                  <p className="mt-3 text-xs text-dusk">
                    This ballot was discarded. Return to the booth and encrypt a new ballot to cast.
                  </p>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-ink/15 py-2.5 text-sm font-medium text-ink hover:bg-frost"
            >
              Return to voting booth
            </button>
          </div>
        )}

        {/* Casting */}
        {phase === 'casting' && (
          <div className="space-y-4">
            <div className="py-6 text-center">
              <FiLoader className="mx-auto mb-4 h-12 w-12 animate-spin text-brand" aria-hidden />
              <p className="text-sm text-dusk">{VOTER_STATUS_COPY.castBallotLoading}</p>
            </div>
            {castBallotError && (
              <div className="rounded-lg border border-ember/40 bg-ember/10 p-3 text-sm text-ink">
                {castBallotError}
              </div>
            )}
          </div>
        )}

        {/* Cast success / receipt */}
        {phase === 'cast-success' && voteResult && (
          <div className="space-y-5">
            <div className="text-center">
              <FiCheckCircle className="mx-auto mb-3 h-12 w-12 text-aurora" aria-hidden />
              <p className="text-sm leading-relaxed text-dusk">
                This code lets you confirm your encrypted ballot is included in the tally, without
                revealing your choice to anyone — including AmarVote.
              </p>
            </div>

            <div className="rounded-xl border border-aurora/25 bg-aurora/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora">
                Tracking code
              </p>
              <div className="mt-2 flex items-start gap-2">
                <p className="crypto-mono min-w-0 flex-1 break-all text-base leading-relaxed sm:text-lg">
                  {voteResult.trackingCode}
                </p>
                <button
                  type="button"
                  onClick={() => onCopyToClipboard(voteResult.trackingCode)}
                  className="shrink-0 rounded-lg p-2 text-aurora hover:bg-aurora/10"
                  aria-label="Copy tracking code"
                >
                  <FiCopy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-ink/10 bg-frost/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-xs font-medium text-dusk">Vote hash</span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-xs text-dusk">
                    {voteResult.hashCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopyToClipboard(voteResult.hashCode)}
                    className="shrink-0 text-brand hover:text-brand-light"
                    aria-label="Copy vote hash"
                  >
                    <FiCopy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onSaveVoteDetails('txt')}
                className="btn-brand flex flex-1 items-center justify-center gap-2 py-2.5"
              >
                <FiSave className="h-4 w-4" aria-hidden />
                Save TXT
              </button>
              <button
                type="button"
                onClick={() => onSaveVoteDetails('json')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ink/15 bg-frost px-4 py-2.5 text-sm font-semibold text-ink hover:bg-glacier"
              >
                <FiFileText className="h-4 w-4" aria-hidden />
                Save JSON
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-ghost w-full py-2.5"
            >
              Return to voting booth
            </button>
          </div>
        )}
        </div>
      </ModalPanel>
    </ModalOverlay>
  );
};

export default BallotWorkflowModal;
