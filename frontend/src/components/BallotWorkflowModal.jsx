import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-icons/fi';
import { VOTER_STATUS_COPY } from '../utils/voterMessages';

const HOLD_MS = 1800;
const RING_SIZE = 56;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function HoldToConfirm({ onConfirm, label = 'Hold to cast ballot', disabled = false }) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  const clear = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
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
      if (disabled || doneRef.current) return;
      event.preventDefault();
      startRef.current = performance.now();
      setHolding(true);
      rafRef.current = requestAnimationFrame(tick);
    },
    [disabled, tick]
  );

  useEffect(() => () => clear(), [clear]);

  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const statusText = holding
    ? progress > 0.85
      ? 'Almost there…'
      : 'Keep holding…'
    : label;

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={startHold}
      onMouseUp={clear}
      onMouseLeave={clear}
      onTouchStart={startHold}
      onTouchEnd={clear}
      onTouchCancel={clear}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') startHold(e);
      }}
      onKeyUp={clear}
      aria-label={label}
      aria-pressed={holding}
      className="group relative flex w-full select-none items-center gap-4 overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand to-brand-dark px-4 py-3.5 text-left text-white shadow-brand transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className="pointer-events-none absolute inset-0 bg-white/10 transition-opacity duration-300"
        style={{ opacity: holding ? 0.12 + progress * 0.2 : 0 }}
        aria-hidden
      />

      <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center">
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90" aria-hidden>
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={RING_STROKE}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="white"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-75 ease-linear"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <FiCheck className={`h-5 w-5 transition ${holding ? 'scale-110' : 'opacity-90'}`} />
        </span>
      </span>

      <span className="relative z-10 min-w-0 flex-1">
        <span className="block font-display text-base font-semibold tracking-tight">
          {statusText}
        </span>
        <span className="mt-0.5 block text-xs text-white/80">
          {holding
            ? 'Release to cancel · keep holding to cast'
            : 'Press and hold until the ring completes'}
        </span>
      </span>
    </button>
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

  const handleBackdropClick = () => {
    if (canDismiss) onClose();
  };

  const handleCloseClick = () => {
    if (canDismiss) onClose();
  };

  const maxChoices = electionData?.maxChoices || 1;

  const modalTitle = (() => {
    switch (phase) {
      case 'creating':
        return 'Creating Encrypted Ballot';
      case 'create-error':
        return 'Unable to Create Ballot';
      case 'actions':
        return 'Encrypted Ballot Ready';
      case 'challenge-pick':
        return 'Challenge Ballot Verification';
      case 'challenging':
        return 'Verifying Your Ballot';
      case 'challenge-result':
        return challengeResult?.match ? 'Challenge Passed' : 'Challenge Failed';
      case 'casting':
        return 'Casting Your Vote';
      case 'cast-success':
        return 'Vote Cast Successfully';
      default:
        return 'Ballot';
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-deep/55 backdrop-blur-[6px] p-0 sm:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ballot-workflow-title"
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/40 glass-panel bg-white/92 p-4 shadow-glass backdrop-blur-xl sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id="ballot-workflow-title" className="font-display text-base font-semibold text-deep sm:text-lg">
            {modalTitle}
          </h3>
          {canDismiss && (
            <button
              type="button"
              onClick={handleCloseClick}
              className="shrink-0 rounded-xl p-1.5 text-slate-400 hover:bg-frost hover:text-ink"
              aria-label="Close"
            >
              <FiX className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
        </div>

        {/* Creating */}
        {phase === 'creating' && (
          <div className="py-8 text-center">
            <FiLoader className="mx-auto mb-4 h-12 w-12 animate-spin text-brand" />
            <p className="text-sm text-slate-600">{VOTER_STATUS_COPY.createBallotLoading}</p>
          </div>
        )}

        {/* Create error */}
        {phase === 'create-error' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <FiAlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
              <p className="text-sm text-red-800">{createBallotError || VOTER_STATUS_COPY.unexpected}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost w-full"
            >
              Close
            </button>
          </div>
        )}

        {/* Actions: cast / challenge / discard */}
        {phase === 'actions' && encryptedBallotData && (
          <div className="space-y-5">
            <div className="text-center">
              <FiCheckCircle className="mx-auto mb-3 h-12 w-12 text-sage" />
              <p className="text-sm text-slate-600">
                Your vote has been encrypted. Cast your ballot, verify it with a challenge, or discard it and start over.
              </p>
            </div>

            <div className="rounded-xl border border-brand/20 bg-glacier/50 p-3">
              <h4 className="mb-2 flex items-center text-sm font-semibold text-ink">
                <FiDownload className="mr-2 h-4 w-4 text-brand" />
                Security Registry
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => onDownloadFile(encryptedBallotData.encrypted_ballot, 'encrypted_ballot.txt', 'Encrypted Ballot')}
                  className="flex items-center justify-center rounded-lg border border-brand/20 bg-white/80 p-2 text-xs font-medium text-brand-dark hover:bg-glacier"
                >
                  <FiFileText className="mr-1.5 h-4 w-4" />
                  Ballot
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadFile(encryptedBallotData.encrypted_ballot_with_nonce, 'encrypted_ballot_with_nonce.txt', 'Encrypted Ballot with Nonce')}
                  className="flex items-center justify-center rounded-lg border border-slate-200 bg-white/80 p-2 text-xs font-medium text-ink hover:bg-frost"
                >
                  <FiKey className="mr-1.5 h-4 w-4" />
                  With Nonce
                </button>
                <button
                  type="button"
                  onClick={onDownloadBallotInfo}
                  className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-slate-700 hover:bg-frost"
                >
                  <FiInfo className="mr-1.5 h-4 w-4" />
                  Info
                </button>
              </div>
            </div>

            {castBallotError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {castBallotError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <HoldToConfirm onConfirm={onCastVote} />
              <button
                type="button"
                onClick={onStartChallenge}
                className="flex items-center justify-center rounded-xl border border-amber-warn/30 bg-amber-soft px-4 py-3 text-sm font-medium text-amber-warn hover:bg-amber-100"
              >
                <FiShield className="mr-2 h-4 w-4" />
                Challenge Vote
              </button>
              <button
                type="button"
                onClick={onDiscard}
                className="btn-ghost w-full"
              >
                <FiTrash2 className="h-4 w-4" />
                Discard Ballot
              </button>
            </div>

            <p className="text-center text-xs text-slate-500">{VOTER_STATUS_COPY.ballotActionsInfo}</p>
          </div>
        )}

        {/* Challenge candidate pick */}
        {phase === 'challenge-pick' && electionData?.electionChoices && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Select the candidate(s) you voted for to verify against your encrypted ballot.
            </p>

            <div className="max-h-60 space-y-2 overflow-y-auto">
              {electionData.electionChoices.map((choice) => {
                const idStr = choice.choiceId.toString();
                const isChecked = challengeCandidateChoices.includes(idStr);
                const isDisabled = !isChecked && challengeCandidateChoices.length >= maxChoices;
                return (
                  <div
                    key={choice.choiceId}
                    className={`flex cursor-pointer items-center rounded-lg border-2 p-3 transition-all ${
                      isDisabled
                        ? 'cursor-not-allowed border-slate-200 opacity-50'
                        : isChecked
                          ? 'selected-ballot'
                          : 'border-slate-200 hover:border-brand/40'
                    }`}
                    onClick={() => !isDisabled && onChallengeCandidateToggle(idStr)}
                  >
                    <input
                      type={maxChoices > 1 ? 'checkbox' : 'radio'}
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => {}}
                      className="pointer-events-none mr-3"
                    />
                    <span className="text-sm font-medium text-deep">{choice.optionTitle}</span>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Important:</strong> After challenging, this ballot cannot be cast. Challenge is for verification only.
            </div>

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
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white ${
                  challengeCandidateChoices.length
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'cursor-not-allowed bg-slate-400'
                }`}
              >
                Challenge Ballot
              </button>
            </div>
          </div>
        )}

        {/* Challenging */}
        {phase === 'challenging' && (
          <div className="py-8 text-center">
            <FiLoader className="mx-auto mb-4 h-12 w-12 animate-spin text-orange-600" />
            <p className="text-sm text-slate-600">{VOTER_STATUS_COPY.challengeBallotLoading}</p>
          </div>
        )}

        {/* Challenge result */}
        {phase === 'challenge-result' && (
          <div className="space-y-4">
            {challengeError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <FiAlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
                <p className="text-sm text-red-800">{challengeError}</p>
              </div>
            ) : challengeResult ? (
              <div
                className={`rounded-lg border p-4 text-center ${
                  challengeResult.match ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div
                  className={`mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full ${
                    challengeResult.match ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  {challengeResult.match ? (
                    <FiCheckCircle className="h-7 w-7 text-green-600" />
                  ) : (
                    <FiX className="h-7 w-7 text-red-600" />
                  )}
                </div>
                <h4
                  className={`mb-2 text-lg font-semibold ${
                    challengeResult.match ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {challengeResult.match ? 'Challenge Verification Passed' : 'Challenge Verification Failed'}
                </h4>
                <p className={`text-sm ${challengeResult.match ? 'text-green-600' : 'text-red-600'}`}>
                  {challengeResult.message}
                </p>
                {challengeResult.detailed_message && (
                  <div className="mt-3 rounded-lg border bg-white p-3 text-left text-sm text-slate-600">
                    {challengeResult.detailed_message}
                  </div>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="btn-ghost w-full py-2.5"
            >
              Return to Voting Booth
            </button>
          </div>
        )}

        {/* Casting */}
        {phase === 'casting' && (
          <div className="space-y-4">
            <div className="py-6 text-center">
            <FiLoader className="mx-auto mb-4 h-12 w-12 animate-spin text-brand" />
            <p className="text-sm text-slate-600">{VOTER_STATUS_COPY.castBallotLoading}</p>
            </div>
            {castBallotError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {castBallotError}
              </div>
            )}
          </div>
        )}

        {/* Cast success */}
        {phase === 'cast-success' && voteResult && (
          <div className="space-y-4">
            <div className="text-center">
              <FiCheckCircle className="mx-auto mb-3 h-12 w-12 text-brand" />
              <p className="text-sm text-ink">
                Your vote has been securely recorded. Save your tracking code and hash below.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-brand/15 bg-glacier/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white p-2">
                <span className="shrink-0 font-medium">Vote Hash:</span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-xs">{voteResult.hashCode}</span>
                  <button
                    type="button"
                    onClick={() => onCopyToClipboard(voteResult.hashCode)}
                    className="shrink-0 text-brand hover:text-brand-dark"
                  >
                    <FiCopy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white p-2">
                <span className="shrink-0 font-medium">Tracking Code:</span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-xs">{voteResult.trackingCode}</span>
                  <button
                    type="button"
                    onClick={() => onCopyToClipboard(voteResult.trackingCode)}
                    className="shrink-0 text-brand hover:text-brand-dark"
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
                <FiSave className="h-4 w-4" />
                Save TXT
              </button>
              <button
                type="button"
                onClick={() => onSaveVoteDetails('json')}
                className="btn-deep flex flex-1 items-center justify-center gap-2 py-2.5"
              >
                <FiFileText className="h-4 w-4" />
                Save JSON
              </button>
            </div>

            <div className="rounded-xl bg-glacier p-3 text-xs text-ink">
              <p className="font-medium">Important:</p>
              <p>Keep your vote hash and tracking code to verify your vote when results are published.</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-ghost w-full"
            >
              Return to Voting Booth
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BallotWorkflowModal;
