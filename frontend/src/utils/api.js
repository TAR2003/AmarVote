// API utilities for making requests to the backend
const API_BASE_URL = '/api';

// Default timeout for API requests (5 minutes)
const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 300,000ms = 5 minutes

// Get CSRF token from cookie
function getCsrfToken() {
  const cookies = document.cookie.split('; ');
  const csrfCookie = cookies.find(cookie => cookie.startsWith('XSRF-TOKEN='));
  return csrfCookie ? csrfCookie.split('=')[1] : '';
}

/**
 * Create a timeout promise for API requests
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Promise that rejects after timeout
 */
function createTimeoutPromise(timeoutMs) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Make an authenticated API request with timeout support
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 5 minutes)
 * @returns {Promise} Response promise
 */
export async function apiRequest(endpoint, options = {}, timeout = DEFAULT_TIMEOUT) {
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
    // Create fetch promise with timeout
    const fetchPromise = fetch(url, { ...defaultOptions, ...options });
    const timeoutPromise = createTimeoutPromise(timeout);
    
    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
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

/**
 * Upload profile picture
 * @param {File} file - Image file to upload
 * @returns {Promise<Object>} Upload response with image URL
 */
export async function uploadProfilePicture(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const csrfToken = getCsrfToken();
    const headers = {};
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch('/api/auth/profile/upload-picture', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload image');
    }

    return response.json();
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw error;
  }
}

/**
 * Upload candidate picture
 * @param {File} file - Image file to upload
 * @param {string} candidateName - Name of the candidate
 * @returns {Promise<Object>} Upload response with image URL
 */
export async function uploadCandidateImage(file, candidateName) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('candidateName', candidateName);

    const csrfToken = getCsrfToken();
    const headers = {};
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch('/api/upload-candidate-image', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload candidate image');
    }

    return response.json();
  } catch (error) {
    console.error('Error uploading candidate image:', error);
    throw error;
  }
}

/**
 * Upload party picture
 * @param {File} file - Image file to upload
 * @param {string} partyName - Name of the party
 * @returns {Promise<Object>} Upload response with image URL
 */
export async function uploadPartyImage(file, partyName) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('partyName', partyName);

    const csrfToken = getCsrfToken();
    const headers = {};
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch('/api/upload-party-image', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload party image');
    }

    return response.json();
  } catch (error) {
    console.error('Error uploading party image:', error);
    throw error;
  }
}

/**
 * Upload election picture
 * @param {File} file - Image file to upload
 * @param {number} electionId - Election ID
 * @returns {Promise<Object>} Upload response with image URL
 */
export async function uploadElectionPicture(file, electionId) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('electionId', electionId.toString());

    const csrfToken = getCsrfToken();
    const headers = {};
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch('/api/images/election', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload image');
    }

    return response.json();
  } catch (error) {
    console.error('Error uploading election picture:', error);
    throw error;
  }
}

/**
 * Upload candidate picture
 * @param {File} file - Image file to upload
 * @param {number} choiceId - Election choice ID
 * @returns {Promise<Object>} Upload response with image URL
 */
export async function uploadCandidatePicture(file, choiceId) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('choiceId', choiceId.toString());

    const csrfToken = getCsrfToken();
    const headers = {};
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch('/api/images/candidate', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload image');
    }

    return response.json();
  } catch (error) {
    console.error('Error uploading candidate picture:', error);
    throw error;
  }
}

/**
 * Upload party picture
 * @param {File} file - Image file to upload
 * @param {number} choiceId - Election choice ID
 * @returns {Promise<Object>} Upload response with image URL
 */
export async function uploadPartyPicture(file, choiceId) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('choiceId', choiceId.toString());

    const csrfToken = getCsrfToken();
    const headers = {};
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch('/api/images/party', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload image');
    }

    return response.json();
  } catch (error) {
    console.error('Error uploading party picture:', error);
    throw error;
  }
}
