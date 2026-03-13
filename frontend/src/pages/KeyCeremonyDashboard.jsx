import React, { useEffect, useMemo, useState } from 'react';
import { FiKey, FiClock, FiCheckCircle } from 'react-icons/fi';
import { electionApi } from '../utils/electionApi';

const triggerAutoCredentialDownload = ({ electionId, encryptedCredential }) => {
  const blob = new Blob([String(encryptedCredential || '').trim()], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credentials-election-${electionId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function KeyCeremonyDashboard() {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [allElections, setAllElections] = useState([]);
  const [guardianForm, setGuardianForm] = useState({});
  const [adminStatus, setAdminStatus] = useState({});
  const [activationForm, setActivationForm] = useState({});
  const [backupForm, setBackupForm] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingResp, elections] = await Promise.all([
        electionApi.getPendingKeyCeremonies(),
        electionApi.getAllElections(),
      ]);

      setPending(pendingResp?.elections || []);
      setAllElections(elections || []);

      const adminPending = (elections || []).filter(
        (e) => e.userRoles?.includes('admin') && e.status === 'key_ceremony_pending'
      );

      const statusEntries = await Promise.all(
        adminPending.map(async (e) => {
          try {
            const s = await electionApi.getAdminKeyCeremonyStatus(e.electionId);
            return [e.electionId, s?.status || null];
          } catch {
            return [e.electionId, null];
          }
        })
      );

      setAdminStatus(Object.fromEntries(statusEntries));
    } catch (e) {
      setError(e.message || 'Failed to load key ceremony dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const adminPendingElections = useMemo(
    () => allElections.filter((e) => e.userRoles?.includes('admin') && e.status === 'key_ceremony_pending'),
    [allElections]
  );

  const generateLocalPassword = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}';
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  };

  const handleGenerateLocalPassword = (electionId) => {
    const generated = generateLocalPassword();
    setGuardianForm((prev) => ({
      ...prev,
      [electionId]: {
        ...(prev[electionId] || {}),
        localEncryptionPassword: generated,
      },
    }));
    setMessage('Local AES-256 password generated in browser. It will be sent to backend for ML-KEM protected credential storage.');
  };

  const handleGuardianSubmit = async (electionId) => {
    setError('');
    setMessage('');
    const data = guardianForm[electionId] || {};

    if (!data.publicKey) {
      setError('Guardian public key is required');
      return;
    }

    if (!data.privateKey || !String(data.privateKey).trim()) {
      setError('Guardian private key is required');
      return;
    }

    if (!data.polynomial || !String(data.polynomial).trim()) {
      setError('Guardian polynomial is required');
      return;
    }

    if (!data.localEncryptionPassword || !String(data.localEncryptionPassword).trim()) {
      setError('Local encryption password is required');
      return;
    }

    try {
      const response = await electionApi.submitGuardianKeyCeremony(
        electionId,
        data.privateKey,
        data.publicKey,
        data.polynomial,
        data.localEncryptionPassword,
        data.keyBackup
      );

      if (response?.encryptedCredential) {
        triggerAutoCredentialDownload({
          electionId,
          encryptedCredential: response.encryptedCredential,
        });
      }

      setMessage('Guardian key submitted successfully. Credentials were encrypted using your local password and credentials.txt was downloaded automatically.');
      await loadData();
    } catch (e) {
      setError(e.message || 'Failed to submit guardian key');
    }
  };

  const handleGenerateBackupShares = async (item) => {
    setError('');
    setMessage('');

    try {
      const credentialContent = backupForm[item.electionId]?.credentialContent;
      if (!credentialContent || !credentialContent.trim()) {
        throw new Error('Upload your local credentials.txt file first');
      }

      const generated = await electionApi.generateGuardianBackupShares(item.electionId, credentialContent.trim());

      setBackupForm((prev) => ({
        ...prev,
        [item.electionId]: {
          ...(prev[item.electionId] || {}),
          generatedGuardianData: JSON.stringify(generated?.guardianData || {}, null, 2),
        },
      }));

      setMessage(`Encrypted backup shares generated for ${generated?.backupCount || 0} guardian(s).`);
    } catch (e) {
      setError(e.message || 'Failed to generate backup shares');
    }
  };

  const handleCredentialFileLoad = async (electionId, file) => {
    if (!file) return;
    setError('');
    setMessage('');

    try {
      const content = await file.text();
      setBackupForm((prev) => ({
        ...prev,
        [electionId]: {
          ...(prev[electionId] || {}),
          credentialContent: content,
          credentialFileName: file.name,
        },
      }));
      setMessage('Credential file loaded. It will be sent to backend only when generating Round 2 backup shares.');
    } catch (e) {
      setError(e.message || 'Failed to read credential file');
    }
  };

  const handleSubmitBackupShares = async (electionId) => {
    setError('');
    setMessage('');

    try {
      const guardianKeyBackup = backupForm[electionId]?.generatedGuardianData;
      if (!guardianKeyBackup || !guardianKeyBackup.trim()) {
        throw new Error('Generate backup shares first');
      }

      await electionApi.submitGuardianBackupShares(electionId, guardianKeyBackup);
      setMessage('Encrypted backup shares submitted successfully.');
      await loadData();
    } catch (e) {
      setError(e.message || 'Failed to submit backup shares');
    }
  };

  const handleGenerateCredentials = async (item) => {
    setError('');
    setMessage('');
    try {
      const generated = await electionApi.generateGuardianKeyCeremonyCredentials(item.electionId);

      setGuardianForm((prev) => ({
        ...prev,
        [item.electionId]: {
          ...(prev[item.electionId] || {}),
          privateKey: generated?.guardianPrivateKey || '',
          publicKey: generated?.guardianPublicKey || '',
          polynomial: generated?.guardianPolynomial || '',
          keyBackup: generated?.guardianKeyBackup || '',
        },
      }));

      setMessage('ElectionGuard-compatible credentials generated. Submit Round 1 to download credentials.txt.');
    } catch (e) {
      setError(e.message || 'Failed to generate credentials');
    }
  };

  const handleActivate = async (electionId) => {
    setError('');
    setMessage('');
    const data = activationForm[electionId] || {};
    if (!data.startingTime || !data.endingTime) {
      setError('Start and end times are required for activation');
      return;
    }

    try {
      await electionApi.activateElectionAfterCeremony(
        electionId,
        new Date(data.startingTime).toISOString(),
        new Date(data.endingTime).toISOString()
      );
      setMessage('Election activated successfully');
      await loadData();
    } catch (e) {
      setError(e.message || 'Failed to activate election');
    }
  };

  if (loading) {
    return <div className="p-6">Loading key ceremony dashboard...</div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FiKey /> Key Ceremony Dashboard
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Keep private key and polynomial on-device. Submit public key and your local AES password to backend.
        </p>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">{error}</div>}

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">Guardian Key Ceremony Tasks</h3>
        {pending.length === 0 ? (
          <p className="text-gray-600 text-sm">No pending key ceremony tasks.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((item) => (
              <div key={item.electionId} className="border rounded p-3">
                <div className="font-medium">{item.electionTitle}</div>
                <div className="text-sm text-gray-600 mb-2">
                  Round 1 (keypairs): {item.submittedGuardians}/{item.numberOfGuardians}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  Round 2 (backup sharing): {item.submittedBackupGuardians || 0}/{item.numberOfGuardians}
                </div>

                {item.currentRound === 'keypair_generation' && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        onClick={() => handleGenerateCredentials(item)}
                        className="px-3 py-2 bg-indigo-600 text-white rounded"
                      >
                        Generate Credentials
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <textarea
                        className="border rounded px-3 py-2 min-h-28"
                        placeholder="Private key (kept locally, do not submit)"
                        value={guardianForm[item.electionId]?.privateKey || ''}
                        onChange={(e) =>
                          setGuardianForm((prev) => ({
                            ...prev,
                            [item.electionId]: {
                              ...(prev[item.electionId] || {}),
                              privateKey: e.target.value,
                            },
                          }))
                        }
                      />

                      <textarea
                        className="border rounded px-3 py-2 min-h-28"
                        placeholder="Public key JSON (ElectionGuard-compatible)"
                        value={guardianForm[item.electionId]?.publicKey || ''}
                        onChange={(e) =>
                          setGuardianForm((prev) => ({
                            ...prev,
                            [item.electionId]: {
                              ...(prev[item.electionId] || {}),
                              publicKey: e.target.value,
                            },
                          }))
                        }
                      />

                      <textarea
                        className="border rounded px-3 py-2 min-h-28"
                        placeholder="Polynomial (kept locally, do not submit)"
                        value={guardianForm[item.electionId]?.polynomial || ''}
                        onChange={(e) =>
                          setGuardianForm((prev) => ({
                            ...prev,
                            [item.electionId]: {
                              ...(prev[item.electionId] || {}),
                              polynomial: e.target.value,
                            },
                          }))
                        }
                      />

                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                      <input
                        type="text"
                        className="border rounded px-3 py-2"
                        placeholder="Local AES-256 password (allowed to send to backend)"
                        value={guardianForm[item.electionId]?.localEncryptionPassword || ''}
                        onChange={(e) =>
                          setGuardianForm((prev) => ({
                            ...prev,
                            [item.electionId]: {
                              ...(prev[item.electionId] || {}),
                              localEncryptionPassword: e.target.value,
                            },
                          }))
                        }
                      />
                      <button
                        onClick={() => handleGenerateLocalPassword(item.electionId)}
                        className="px-3 py-2 bg-slate-700 text-white rounded"
                      >
                        Generate Random AES-256 Password
                      </button>
                    </div>
                    <button
                      onClick={() => handleGuardianSubmit(item.electionId)}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded"
                    >
                      Submit Key Ceremony Data (Round 1)
                    </button>
                  </>
                )}

                {item.currentRound === 'waiting_for_all_keypairs' && (
                  <div className="mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                    Your keypair is submitted. Waiting for all guardians to complete Round 1 before backup sharing starts.
                  </div>
                )}

                {item.currentRound === 'backup_key_sharing' && (
                  <div className="mt-3 space-y-3">
                    <div className="text-sm font-medium">Round 2: Backup Key Sharing</div>

                    <input
                      type="file"
                      accept=".json,.txt"
                      className="border rounded px-3 py-2 w-full"
                      onChange={(e) => handleCredentialFileLoad(item.electionId, e.target.files?.[0])}
                    />

                    <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                      Frontend never calls ElectionGuard microservice directly. Uploaded credentials.txt is sent to backend only for Round 2 backup generation.
                    </div>

                    {backupForm[item.electionId]?.credentialFileName && (
                      <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                        Loaded: {backupForm[item.electionId]?.credentialFileName}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleGenerateBackupShares(item)}
                        className="px-3 py-2 bg-orange-600 text-white rounded"
                      >
                        Generate Backup Key Shares
                      </button>
                      <button
                        onClick={() => handleSubmitBackupShares(item.electionId)}
                        className="px-3 py-2 bg-emerald-600 text-white rounded"
                      >
                        Submit Encrypted Backup Shares
                      </button>
                    </div>

                    <textarea
                      className="border rounded px-3 py-2 min-h-28 w-full"
                      placeholder="Generated encrypted guardian backup payload"
                      value={backupForm[item.electionId]?.generatedGuardianData || ''}
                      onChange={(e) =>
                        setBackupForm((prev) => ({
                          ...prev,
                          [item.electionId]: {
                            ...(prev[item.electionId] || {}),
                            generatedGuardianData: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                )}

                {item.currentRound === 'backup_submitted_waiting_others' && (
                  <div className="mt-2 text-blue-700 bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                    Your encrypted backup shares are submitted. Waiting for other guardians to finish Round 2.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <FiClock /> Admin Waiting Room
        </h3>
        {adminPendingElections.length === 0 ? (
          <p className="text-gray-600 text-sm">No elections waiting for activation.</p>
        ) : (
          <div className="space-y-4">
            {adminPendingElections.map((e) => {
              const status = adminStatus[e.electionId];
              return (
                <div key={e.electionId} className="border rounded p-3">
                  <div className="font-medium">{e.electionTitle}</div>
                  <div className="text-sm text-gray-600 mb-2">
                    {status ? `${status.submittedGuardians}/${status.totalGuardians} submitted` : 'Loading status...'}
                  </div>
                  {status?.readyForActivation && (
                    <div className="text-green-700 text-sm mb-2 flex items-center gap-1">
                      <FiCheckCircle /> Ready for activation
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="datetime-local"
                      className="border rounded px-3 py-2"
                      value={activationForm[e.electionId]?.startingTime || ''}
                      onChange={(ev) =>
                        setActivationForm((prev) => ({
                          ...prev,
                          [e.electionId]: {
                            ...(prev[e.electionId] || {}),
                            startingTime: ev.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      type="datetime-local"
                      className="border rounded px-3 py-2"
                      value={activationForm[e.electionId]?.endingTime || ''}
                      onChange={(ev) =>
                        setActivationForm((prev) => ({
                          ...prev,
                          [e.electionId]: {
                            ...(prev[e.electionId] || {}),
                            endingTime: ev.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <button
                    onClick={() => handleActivate(e.electionId)}
                    disabled={!status?.readyForActivation}
                    className="mt-3 px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
                  >
                    Activate Election
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
