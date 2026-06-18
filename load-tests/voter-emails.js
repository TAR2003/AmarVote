/**
 * Pure email formatting — allocation logic lives in email-allocator.js.
 */
export function formatVoterEmail(prefix, domain, index, padWidth = 4) {
  return `${prefix}-${String(index).padStart(padWidth, '0')}@${domain}`;
}
