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
};
