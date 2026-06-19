import React from 'react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ballot-workflow-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id="ballot-workflow-title" className="text-base font-semibold text-gray-900 sm:text-lg">
            {modalTitle}
          </h3>
          {canDismiss && (
            <button
              type="button"
              onClick={handleCloseClick}
              className="shrink-0 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <FiX className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
        </div>

        {/* Creating */}
        {phase === 'creating' && (
          <div className="py-8 text-center">
            <FiLoader className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">{VOTER_STATUS_COPY.createBallotLoading}</p>
          </div>
        )}

        {/* Create error */}
        {phase === 'create-error' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <FiAlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
              <p className="text-sm text-red-800">{createBallotError || VOTER_STATUS_COPY.unexpected}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-gray-200 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        )}

        {/* Actions: cast / challenge / discard */}
        {phase === 'actions' && encryptedBallotData && (
          <div className="space-y-5">
            <div className="text-center">
              <FiCheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" />
              <p className="text-sm text-gray-600">
                Your vote has been encrypted. Cast your ballot, verify it with a challenge, or discard it and start over.
              </p>
            </div>

            <div className="rounded-lg border bg-gray-50 p-3">
              <h4 className="mb-2 flex items-center text-sm font-semibold text-gray-700">
                <FiDownload className="mr-2 h-4 w-4" />
                Download Ballot Files
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => onDownloadFile(encryptedBallotData.encrypted_ballot, 'encrypted_ballot.txt', 'Encrypted Ballot')}
                  className="flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <FiFileText className="mr-1.5 h-4 w-4" />
                  Ballot
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadFile(encryptedBallotData.encrypted_ballot_with_nonce, 'encrypted_ballot_with_nonce.txt', 'Encrypted Ballot with Nonce')}
                  className="flex items-center justify-center rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs font-medium text-purple-700 hover:bg-purple-100"
                >
                  <FiKey className="mr-1.5 h-4 w-4" />
                  With Nonce
                </button>
                <button
                  type="button"
                  onClick={onDownloadBallotInfo}
                  className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
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
              <button
                type="button"
                onClick={onCastVote}
                className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FiCheck className="mr-2 h-4 w-4" />
                Cast Vote
              </button>
              <button
                type="button"
                onClick={onStartChallenge}
                className="flex items-center justify-center rounded-lg bg-orange-600 px-4 py-3 text-sm font-medium text-white hover:bg-orange-700"
              >
                <FiShield className="mr-2 h-4 w-4" />
                Challenge Vote
              </button>
              <button
                type="button"
                onClick={onDiscard}
                className="flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FiTrash2 className="mr-2 h-4 w-4" />
                Discard Ballot
              </button>
            </div>

            <p className="text-center text-xs text-gray-500">{VOTER_STATUS_COPY.ballotActionsInfo}</p>
          </div>
        )}

        {/* Challenge candidate pick */}
        {phase === 'challenge-pick' && electionData?.electionChoices && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
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
                        ? 'cursor-not-allowed border-gray-100 opacity-50'
                        : isChecked
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
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
                    <span className="text-sm font-medium text-gray-900">{choice.optionTitle}</span>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
              <strong>Important:</strong> After challenging, this ballot cannot be cast. Challenge is for verification only.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg bg-gray-200 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmChallenge}
                disabled={!challengeCandidateChoices.length}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white ${
                  challengeCandidateChoices.length
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'cursor-not-allowed bg-gray-400'
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
            <p className="text-sm text-gray-600">{VOTER_STATUS_COPY.challengeBallotLoading}</p>
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
                  <div className="mt-3 rounded-lg border bg-white p-3 text-left text-sm text-gray-600">
                    {challengeResult.detailed_message}
                  </div>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-gray-200 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
            >
              Return to Voting Booth
            </button>
          </div>
        )}

        {/* Casting */}
        {phase === 'casting' && (
          <div className="space-y-4">
            <div className="py-6 text-center">
              <FiLoader className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">{VOTER_STATUS_COPY.castBallotLoading}</p>
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
              <FiCheckCircle className="mx-auto mb-3 h-12 w-12 text-blue-500" />
              <p className="text-sm text-blue-800">
                Your vote has been securely recorded. Save your tracking code and hash below.
              </p>
            </div>

            <div className="space-y-3 rounded-lg bg-gray-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-2 rounded bg-white p-2">
                <span className="shrink-0 font-medium">Vote Hash:</span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-xs">{voteResult.hashCode}</span>
                  <button
                    type="button"
                    onClick={() => onCopyToClipboard(voteResult.hashCode)}
                    className="shrink-0 text-blue-600 hover:text-blue-800"
                  >
                    <FiCopy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded bg-white p-2">
                <span className="shrink-0 font-medium">Tracking Code:</span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-xs">{voteResult.trackingCode}</span>
                  <button
                    type="button"
                    onClick={() => onCopyToClipboard(voteResult.trackingCode)}
                    className="shrink-0 text-blue-600 hover:text-blue-800"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FiSave className="h-4 w-4" />
                Save TXT
              </button>
              <button
                type="button"
                onClick={() => onSaveVoteDetails('json')}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-600 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                <FiFileText className="h-4 w-4" />
                Save JSON
              </button>
            </div>

            <div className="rounded-lg bg-blue-100 p-3 text-xs text-blue-700">
              <p className="font-medium">Important:</p>
              <p>Keep your vote hash and tracking code to verify your vote when results are published.</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-gray-200 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
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
