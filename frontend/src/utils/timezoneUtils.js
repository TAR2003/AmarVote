// Timezone utility functions for frontend
export const timezoneUtils = {
  // Get user's local timezone
  getUserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  },

  // Get GMT offset label like "GMT+6:00"
  getTimezoneOffsetLabel(date = new Date()) {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    return `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}`;
  },

  // Full timezone display: "Asia/Dhaka (GMT+6:00)"
  getTimezoneLabel(date = new Date()) {
    const tz = this.getUserTimezone();
    return `${tz} (${this.getTimezoneOffsetLabel(date)})`;
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

  // Format date for display in user's timezone with offset label
  formatForDisplay(utcString, options = {}) {
    if (!utcString) return '';
    
    const date = new Date(utcString);
    const { showTimezone = true, ...localeOptions } = options;
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    
    const formatted = date.toLocaleString(undefined, { ...defaultOptions, ...localeOptions });
    if (!showTimezone) return formatted;
    return `${formatted} · ${this.getTimezoneOffsetLabel(date)}`;
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
    return this.formatForDisplay(utcString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // Short date format for display
  formatShortDate(utcString) {
    if (!utcString) return '';
    const date = new Date(utcString);
    const formatted = date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return `${formatted} · ${this.getTimezoneOffsetLabel(date)}`;
  },

  // Time-based election status for display (independent of backend workflow status)
  getElectionStatus(startTime, endTime) {
    if (!startTime || !endTime) return 'upcoming';

    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (now > end) return 'finished';
    if (now >= start) return 'ongoing';
    return 'scheduled';
  }
};

export default timezoneUtils;
