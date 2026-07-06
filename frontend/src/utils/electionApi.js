// API utility functions for election-related operations
import { apiRequest, apiBinaryRequest } from './api.js';
import { prepareBallotForTransmission, TARGET_SIZE, buildStuffedBallotPayload } from './ballotPadding.js';

// Extended timeout for computationally intensive operations (5 minutes)
const EXTENDED_TIMEOUT = 5 * 60 * 1000; // 300,000ms = 5 minutes

export const electionApi = {
  /**
   * Fetch all elections accessible to the current user
   * This includes elections where the user is:
   * - A voter (in allowed voters list)
   * - An admin (admin_email matches)
   * - A guardian
   */
  async getAllElections() {
    try {
      return await apiRequest('/all-elections', {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching elections:', error);
      throw error;
    }
  },

  /**
   * Create a new election
   */
  async createElection(electionData) {
    try {
      return await apiRequest('/create-election', {
        method: 'POST',
        body: JSON.stringify(electionData),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error creating election:', error);
      throw error;
    }
  },

  async getPendingKeyCeremonies() {
    try {
      return await apiRequest('/guardian/key-ceremony/pending', {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching pending key ceremonies:', error);
      throw error;
    }
  },

  async generateGuardianKeyCeremonyCredentials(electionId) {
    try {
      return await apiRequest(`/guardian/key-ceremony/generate/${electionId}`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error generating guardian key ceremony credentials:', error);
      throw error;
    }
  },

  async submitGuardianKeyCeremony(
    electionId,
    guardianPrivateKey,
    guardianPublicKey,
    guardianPolynomial,
    localEncryptionPassword,
    guardianKeyBackup
  ) {
    try {
      return await apiRequest('/guardian/key-ceremony/submit', {
        method: 'POST',
        body: JSON.stringify({
          electionId,
          guardianPrivateKey,
          guardianPublicKey,
          guardianPolynomial,
          localEncryptionPassword,
          guardianKeyBackup,
        }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error submitting key ceremony data:', error);
      throw error;
    }
  },

  async getAdminKeyCeremonyStatus(electionId) {
    try {
      return await apiRequest(`/admin/key-ceremony/status/${electionId}`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching key ceremony waiting room status:', error);
      throw error;
    }
  },

  async getKeyCeremonyStatus(electionId) {
    try {
      return await apiRequest(`/key-ceremony/status/${electionId}`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching key ceremony status:', error);
      throw error;
    }
  },

  async getGuardianBackupContext(electionId) {
    try {
      return await apiRequest(`/guardian/key-ceremony/backup/context/${electionId}`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching backup round context:', error);
      throw error;
    }
  },

  async getGuardianCredentialMetadata(electionId) {
    try {
      return await apiRequest(`/guardian/key-ceremony/credential-metadata/${electionId}`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching guardian credential metadata:', error);
      throw error;
    }
  },

  async submitGuardianBackupShares(electionId, guardianKeyBackup) {
    try {
      return await apiRequest('/guardian/key-ceremony/backup/submit', {
        method: 'POST',
        body: JSON.stringify({ electionId, guardianKeyBackup }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error submitting encrypted backup shares:', error);
      throw error;
    }
  },

  async generateGuardianBackupShares(electionId, encryptedData) {
    try {
      return await apiRequest(`/guardian/key-ceremony/backup/generate/${electionId}`, {
        method: 'POST',
        body: JSON.stringify({ encrypted_data: encryptedData }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error generating backup shares:', error);
      throw error;
    }
  },

  async activateElectionAfterCeremony(electionId, startingTime, endingTime) {
    try {
      const payload = {
        electionId,
        startingTime,
        endingTime,
      };

      return await apiRequest('/admin/key-ceremony/activate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error activating election after key ceremony:', error);
      throw error;
    }
  },

  async getGuardianLocalPassword(electionId) {
    try {
      return await apiRequest(`/guardian/key-ceremony/password/${electionId}`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching guardian local password:', error);
      throw error;
    }
  },

  /**
   * Privately verify guardian credential file against stored public key.
   * Result is visible only to the requesting guardian; nothing is persisted.
   */
  async verifyGuardianKey(electionId, encryptedCredential) {
    try {
      return await apiRequest(`/guardian/key-verification/${electionId}`, {
        method: 'POST',
        body: JSON.stringify({ encryptedCredential }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error verifying guardian key:', error);
      throw error;
    }
  },

  /**
   * Fetch detailed election information by ID
   * Returns null if user is not authorized to view the election
   */
  async getElectionById(electionId) {
    try {
      return await apiRequest(`/election/${electionId}`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching election details:', error);
      throw error;
    }
  },

  /**
   * Cast a ballot for an election
   */
  async castBallot(electionId, choiceId, optionTitle, botDetectionData = null) {
    try {
      const requestBody = {
        electionId,
        selectedCandidate: optionTitle
      };

      // Include bot detection data if provided
      if (botDetectionData) {
        requestBody.botDetection = botDetectionData;
      }

      return await apiRequest('/cast-ballot', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error casting ballot:', error);
      throw error;
    }
  },

  /**
   * Create an encrypted ballot without casting it
   * Uses PKCS#7 padding to ensure constant packet size (17520 bytes)
   */
  async createEncryptedBallot(electionId, selectedChoiceIds, optionTitles, botDetectionData = null, maxChoices = 1) {
    try {
      const selectedNames = Array.isArray(optionTitles) ? optionTitles : [optionTitles];
      const choiceIds = Array.isArray(selectedChoiceIds)
        ? selectedChoiceIds
        : (selectedChoiceIds != null ? [selectedChoiceIds] : []);
      const requestBody = buildStuffedBallotPayload(
        electionId,
        selectedNames,
        Math.max(1, maxChoices),
        botDetectionData,
        choiceIds
      );

      // Apply PKCS#7 padding to create fixed-size payload (18980 bytes)
      const paddedPayload = prepareBallotForTransmission(requestBody, TARGET_SIZE);

      console.log(`🔒 [CREATE BALLOT] Sending ${paddedPayload.length} byte fixed-size encrypted ballot`);

      // Use the standard apiBinaryRequest helper (follows same pattern as other API calls)
      return await apiBinaryRequest('/create-encrypted-ballot', paddedPayload, 'application/octet-stream', EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('❌ [CREATE BALLOT] Error creating encrypted ballot:', error);
      throw error;
    }
  },

  /**
   * Cast a pre-encrypted ballot
   */
  async castEncryptedBallot(electionId, encrypted_ballot, ballot_hash, ballot_tracking_code) {
    try {
      const requestBody = {
        electionId,
        encrypted_ballot,
        ballot_hash,
        ballot_tracking_code
      };

      return await apiRequest('/cast-encrypted-ballot', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error casting encrypted ballot:', error);
      throw error;
    }
  },

  /**
   * Perform Benaloh challenge on an encrypted ballot
   */
  async performBenalohChallenge(electionId, encrypted_ballot_with_nonce, candidateNamesToVerify) {
    try {
      const requestBody = {
        electionId,
        encrypted_ballot_with_nonce,
        candidate_names_to_verify: Array.isArray(candidateNamesToVerify) ? candidateNamesToVerify : [candidateNamesToVerify]
      };

      return await apiRequest('/benaloh-challenge', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error performing Benaloh challenge:', error);
      throw error;
    }
  },

  /**
   * Check if user is eligible to vote in a specific election
   * Returns an object with the following properties:
   * - canVote: boolean indicating if the user can vote in this election
   * - hasVoted: boolean indicating if the user has already voted in this election
   * - reason: string explaining why the user can't vote (if applicable)
   */
  async checkEligibility(electionId) {
    try {
      return await apiRequest('/eligibility', {
        method: 'POST',
        body: JSON.stringify({
          electionId
        }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error checking eligibility:', error);
      throw error;
    }
  },

  /**
   * Initiate tally creation (new async endpoint)
   */
  async initiateTallyCreation(electionId) {
    try {
      return await apiRequest('/initiate-tally', {
        method: 'POST',
        body: JSON.stringify({
          election_id: electionId
        }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error initiating tally creation:', error);
      throw error;
    }
  },

  /**
   * Get tally creation status
   */
  async getTallyStatus(electionId) {
    try {
      return await apiRequest(`/election/${electionId}/tally-status`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error fetching tally status:', error);
      throw error;
    }
  },

  /**   * Initiate guardian decryption process (new async endpoint)
   */
  async initiateDecryption(electionId, encryptedData) {
    try {
      return await apiRequest('/guardian/initiate-decryption', {
        method: 'POST',
        body: JSON.stringify({
          election_id: electionId,
          encrypted_data: encryptedData
        }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error initiating decryption:', error);
      throw error;
    }
  },

  /**
   * Get guardian decryption status (authenticated - no guardianId needed)
   */
  async getDecryptionStatus(electionId) {
    try {
      return await apiRequest(`/guardian/decryption-status/${electionId}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting decryption status:', error);
      throw error;
    }
  },

  /**
   * Get guardian decryption status by guardian ID (for timeline)
   */
  async getDecryptionStatusByGuardianId(electionId, guardianId) {
    try {
      return await apiRequest(`/guardian/decryption-status/${electionId}/${guardianId}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting decryption status by guardian ID:', error);
      throw error;
    }
  },

  async getAllGuardiansDecryptionProgress(electionId) {
    return apiRequest(`/election/${electionId}/guardians/decryption-progress`, { method: 'GET' });
  },

  async stopTallyProcess(electionId) {
    return apiRequest(`/elections/${electionId}/process/tally/stop`, { method: 'POST' });
  },

  async deleteTallyResults(electionId) {
    return apiRequest(`/elections/${electionId}/process/tally`, { method: 'DELETE' });
  },

  async stopGuardianDecryption(electionId, guardianId) {
    return apiRequest(`/elections/${electionId}/process/decryption/${guardianId}/stop`, { method: 'POST' });
  },

  async deleteGuardianDecryption(electionId, guardianId) {
    return apiRequest(`/elections/${electionId}/process/decryption/${guardianId}`, { method: 'DELETE' });
  },

  async stopCombineProcess(electionId) {
    return apiRequest(`/elections/${electionId}/process/combine/stop`, { method: 'POST' });
  },

  async deleteCombineResults(electionId) {
    return apiRequest(`/elections/${electionId}/process/combine`, { method: 'DELETE' });
  },

  /**   * Create tally for an election (legacy endpoint, now uses async system)
   */
  async createTally(electionId) {
    try {
      return await apiRequest('/create-tally', {
        method: 'POST',
        body: JSON.stringify({
          election_id: electionId
        }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error creating tally:', error);
      throw error;
    }
  },

  /**
   * Submit guardian partial decryption credentials (async queue — same as initiateDecryption)
   */
  async submitGuardianKey(electionId, encryptedCredentials) {
    return this.initiateDecryption(electionId, encryptedCredentials);
  },

  /**
   * Combine partial decryptions to get final results (synchronous - deprecated)
   */
  async combinePartialDecryptions(electionId) {
    try {
      return await apiRequest('/combine-partial-decryption', {
        method: 'POST',
        body: JSON.stringify({
          election_id: electionId
        }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error combining partial decryptions:', error);
      throw error;
    }
  },

  /**
   * Initiate combine partial decryptions (new async endpoint)
   */
  async initiateCombine(electionId) {
    try {
      return await apiRequest(`/initiate-combine?electionId=${electionId}`, {
        method: 'POST',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error initiating combine:', error);
      throw error;
    }
  },

  /**
   * Get combine status for an election
   */
  async getCombineStatus(electionId) {
    try {
      return await apiRequest(`/combine-status/${electionId}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting combine status:', error);
      throw error;
    }
  },

  /**
   * Get election results with chunk breakdown
   * @param {Object} [options]
   * @param {boolean} [options.includeBallots=false] - Include full ballot list (heavy for large elections)
   */
  async getElectionResults(electionId, options = {}) {
    const includeBallots = options.includeBallots === true;
    const includeChunkCiphertext = options.includeChunkCiphertext === true;
    try {
      const response = await apiRequest(
        `/election/${electionId}/cached-results?includeBallots=${includeBallots}&includeChunkCiphertext=${includeChunkCiphertext}`,
        { method: 'GET' },
        EXTENDED_TIMEOUT
      );
      return response;
    } catch (error) {
      // Don't throw 404 errors - results just aren't ready yet
      if (error.message && error.message.includes('Results not yet available')) {
        console.log('ℹ️ Results not yet available for election', electionId);
        return { success: false, results: null };
      }
      console.error('Error fetching election results:', error);
      throw error;
    }
  },

  /**
   * Paginated ballots for Ballots in Tally tab (server-side search/sort).
   */
  async getElectionBallots(electionId, {
    page = 0,
    size = 30,
    search = '',
    sortBy = 'ballot_id',
    sortOrder = 'asc',
  } = {}) {
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(size),
        sortBy,
        sortOrder,
      });
      if (search && search.trim()) {
        params.set('search', search.trim());
      }
      return await apiRequest(`/election/${electionId}/cached-results/ballots?${params.toString()}`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      if (error.message && error.message.includes('Results not yet available')) {
        return { success: false, ballots: [], total: 0 };
      }
      console.error('Error fetching election ballots:', error);
      throw error;
    }
  },

  /**
   * Fetch every ballot in the tally (paginates past the server page-size cap of 200).
   */
  async getAllElectionBallots(electionId, {
    search = '',
    sortBy = 'ballot_id',
    sortOrder = 'asc',
  } = {}) {
    const PAGE_SIZE = 200;
    let page = 0;
    let allBallots = [];
    let total = 0;

    while (true) {
      const response = await this.getElectionBallots(electionId, {
        page,
        size: PAGE_SIZE,
        search,
        sortBy,
        sortOrder,
      });

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to fetch ballots');
      }

      const ballots = response.ballots || [];
      total = response.total ?? ballots.length;
      allBallots = allBallots.concat(ballots);

      if (allBallots.length >= total || ballots.length === 0) {
        break;
      }
      page += 1;
    }

    return { success: true, ballots: allBallots, total };
  },

  /**
   * Verify a vote using tracking code and hash
   */
  async verifyVote(electionId, verificationData) {
    try {
      return await apiRequest('/verify-vote', {
        method: 'POST',
        body: JSON.stringify({
          election_id: electionId,
          tracking_code: verificationData.tracking_code,
          hash_code: verificationData.hash_code
        }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error verifying vote:', error);
      throw error;
    }
  },

  /**
   * Get ballots in tally for verification
   */
  async getBallotsInTally(electionId) {
    try {
      const response = await fetch(`/api/ballots-in-tally/${electionId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting ballots in tally:', error);
      throw error;
    }
  },

  /**
   * Get ballot details including cipher text by election ID and tracking code
   */
  async getBallotDetails(electionId, trackingCode) {
    try {
      const response = await fetch(`/api/ballot-details/${electionId}/${trackingCode}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting ballot details:', error);
      throw error;
    }
  },

  async getChunkEncryptedTally(electionId, electionCenterId) {
    try {
      return await apiRequest(`/election/${electionId}/chunk/${electionCenterId}/encrypted-tally`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching chunk encrypted tally:', error);
      throw error;
    }
  },

  /**
   * Get guardian information for verification tab
   * @param {boolean} [summary=true] - When true, returns lightweight list without heavy crypto payloads
   */
  async getElectionGuardians(electionId, { summary = true } = {}) {
    try {
      const response = await fetch(`/api/election/${electionId}/guardians?summary=${summary}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching election guardians:', error);
      throw error;
    }
  },

  async getElectionGuardianDetail(electionId, guardianId) {
    try {
      const response = await fetch(`/api/election/${electionId}/guardians/${guardianId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching guardian detail:', error);
      throw error;
    }
  },

  /**
   * Get compensated decryption information for verification tab
   * @param {boolean} [summary=true] - When true, omits heavy share payloads
   */
  async getElectionCompensatedDecryptions(electionId, { summary = true } = {}) {
    try {
      const response = await fetch(`/api/election/${electionId}/compensated-decryptions?summary=${summary}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching compensated decryptions:', error);
      throw error;
    }
  },

  async getElectionCompensatedDecryptionDetail(electionId, compensatedDecryptionId) {
    try {
      const response = await fetch(
        `/api/election/${electionId}/compensated-decryptions/${compensatedDecryptionId}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching compensated decryption detail:', error);
      throw error;
    }
  },

  /**
   * Decode binary-transport artifacts to human-readable JSON (for downloads only).
   */
  async decodeArtifactToJson(payload) {
    try {
      return await apiRequest('/artifacts/decode-to-json', {
        method: 'POST',
        body: JSON.stringify({ payload }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error decoding artifact to JSON:', error);
      throw error;
    }
  },

  async getElectionVoters(electionId) {
    try {
      return await apiRequest(`/election/${electionId}/voters`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error fetching election voters:', error);
      throw error;
    }
  },

  async addVotersToElection(electionId, voterEmails) {
    try {
      return await apiRequest(`/election/${electionId}/voters`, {
        method: 'POST',
        body: JSON.stringify({ voterEmails }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error adding voters:', error);
      throw error;
    }
  },

  async removeVoterFromElection(electionId, voterEmail) {
    try {
      return await apiRequest(`/election/${electionId}/voters/${encodeURIComponent(voterEmail)}`, {
        method: 'DELETE',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error removing voter:', error);
      throw error;
    }
  },

  async removeAllVotersFromElection(electionId) {
    try {
      return await apiRequest(`/election/${electionId}/voters`, {
        method: 'DELETE',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error removing all voters:', error);
      throw error;
    }
  },

  async updateElectionSettings(electionId, settings) {
    try {
      return await apiRequest(`/election/${electionId}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error updating election settings:', error);
      throw error;
    }
  },

  async listScheduledEmails(electionId) {
    try {
      return await apiRequest(`/election/${electionId}/scheduled-emails`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error listing scheduled emails:', error);
      throw error;
    }
  },

  async createScheduledEmail(electionId, payload) {
    try {
      return await apiRequest(`/election/${electionId}/scheduled-emails`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error creating scheduled email:', error);
      throw error;
    }
  },

  async updateScheduledEmail(electionId, emailId, payload) {
    try {
      return await apiRequest(`/election/${electionId}/scheduled-emails/${emailId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error updating scheduled email:', error);
      throw error;
    }
  },

  async deleteScheduledEmail(electionId, emailId) {
    try {
      return await apiRequest(`/election/${electionId}/scheduled-emails/${emailId}`, {
        method: 'DELETE',
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error deleting scheduled email:', error);
      throw error;
    }
  },
};
