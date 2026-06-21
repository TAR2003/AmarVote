package com.amarvote.amarvote.exception;

/**
 * Thrown when all ElectionGuard crypto slots are in use and the caller timed out waiting.
 */
public class ElectionGuardCapacityException extends RuntimeException {

    public ElectionGuardCapacityException(String message) {
        super(message);
    }

    public ElectionGuardCapacityException(String message, Throwable cause) {
        super(message, cause);
    }
}
