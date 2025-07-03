package com.amarvote.amarvote.utils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;

public class VoterIdGenerator {

    private static final String APP_SALT = "AmarVote2024SecureVoting";

    /**
     * Generate a unique ballot hash ID using SHA-256 hash
     * Combines user ID, election ID, and application salt for security
     * 
     * @param userId The user ID of the voter
     * @param electionId The election ID
     * @return A unique SHA-256 hash as ballot ID
     */
    public static String generateBallotHashId(Integer userId, Long electionId) {
        String combined = APP_SALT + ":" + userId + ":" + electionId + ":" + System.currentTimeMillis();
        return sha256Hex(combined);
    }

    /**
     * Generate a simple SHA-256 hash for ballot ID
     * 
     * @param userId The user ID of the voter
     * @param electionId The election ID
     * @return A SHA-256 hash as ballot ID
     */
    public static String generateSimpleBallotHashId(Integer userId, Long electionId) {
        String combined = userId + ":" + electionId;
        return sha256Hex(combined);
    }

    /**
     * Generate a deterministic UUID approach for ballot ID
     * 
     * @param userId The user ID of the voter
     * @param electionId The election ID
     * @return A deterministic UUID as ballot ID
     */
    public static String generateDeterministicBallotId(Integer userId, Long electionId) {
        String combined = "voter-" + userId + "-election-" + electionId;
        return UUID.nameUUIDFromBytes(combined.getBytes()).toString();
    }

    /**
     * Convert string to SHA-256 hex string
     * 
     * @param input The input string to hash
     * @return SHA-256 hex string
     */
    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            
            // Convert bytes to hex string
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
