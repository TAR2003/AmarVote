/**
 * API functions for user-related operations
 */
const userApi = {
    /**
     * Search for users by email or name
     * 
     * @param {string} query - The search query
     * @returns {Promise<{userId: number, email: string, name: string, profilePic: string}[]>} 
     */
    async searchUsers(query) {
        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`, {
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
            console.error('Error searching users:', error);
            return [];
        }
    },

    /**
     * Get the total number of users
     * 
     * @returns {Promise<number>} The user count
     */
    async getUserCount() {
        try {
            const response = await fetch('/api/users/count', {
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
            return data.count;
        } catch (error) {
            console.error('Error getting user count:', error);
            return 0;
        }
    }
};

export { userApi };
