// Timezone utility functions for frontend
export const timezoneUtils = {
  // Get user's local timezone from the browser
  getUserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  },

  // Parse backend timestamps as UTC (handles LocalDateTime without offset suffix).
  parseUtcTimestamp(value) {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    }

    const str = String(value).trim();
    if (!str) return null;

    // ISO-8601 without timezone suffix is stored as UTC on the backend.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str) && !/(Z|[+-]\d{2}:\d{2})$/i.test(str)) {
      const parsed = new Date(`${str}Z`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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

    if (localDate instanceof Date) {
      return localDate.toISOString();
    }

    const date = this.parseUtcTimestamp(localDate);
    return date ? date.toISOString() : null;
  },

  // Convert UTC string from backend to local Date for display
  convertFromUTC(utcString) {
    return this.parseUtcTimestamp(utcString);
  },

  // Shared locale options for rendering in the user's timezone
  getLocaleOptions(options = {}) {
    const { timeZone, ...rest } = options;
    return {
      timeZone: timeZone || this.getUserTimezone(),
      ...rest,
    };
  },

  // Format date for display in user's timezone with offset label
  formatForDisplay(utcString, options = {}) {
    const date = this.parseUtcTimestamp(utcString);
    if (!date) return '';

    const { showTimezone = true, ...localeOptions } = options;
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };

    const formatted = date.toLocaleString(undefined, this.getLocaleOptions({ ...defaultOptions, ...localeOptions }));
    if (!showTimezone) return formatted;
    return `${formatted} · ${this.getTimezoneOffsetLabel(date)}`;
  },

  // Standard datetime display used across the app
  formatDateTime(utcString, options = {}) {
    const date = this.parseUtcTimestamp(utcString);
    if (!date) return '—';

    const { showTimezone = true, ...localeOptions } = options;
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };

    const formatted = date.toLocaleString(undefined, this.getLocaleOptions({ ...defaultOptions, ...localeOptions }));
    if (!showTimezone) return formatted;
    return `${formatted} · ${this.getTimezoneOffsetLabel(date)}`;
  },

  // Date-only display in user's timezone
  formatDateOnly(utcString, options = {}) {
    const date = this.parseUtcTimestamp(utcString);
    if (!date) return '';

    const { showTimezone = false, ...localeOptions } = options;
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };

    const formatted = date.toLocaleDateString(undefined, this.getLocaleOptions({ ...defaultOptions, ...localeOptions }));
    if (!showTimezone) return formatted;
    return `${formatted} · ${this.getTimezoneOffsetLabel(date)}`;
  },

  // Time-only display in user's timezone
  formatTimeOnly(utcString, options = {}) {
    const date = this.parseUtcTimestamp(utcString);
    if (!date) return '—';

    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };

    return date.toLocaleTimeString(undefined, this.getLocaleOptions({ ...defaultOptions, ...options }));
  },

  // Check if an election is currently active
  isElectionActive(startTime, endTime) {
    const now = new Date();
    const start = this.parseUtcTimestamp(startTime);
    const end = this.parseUtcTimestamp(endTime);

    if (!start || !end) return false;
    return now >= start && now <= end;
  },

  // Get time until election starts/ends
  getTimeUntil(targetTime) {
    const now = new Date();
    const target = this.parseUtcTimestamp(targetTime);
    if (!target) return null;

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

    const start = this.parseUtcTimestamp(startTime);
    const end = this.parseUtcTimestamp(endTime);
    if (!start || !end) return false;

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
    return this.formatDateOnly(utcString, { showTimezone: true });
  },

  // Convert UTC ISO string to value for <input type="datetime-local">
  toLocalInputValue(utcString) {
    const date = this.parseUtcTimestamp(utcString);
    if (!date) return '';

    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  },

  // Parse <input type="datetime-local"> value to UTC ISO string
  fromLocalInputValue(localValue) {
    if (!localValue) return null;
    const date = new Date(localValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  },

  // Time-based election status for display (independent of backend workflow status)
  getElectionStatus(startTime, endTime) {
    if (!startTime || !endTime) return 'upcoming';

    const now = new Date();
    const start = this.parseUtcTimestamp(startTime);
    const end = this.parseUtcTimestamp(endTime);
    if (!start || !end) return 'upcoming';

    if (now > end) return 'finished';
    if (now >= start) return 'ongoing';
    return 'scheduled';
  },

  // Human-readable status label combining workflow and schedule
  getElectionStatusLabel(workflowStatus, startTime, endTime) {
    const normalized = String(workflowStatus || '').toLowerCase().trim();

    if (normalized === 'key_ceremony_pending') return 'Waiting for key ceremony';
    if (normalized === 'decrypted') return 'Results decrypted';
    if (normalized === 'draft') return 'Draft';
    if (normalized === 'completed' || normalized === 'finished') return 'Voting ended';
    if (normalized === 'active' || normalized === 'ongoing') return 'Voting in progress';
    if (normalized === 'scheduled') return 'Scheduled';

    // Fall back to schedule-based status when workflow is open/activated or unknown
    const timeStatus = this.getElectionStatus(startTime, endTime);
    switch (timeStatus) {
      case 'finished': return 'Voting ended';
      case 'ongoing': return 'Voting in progress';
      case 'scheduled': return 'Scheduled';
      default:
        if (!normalized) return 'Unknown';
        // Avoid showing raw underscored status strings in the UI
        return normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
};

export default timezoneUtils;
