// API utilities for making requests to the backend
const API_BASE_URL = '/api';

// Get CSRF token from cookie
function getCsrfToken() {
  const cookies = document.cookie.split('; ');
  const csrfCookie = cookies.find(cookie => cookie.startsWith('XSRF-TOKEN='));
  return csrfCookie ? csrfCookie.split('=')[1] : '';
}

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise} Response promise
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Include CSRF token for non-GET requests
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (options.method && options.method !== 'GET') {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }
    console.log(`CSRF token for ${endpoint}:`, csrfToken ? 'present' : 'missing');
  }
  
  const defaultOptions = {
    credentials: 'include',
    headers
  };
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = {};
      }
      
      console.error(`API Error (${response.status}):`, errorData);
      throw new Error(
        errorData.message || 
        (errorData.error && errorData.error.message) || 
        `Request failed with status ${response.status}: ${response.statusText}`
      );
    }
    
    return response.json();
  } catch (error) {
    console.error(`API Request failed for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Fetch all elections accessible to the current user
 * This returns ALL necessary election data including:
 * - Basic election info (title, description, dates)
 * - User's role in each election (voter, admin, guardian)
 * - User's voting status (hasVoted)
 * - Election visibility (isPublic)
 * - Election metadata (noOfCandidates, adminName, adminEmail)
 * 
 * The frontend will use ONLY this data without making additional API calls
 * @returns {Promise<Array>} Array of complete election objects
 */
export async function fetchAllElections() {
  try {
    console.log('API: Making single API call to fetch all elections data');
    const elections = await apiRequest('/all-elections', {
      method: 'GET',
    });
    console.log(`API: Fetched ${elections.length} elections with complete data`);
    return elections;
  } catch (error) {
    console.error('Error fetching elections:', error);
    throw error;
  }
}

/**
 * Create a new election
 * @param {Object} electionData - Election data
 * @returns {Promise<Object>} Created election object
 */
export async function createElection(electionData) {
  try {
    const election = await apiRequest('/create-election', {
      method: 'POST',
      body: JSON.stringify(electionData),
    });
    return election;
  } catch (error) {
    console.error('Error creating election:', error);
    throw error;
  }
}

/**
 * Get user session information
 * @returns {Promise<Object>} User session data
 */
export async function getUserSession() {
  try {
    const session = await apiRequest('/auth/session', {
      method: 'GET',
    });
    return session;
  } catch (error) {
    console.error('Error fetching user session:', error);
    throw error;
  }
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login response
 */
export async function loginUser(email, password) {
  try {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
}

/**
 * Logout user
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
    });
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
}

/**
 * Get user profile data
 * @returns {Promise<Object>} User profile data
 */
export async function getUserProfile() {
  try {
    const response = await apiRequest('/auth/profile', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Update user profile
 * @param {Object} profileData - Profile data to update (userName, profilePic)
 * @returns {Promise<Object>} Updated profile data
 */
export async function updateUserProfile(profileData) {
  try {
    console.log('Sending profile update request:', profileData);
    const response = await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    console.log('Profile update response:', response);
    return response;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Update user password
 * @param {Object} passwordData - Password data (currentPassword, newPassword, confirmPassword)
 * @returns {Promise<Object>} Success response
 */
export async function updateUserPassword(passwordData) {
  try {
    console.log('Sending password update request');
    const response = await apiRequest('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    });
    console.log('Password update response:', response);
    return response;
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
}
