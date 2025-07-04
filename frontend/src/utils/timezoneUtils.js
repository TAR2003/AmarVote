// Timezone utility functions for frontend
export const timezoneUtils = {
  // Get user's local timezone
  getUserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  },

  // Convert local date to UTC for backend
  convertToUTC(localDate) {
    if (!localDate) return null;
    
    // If it's already a Date object, use it directly
    if (localDate instanceof Date) {
      return localDate.toISOString();
    }
    
    // If it's a string, parse it
    const date = new Date(localDate);
    return date.toISOString();
  },

  // Convert UTC string from backend to local Date for display
  convertFromUTC(utcString) {
    if (!utcString) return null;
    return new Date(utcString);
  },

  // Format date for display in user's timezone
  formatForDisplay(utcString, options = {}) {
    if (!utcString) return '';
    
    const date = new Date(utcString);
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };
    
    return date.toLocaleString(undefined, { ...defaultOptions, ...options });
  },

  // Check if an election is currently active
  isElectionActive(startTime, endTime) {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return now >= start && now <= end;
  },

  // Get time until election starts/ends
  getTimeUntil(targetTime) {
    const now = new Date();
    const target = new Date(targetTime);
    const diff = target - now;
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  },

  // Validate that end time is after start time
  validateTimeRange(startTime, endTime) {
    if (!startTime || !endTime) return false;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return end > start;
  },

  // Get minimum date for election (current time + buffer)
  getMinElectionDate(bufferMinutes = 30) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + bufferMinutes);
    return now;
  },

  // Standardized date formatting for election times
  formatElectionDate(utcString) {
    if (!utcString) return '';
    const date = new Date(utcString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  // Short date format for display
  formatShortDate(utcString) {
    if (!utcString) return '';
    const date = new Date(utcString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  // Get election status based on current time
  getElectionStatus(startTime, endTime) {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'ongoing';
  }
};

export default timezoneUtils;
