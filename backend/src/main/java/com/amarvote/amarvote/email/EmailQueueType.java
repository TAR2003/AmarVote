package com.amarvote.amarvote.email;

/**
 * Two independent outbound email lanes, each limited to 1 Resend API request/second.
 */
public enum EmailQueueType {
  /** Verification codes, OTP, ballot receipts, guardian credentials, etc. */
  TRANSACTIONAL,
  /** Bulk election messages to voters, guardians, or admins. */
  BULK
}
