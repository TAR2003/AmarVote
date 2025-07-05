// API utility functions for election-related operations
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
      const response = await fetch('/api/all-elections', {
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
      console.error('Error fetching elections:', error);
      throw error;
    }
  },

  /**
   * Create a new election
   */
  async createElection(electionData) {
    try {
      const response = await fetch('/api/create-election', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(electionData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
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
      const response = await fetch(`/api/election/${electionId}`, {
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
      console.error('Error fetching election details:', error);
      throw error;
    }
  },

  /**
   * Cast a ballot for an election
   */
  async castBallot(electionId, choiceId, optionTitle) {
    try {
      const response = await fetch('/api/cast-ballot', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          electionId,
          selectedCandidate: optionTitle
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error casting ballot:', error);
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
      const response = await fetch('/api/eligibility', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          electionId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking eligibility:', error);
      throw error;
    }
  },

  /**
   * Create tally for an election (automatically called when election page loads)
   */
  async createTally(electionId) {
    try {
      const response = await fetch('/api/create-tally', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          election_id: electionId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating tally:', error);
      throw error;
    }
  },

  /**
   * Submit guardian partial decryption key
   */
  async submitGuardianKey(electionId, guardianKey) {
    try {
      const response = await fetch('/api/partial-decryption', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          election_id: electionId,
          key: guardianKey
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error submitting guardian key:', error);
      throw error;
    }
  },

  /**
   * Combine partial decryptions to get final results
   */
  async combinePartialDecryptions(electionId) {
    try {
      const response = await fetch('/api/combine-partial-decryption', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          election_id: electionId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error combining partial decryptions:', error);
      throw error;
    }
  },
};
