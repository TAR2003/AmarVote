import React, { useState } from 'react';
import {
  FiHash,
  FiInfo,
  FiFileText,
  FiLoader,
  FiCheck,
  FiAlertCircle,
  FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { electionApi } from '../utils/electionApi';

/**
 * Forensic, quiet verification lookup — paste or upload tracking code + hash.
 */
export default function VerifyVoteSection({ electionId }) {
  const [verificationFile, setVerificationFile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyingVote, setVerifyingVote] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [manualInput, setManualInput] = useState({ tracking_code: '', hash_code: '' });
  const [inputMethod, setInputMethod] = useState('file');

  const handleFileUpload = (file) => {
    if (file && (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.json'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;

          try {
            const jsonData = JSON.parse(content);
            if (jsonData.tracking_code && jsonData.hash_code) {
              setVerificationFile(jsonData);
              verifyVoteData(jsonData);
              return;
            }
            if (jsonData.trackingCode && jsonData.hashCode) {
              const normalized = {
                tracking_code: jsonData.trackingCode,
                hash_code: jsonData.hashCode,
              };
              setVerificationFile(normalized);
              verifyVoteData(normalized);
              return;
            }
            if (jsonData.ballot_id && (jsonData.initial_hash || jsonData.hash || jsonData.hash_code)) {
              const data = {
                tracking_code: jsonData.ballot_id,
                hash_code: jsonData.initial_hash || jsonData.hash || jsonData.hash_code,
              };
              setVerificationFile(data);
              verifyVoteData(data);
              return;
            }
          } catch {
            /* not JSON */
          }

          const voteHashMatch =
            content.match(/Vote Hash:\s*([a-f0-9]+)/i) ||
            content.match(/Hash:\s*([a-f0-9]+)/i) ||
            content.match(/Hash Code:\s*([a-f0-9]+)/i);

          const trackingCodeMatch =
            content.match(/Tracking Code:\s*([a-f0-9]+)/i) ||
            content.match(/Ballot ID:\s*([a-f0-9]+)/i) ||
            content.match(/Ballot Tracking ID:\s*([a-f0-9]+)/i);

          if (voteHashMatch && trackingCodeMatch) {
            const data = {
              tracking_code: trackingCodeMatch[1],
              hash_code: voteHashMatch[1],
            };
            setVerificationFile(data);
            verifyVoteData(data);
          } else {
            toast.error('File must contain both a hash code and tracking code');
          }
        } catch (error) {
          toast.error('Failed to read vote receipt file: ' + error.message);
        }
      };
      reader.readAsText(file);
    } else {
      toast.error('Please upload a valid TXT or JSON vote receipt file');
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleManualVerification = () => {
    if (!manualInput.tracking_code.trim() || !manualInput.hash_code.trim()) {
      toast.error('Please enter both tracking code and hash code');
      return;
    }

    const data = {
      tracking_code: manualInput.tracking_code.trim(),
      hash_code: manualInput.hash_code.trim(),
    };

    setVerificationFile(data);
    verifyVoteData(data);
  };

  const verifyVoteData = async (data) => {
    try {
      setVerifyingVote(true);
      setVerificationResult(null);

      const result = await electionApi.verifyVote(electionId, data);
      if (result?.status) {
        setVerificationResult(result);
        return;
      }

      setVerificationResult({
        status: 'error',
        message: result?.message || 'Unexpected verification response',
        found_ballot: false,
      });
    } catch (error) {
      setVerificationResult({
        status: 'error',
        message: 'Failed to verify vote: ' + error.message,
        found_ballot: false,
      });
    } finally {
      setVerifyingVote(false);
    }
  };

  const getVerificationStatusDisplay = () => {
    if (!verificationResult) return null;
    const { status, message } = verificationResult;

    switch (status) {
      case 'verified':
        return {
          icon: FiCheck,
          tone: 'aurora',
          title: 'Ballot included in the tally',
          description:
            'Your tracking code and hash match a ballot in the published tally. Your choice remains secret — including from AmarVote.',
        };
      case 'corrupted':
        return {
          icon: FiAlertCircle,
          tone: 'brand',
          title: 'Tracking code found — hash mismatch',
          description:
            'The tracking code appears in the tally, but the hash does not match. This may indicate tampering or a receipt error.',
        };
      case 'not_found':
        return {
          icon: FiX,
          tone: 'ember',
          title: 'Tracking code not found',
          description:
            'This tracking code was not found in the final tally. The ballot may not have been cast or counted.',
        };
      case 'error':
        return {
          icon: FiAlertCircle,
          tone: 'ember',
          title: 'Verification error',
          description: message || 'Verification could not be completed.',
        };
      default:
        return null;
    }
  };

  const statusDisplay = getVerificationStatusDisplay();
  const Icon = statusDisplay?.icon;

  const toneBox = {
    aurora: 'border-aurora/35 bg-aurora/10',
    brand: 'border-brand/35 bg-brand/10',
    ember: 'border-ember/40 bg-ember/10',
  };
  const toneText = {
    aurora: 'text-aurora',
    brand: 'text-brand',
    ember: 'text-ember',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-aurora">
            Public verification
          </p>
          <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-deep sm:text-xl">
            <FiHash className="h-5 w-5 text-aurora" aria-hidden />
            Confirm your ballot was counted
          </h3>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setInputMethod('file')}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${
              inputMethod === 'file'
                ? 'bg-brand text-deep shadow-brand'
                : 'bg-frost text-dusk hover:bg-glacier'
            }`}
          >
            Upload receipt
          </button>
          <button
            type="button"
            onClick={() => setInputMethod('manual')}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${
              inputMethod === 'manual'
                ? 'bg-brand text-deep shadow-brand'
                : 'bg-frost text-dusk hover:bg-glacier'
            }`}
          >
            Paste codes
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-aurora/20 bg-aurora/5 p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-aurora" aria-hidden />
          <p className="text-sm leading-relaxed text-ink">
            This code lets you confirm your encrypted ballot is included in the tally, without
            revealing your choice to anyone — including AmarVote. You need your tracking code and
            vote hash from your receipt.
          </p>
        </div>
      </div>

      {inputMethod === 'file' ? (
        <div
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-8 ${
            dragOver
              ? 'border-aurora bg-aurora/5'
              : 'border-ink/10 hover:border-aurora/40'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
        >
          <input
            type="file"
            accept=".txt,.json"
            onChange={handleFileSelect}
            className="hidden"
            id="verification-file"
          />
          <label htmlFor="verification-file" className="cursor-pointer">
            <FiFileText className="mx-auto mb-3 h-10 w-10 text-dusk sm:h-12 sm:w-12" aria-hidden />
            <p className="font-display text-base font-semibold text-deep sm:text-lg">
              Upload your vote receipt
            </p>
            <p className="mt-1 text-xs text-dusk sm:text-sm">
              .txt or .json — drag and drop, or browse
            </p>
            <span className="btn-brand mt-4 inline-flex">Choose file</span>
          </label>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink/10 bg-paper p-4 sm:p-6">
          <h4 className="mb-4 font-display text-sm font-semibold text-deep">Enter verification details</h4>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dusk">
                Tracking code
              </label>
              <input
                type="text"
                value={manualInput.tracking_code}
                onChange={(e) =>
                  setManualInput((prev) => ({ ...prev, tracking_code: e.target.value }))
                }
                className="input-field crypto-mono !text-aurora"
                placeholder="Paste tracking code…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dusk">
                Vote hash
              </label>
              <input
                type="text"
                value={manualInput.hash_code}
                onChange={(e) =>
                  setManualInput((prev) => ({ ...prev, hash_code: e.target.value }))
                }
                className="input-field font-mono text-sm"
                placeholder="Paste vote hash…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={handleManualVerification}
              disabled={
                verifyingVote ||
                !manualInput.tracking_code.trim() ||
                !manualInput.hash_code.trim()
              }
              className="btn-brand w-full"
            >
              {verifyingVote ? 'Verifying…' : 'Verify inclusion'}
            </button>
          </div>
        </div>
      )}

      {verifyingVote && (
        <div
          className="flex items-center gap-2 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm text-ink"
          aria-live="polite"
        >
          <FiLoader className="h-5 w-5 animate-spin text-aurora" aria-hidden />
          Checking the published tally…
        </div>
      )}

      {statusDisplay && (
        <div
          className={`rounded-2xl border p-5 sm:p-6 ${toneBox[statusDisplay.tone]}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {Icon && (
              <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${toneText[statusDisplay.tone]}`} aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <h4 className={`font-display text-base font-semibold ${toneText[statusDisplay.tone]}`}>
                {statusDisplay.title}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-ink">{statusDisplay.description}</p>

              {verificationFile && (
                <div className="mt-4 space-y-2 rounded-xl border border-ink/10 bg-paper/90 p-4 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dusk">
                      Tracking code
                    </p>
                    <p className="crypto-mono mt-1 break-all text-sm">{verificationFile.tracking_code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dusk">
                      Vote hash
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-dusk">
                      {verificationFile.hash_code}
                    </p>
                  </div>
                  {verificationResult.found_ballot && (
                    <p className="text-sm font-medium text-aurora">Found in tally: yes</p>
                  )}
                  {verificationResult.expected_hash && verificationResult.provided_hash && (
                    <div className="border-t border-ink/10 pt-2 font-mono text-xs text-ember">
                      <div>Expected: {verificationResult.expected_hash}</div>
                      <div>Provided: {verificationResult.provided_hash}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-ink/10 bg-frost/80 p-4 text-sm text-dusk">
        <p className="font-display font-semibold text-deep">Result meanings</p>
        <ul className="mt-2 space-y-2">
          <li className="flex gap-2">
            <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-aurora" aria-hidden />
            <span>
              <strong className="text-deep">Included:</strong> tracking code and hash match the
              published tally.
            </span>
          </li>
          <li className="flex gap-2">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span>
              <strong className="text-deep">Hash mismatch:</strong> code found, hash does not match.
            </span>
          </li>
          <li className="flex gap-2">
            <FiX className="mt-0.5 h-4 w-4 shrink-0 text-ember" aria-hidden />
            <span>
              <strong className="text-deep">Not found:</strong> tracking code absent from the tally.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}