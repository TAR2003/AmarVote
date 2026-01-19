// API utility functions for election-related operations
import { apiRequest, apiBinaryRequest } from './api.js';
import { prepareBallotForTransmission, TARGET_SIZE } from './ballotPadding.js';

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
  async createEncryptedBallot(electionId, choiceId, optionTitle, botDetectionData = null) {
    try {
      const requestBody = {
        electionId,
        selectedCandidate: optionTitle
      };

      // Include bot detection data if provided
      if (botDetectionData) {
        requestBody.botDetection = botDetectionData;
      }

      // Apply PKCS#7 padding to create fixed-size payload (17520 bytes)
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
  async performBenalohChallenge(electionId, encrypted_ballot_with_nonce, candidate_name) {
    try {
      const requestBody = {
        electionId,
        encrypted_ballot_with_nonce,
        candidate_name
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
   * Submit guardian partial decryption credentials
   */
  async submitGuardianKey(electionId, encryptedCredentials) {
    try {
      return await apiRequest('/create-partial-decryption', {
        method: 'POST',
        body: JSON.stringify({
          election_id: electionId,
          encrypted_data: encryptedCredentials
        }),
      }, EXTENDED_TIMEOUT);
    } catch (error) {
      console.error('Error submitting guardian credentials:', error);
      throw error;
    }
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
   */
  async getElectionResults(electionId) {
    try {
      const response = await apiRequest(`/election/${electionId}/cached-results`, {
        method: 'GET',
      }, EXTENDED_TIMEOUT);
      return response;
    } catch (error) {
      console.error('Error fetching election results:', error);
      throw error;
    }
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
   * Get blockchain logs for an election
   */
  async getBlockchainLogs(electionId) {
    try {
      const response = await fetch(`/api/blockchain/logs/${electionId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Get response text for better error handling
      const responseText = await response.text();

      if (!response.ok) {
        // If there's an error, try to parse the response as JSON for a structured error message
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        } catch (e) {
          // If parsing fails, throw the raw text as the error
          throw new Error(responseText || `HTTP error! status: ${response.status}`);
        }
      }

      // If response is OK, parse it as JSON
      const data = JSON.parse(responseText);

      if (!data.success) {
        throw new Error(data.message || 'Operation failed');
      }

      return data;
    } catch (error) {
      console.error('Error fetching blockchain logs:', error);
      throw error;
    }
  },

  /**
   * Verify a ballot on the blockchain
   */
  async verifyBallotOnBlockchainAPI(electionId, trackingCode) {
    try {
      const response = await fetch(`/api/blockchain/ballot/${electionId}/${trackingCode}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const responseText = await response.text();
      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        } catch (e) {
          throw new Error(responseText || `HTTP error! status: ${response.status}`);
        }
      }
      const data = JSON.parse(responseText);
      if (!data.success) {
        throw new Error(data.message || 'Operation failed');
      }
      return data;
    } catch (error) {
      console.error('Error verifying ballot on blockchain:', error);
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

  /**
   * Get guardian information for verification tab
   */
  async getElectionGuardians(electionId) {
    try {
      const response = await fetch(`/api/election/${electionId}/guardians`, {
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

  /**
   * Get compensated decryption information for verification tab
   */
  async getElectionCompensatedDecryptions(electionId) {
    try {
      const response = await fetch(`/api/election/${electionId}/compensated-decryptions`, {
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
};
