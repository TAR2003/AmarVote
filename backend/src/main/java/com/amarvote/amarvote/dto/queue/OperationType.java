package com.amarvote.amarvote.dto.queue;

/**
 * Types of operations that can be queued
 */
public enum OperationType {
    TALLY,
    DECRYPTION,
    COMBINE,
    COMPENSATED_DECRYPTION
}
