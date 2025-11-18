package com.amarvote.amarvote.util;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Ballot Padding Utility - Industry Standard PKCS#7 Implementation
 * 
 * Ensures constant-size encrypted ballot transmission to prevent traffic analysis attacks.
 * Uses 17520 bytes (12 × 1460) for optimal TCP packet alignment.
 * 
 * Security Features:
 * - PKCS#7 padding standard (industry best practice, RFC 5652)
 * - Fixed 17520-byte payload size
 * - TCP-optimized for stable packet counts
 * - Eliminates size-based vote inference attacks
 * 
 * @author AmarVote Security Team
 * @version 1.0
 */
public class BallotPaddingUtil {

    private static final Logger logger = LoggerFactory.getLogger(BallotPaddingUtil.class);

    /**
     * Target size for encrypted ballot transmission
     * 17520 bytes = 12 × 1460 (TCP MSS), ensuring stable packet segmentation
     */
    public static final int TARGET_SIZE = 17520;

    /**
     * Remove PKCS#7 padding from received data
     * 
     * PKCS#7 Padding Standard (RFC 5652):
     * - The last byte contains the padding length
     * - All padding bytes have the same value (the padding length)
     * - Padding length must be between 1 and block size
     * 
     * Example: If 3 bytes of padding exist: [...data, 0x03, 0x03, 0x03]
     * 
     * @param paddedData The padded byte array
     * @return Original data without padding
     * @throws IllegalArgumentException if padding is invalid
     */
    public static byte[] removePadding(byte[] paddedData) {
        if (paddedData == null || paddedData.length == 0) {
            throw new IllegalArgumentException("Cannot remove padding from null or empty data");
        }

        // Read padding length from last byte (unsigned)
        int paddingLength = paddedData[paddedData.length - 1] & 0xFF;

        // Validate padding length
        if (paddingLength > paddedData.length) {
            logger.error("Invalid padding: padding length ({}) exceeds data size ({})", 
                         paddingLength, paddedData.length);
            throw new IllegalArgumentException(
                String.format("Invalid padding: padding length (%d) exceeds data size (%d)", 
                              paddingLength, paddedData.length)
            );
        }

        if (paddingLength == 0) {
            logger.error("Invalid padding: padding length cannot be zero");
            throw new IllegalArgumentException("Invalid padding: padding length cannot be zero");
        }

        // Verify PKCS#7 padding integrity - all padding bytes must equal padding length
        int startOfPadding = paddedData.length - paddingLength;
        for (int i = startOfPadding; i < paddedData.length; i++) {
            int paddingByte = paddedData[i] & 0xFF;
            if (paddingByte != paddingLength) {
                logger.error("Invalid PKCS#7 padding at position {}: expected {}, got {}", 
                             i, paddingLength, paddingByte);
                throw new IllegalArgumentException(
                    String.format("Invalid PKCS#7 padding: inconsistent padding byte at position %d (expected %d, got %d)",
                                  i, paddingLength, paddingByte)
                );
            }
        }

        // Calculate original data size
        int dataSize = paddedData.length - paddingLength;

        // Extract original data
        byte[] originalData = Arrays.copyOfRange(paddedData, 0, dataSize);

        logger.debug("🔓 [BALLOT PADDING] Removed {} bytes of padding. Original size: {} bytes", 
                     paddingLength, dataSize);

        return originalData;
    }

    /**
     * Add PKCS#7 padding to data to reach target size
     * This method is typically used for testing or client-side implementation
     * 
     * @param data Original data
     * @param targetSize Target size in bytes
     * @return Padded data of exactly targetSize bytes
     * @throws IllegalArgumentException if data exceeds target size
     */
    public static byte[] addPadding(byte[] data, int targetSize) {
        if (data == null) {
            throw new IllegalArgumentException("Data cannot be null");
        }

        if (data.length > targetSize) {
            throw new IllegalArgumentException(
                String.format("Data size (%d bytes) exceeds target size (%d bytes)", 
                              data.length, targetSize)
            );
        }

        // Calculate padding length
        int paddingLength = targetSize - data.length;

        // Create padded array
        byte[] padded = new byte[targetSize];

        // Copy original data
        System.arraycopy(data, 0, padded, 0, data.length);

        // Apply PKCS#7 padding: fill remaining bytes with padding length value
        byte paddingByte = (byte) paddingLength;
        Arrays.fill(padded, data.length, targetSize, paddingByte);

        logger.debug("🔒 [BALLOT PADDING] Added {} bytes of padding. Total size: {} bytes", 
                     paddingLength, targetSize);

        return padded;
    }

    /**
     * Parse JSON from padded byte array
     * 
     * @param paddedData Padded byte array received from client
     * @return JSON string without padding
     * @throws IllegalArgumentException if padding is invalid
     */
    public static String parseJsonFromPaddedData(byte[] paddedData) {
        byte[] originalData = removePadding(paddedData);
        return new String(originalData, StandardCharsets.UTF_8);
    }

    /**
     * Validate that received data matches expected size
     * 
     * @param data Received data
     * @param expectedSize Expected size in bytes
     * @return true if size matches, false otherwise
     */
    public static boolean validateSize(byte[] data, int expectedSize) {
        if (data == null) {
            logger.warn("⚠️ [BALLOT PADDING] Validation failed: data is null");
            return false;
        }

        boolean valid = data.length == expectedSize;
        
        if (!valid) {
            logger.warn("⚠️ [BALLOT PADDING] Size mismatch: expected {} bytes, received {} bytes", 
                        expectedSize, data.length);
        } else {
            logger.debug("✅ [BALLOT PADDING] Size validation passed: {} bytes", expectedSize);
        }

        return valid;
    }

    /**
     * Get statistics about padded data (for monitoring/debugging)
     * 
     * @param paddedData Padded data
     * @return Statistics string
     */
    public static String getPaddingStats(byte[] paddedData) {
        if (paddedData == null || paddedData.length == 0) {
            return "No data";
        }

        try {
            int paddingLength = paddedData[paddedData.length - 1] & 0xFF;
            int dataSize = paddedData.length - paddingLength;
            double paddingPercentage = (paddingLength * 100.0) / paddedData.length;

            return String.format("Total: %d bytes | Data: %d bytes | Padding: %d bytes (%.1f%%)",
                                 paddedData.length, dataSize, paddingLength, paddingPercentage);
        } catch (Exception e) {
            return "Invalid padding structure";
        }
    }
}
