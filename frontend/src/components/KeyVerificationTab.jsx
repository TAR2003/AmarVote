import React, { useState } from 'react';
import { FiKey, FiCheckCircle, FiAlertCircle, FiLoader, FiShield, FiLock } from 'react-icons/fi';
import { electionApi } from '../utils/electionApi';

function getVerificationErrorMessage(error) {
  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }
  return 'Verification could not be completed. Please try again.';
}

export default function KeyVerificationTab({ electionId, electionData }) {
  const [credentialContent, setCredentialContent] = useState('');
  const [credentialFileName, setCredentialFileName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const currentGuardian = electionData?.guardians?.find((g) => g.isCurrentUser);
  const keyRegistered = Boolean(currentGuardian?.guardianKeySubmitted);

  const handleFileLoad = async (file) => {
    if (!file) return;
    setError('');
    setResult(null);

    try {
      const content = await file.text();
      setCredentialContent(content.trim());
      setCredentialFileName(file.name);
    } catch (e) {
      setError(e.message || 'Failed to read credential file');
    }
  };

  const handleVerify = async () => {
    if (!credentialContent.trim()) {
      setError('Upload your credentials.txt file first');
      return;
    }

    setVerifying(true);
    setError('');
    setResult(null);

    try {
      const response = await electionApi.verifyGuardianKey(electionId, credentialContent.trim());
      if (response?.success === false) {
        setError(response.message || 'Verification could not be completed. Please try again.');
        return;
      }
      setResult(response);
    } catch (e) {
      setError(getVerificationErrorMessage(e));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel border-brand/20 bg-gradient-to-br from-glacier/70 via-white to-frost p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-glacier p-2">
            <FiShield className="h-5 w-5 text-ink" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-deep">Private Key Verification</h4>
            <p className="text-sm text-ink mt-1">
              Confirm that your downloaded credential file matches the public key stored for this election.
              This check is private — only you see the result, and nothing is saved.
            </p>
          </div>
        </div>
      </div>

      {!keyRegistered ? (
        <div className="rounded-xl border border-ceremonial/40 bg-ceremonial-soft p-4 text-sm text-ink">
          Your guardian key has not been registered yet. Complete the key ceremony first, then return here to verify your credentials.
        </div>
      ) : (
        <div className="surface-card space-y-5 p-5 sm:p-6">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Upload credentials.txt
            </label>
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(e) => handleFileLoad(e.target.files?.[0])}
              className="block w-full text-sm text-dusk file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-glacier file:text-ink hover:file:bg-glacier"
            />
            {credentialFileName && (
              <p className="mt-2 text-xs text-sage">Loaded file: {credentialFileName}</p>
            )}
          </div>

          <div className="rounded-lg border border-ink/10 bg-frost/80 p-4 text-sm text-dusk space-y-2">
            <p className="flex items-center gap-2">
              <FiLock className="h-4 w-4 text-dusk" />
              Your file is used only for this one-time check and is not stored.
            </p>
            <p>
              If verification fails, contact the election administrator privately before voting begins.
              Catching a mismatch early is far better than discovering it during decryption.
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || !credentialContent.trim()}
            className="btn-brand"
          >
            {verifying ? (
              <>
                <FiLoader className="h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <FiKey className="h-4 w-4" />
                Verify My Key
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-ember/30 bg-ember-soft p-4 flex items-start gap-3">
          <FiAlertCircle className="h-5 w-5 text-ember flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ember">{error}</p>
        </div>
      )}

      {result && (
        <div
          className={`rounded-xl border p-4 flex items-start gap-3 ${
            result.verified
              ? 'border-aurora/30 bg-sage-soft'
              : 'border-ember/40 bg-ember-soft'
          }`}
        >
          {result.verified ? (
            <FiCheckCircle className="h-5 w-5 text-aurora-muted flex-shrink-0 mt-0.5" />
          ) : (
            <FiAlertCircle className="h-5 w-5 text-ember flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-semibold ${result.verified ? 'text-emerald-900' : 'text-red-900'}`}>
              {result.verified ? 'Verification passed' : 'Verification failed'}
            </p>
            <p className={`text-sm mt-1 whitespace-pre-wrap ${result.verified ? 'text-aurora-muted' : 'text-ember'}`}>
              {result.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
