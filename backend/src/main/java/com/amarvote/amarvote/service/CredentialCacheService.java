package com.amarvote.amarvote.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Service for securely caching guardian credentials temporarily in Redis.
 * 
 * This service provides a secure alternative to storing sensitive cryptographic
 * materials (private keys, polynomials) in the database. Redis stores data in memory
 * with automatic expiration, making it ideal for temporary sensitive data.
 * 
 * Security Features:
 * - In-memory storage (not persisted to disk by default)
 * - Automatic expiration via TTL (Time To Live)
 * - No database breach exposure risk
 * - Credentials automatically removed after use or timeout
 * 
 * Industry Use Cases:
 * - Session tokens and temporary authentication data
 * - Two-factor authentication codes
 * - Rate limiting and throttling
 * - Distributed locks and semaphores
 * - Temporary cryptographic materials (this use case)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CredentialCacheService {

    private final RedisTemplate<String, String> redisTemplate;
    
    // TTL for credentials: 6 hours (sufficient for long-running decryption processes)
    private static final long CREDENTIAL_TTL_MINUTES = 360;
    
    // Key prefixes for different credential types
    private static final String PRIVATE_KEY_PREFIX = "guardian:privatekey:";
    private static final String POLYNOMIAL_PREFIX = "guardian:polynomial:";

    /**
     * Store guardian's decrypted private key temporarily.
     * 
     * @param electionId Election identifier
     * @param guardianId Guardian identifier
     * @param decryptedPrivateKey The decrypted private key
     */
    public void storePrivateKey(Long electionId, Long guardianId, String decryptedPrivateKey) {
        String key = buildPrivateKeyKey(electionId, guardianId);
        try {
            redisTemplate.opsForValue().set(
                key, 
                decryptedPrivateKey, 
                CREDENTIAL_TTL_MINUTES, 
                TimeUnit.MINUTES
            );
            log.info("Stored private key in Redis for election {} guardian {} with TTL {}m", 
                electionId, guardianId, CREDENTIAL_TTL_MINUTES);
        } catch (Exception e) {
            log.error("Failed to store private key in Redis for election {} guardian {}", 
                electionId, guardianId, e);
            throw new RuntimeException("Failed to cache credentials securely", e);
        }
    }

    /**
     * Store guardian's decrypted polynomial coefficients temporarily.
     * 
     * @param electionId Election identifier
     * @param guardianId Guardian identifier
     * @param decryptedPolynomial The decrypted polynomial coefficients
     */
    public void storePolynomial(Long electionId, Long guardianId, String decryptedPolynomial) {
        String key = buildPolynomialKey(electionId, guardianId);
        try {
            redisTemplate.opsForValue().set(
                key, 
                decryptedPolynomial, 
                CREDENTIAL_TTL_MINUTES, 
                TimeUnit.MINUTES
            );
            log.info("Stored polynomial in Redis for election {} guardian {} with TTL {}m", 
                electionId, guardianId, CREDENTIAL_TTL_MINUTES);
        } catch (Exception e) {
            log.error("Failed to store polynomial in Redis for election {} guardian {}", 
                electionId, guardianId, e);
            throw new RuntimeException("Failed to cache credentials securely", e);
        }
    }

    /**
     * Retrieve guardian's decrypted private key from cache.
     * 
     * @param electionId Election identifier
     * @param guardianId Guardian identifier
     * @return The decrypted private key, or null if not found/expired
     */
    public String getPrivateKey(Long electionId, Long guardianId) {
        String key = buildPrivateKeyKey(electionId, guardianId);
        try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null) {
                log.info("Retrieved private key from Redis for election {} guardian {}", 
                    electionId, guardianId);
            } else {
                log.warn("Private key not found or expired in Redis for election {} guardian {}", 
                    electionId, guardianId);
            }
            return value;
        } catch (Exception e) {
            log.error("Failed to retrieve private key from Redis for election {} guardian {}", 
                electionId, guardianId, e);
            return null;
        }
    }

    /**
     * Retrieve guardian's decrypted polynomial from cache.
     * 
     * @param electionId Election identifier
     * @param guardianId Guardian identifier
     * @return The decrypted polynomial, or null if not found/expired
     */
    public String getPolynomial(Long electionId, Long guardianId) {
        String key = buildPolynomialKey(electionId, guardianId);
        try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null) {
                log.info("Retrieved polynomial from Redis for election {} guardian {}", 
                    electionId, guardianId);
            } else {
                log.warn("Polynomial not found or expired in Redis for election {} guardian {}", 
                    electionId, guardianId);
            }
            return value;
        } catch (Exception e) {
            log.error("Failed to retrieve polynomial from Redis for election {} guardian {}", 
                electionId, guardianId, e);
            return null;
        }
    }

    /**
     * Clear guardian's credentials from cache after use.
     * This is a security best practice to minimize credential exposure time.
     * 
     * @param electionId Election identifier
     * @param guardianId Guardian identifier
     */
    public void clearCredentials(Long electionId, Long guardianId) {
        String privateKeyKey = buildPrivateKeyKey(electionId, guardianId);
        String polynomialKey = buildPolynomialKey(electionId, guardianId);
        
        try {
            redisTemplate.delete(privateKeyKey);
            redisTemplate.delete(polynomialKey);
            log.info("Cleared credentials from Redis for election {} guardian {}", 
                electionId, guardianId);
        } catch (Exception e) {
            log.error("Failed to clear credentials from Redis for election {} guardian {}", 
                electionId, guardianId, e);
            // Don't throw - credentials will expire automatically via TTL
        }
    }

    /**
     * Check if credentials exist in cache for a guardian.
     * 
     * @param electionId Election identifier
     * @param guardianId Guardian identifier
     * @return true if both private key and polynomial exist
     */
    public boolean hasCredentials(Long electionId, Long guardianId) {
        String privateKeyKey = buildPrivateKeyKey(electionId, guardianId);
        String polynomialKey = buildPolynomialKey(electionId, guardianId);
        
        try {
            Boolean hasPrivateKey = redisTemplate.hasKey(privateKeyKey);
            Boolean hasPolynomial = redisTemplate.hasKey(polynomialKey);
            return Boolean.TRUE.equals(hasPrivateKey) && Boolean.TRUE.equals(hasPolynomial);
        } catch (Exception e) {
            log.error("Failed to check credentials in Redis for election {} guardian {}", 
                electionId, guardianId, e);
            return false;
        }
    }

    // Key building helpers
    private String buildPrivateKeyKey(Long electionId, Long guardianId) {
        return PRIVATE_KEY_PREFIX + electionId + ":" + guardianId;
    }

    private String buildPolynomialKey(Long electionId, Long guardianId) {
        return POLYNOMIAL_PREFIX + electionId + ":" + guardianId;
    }
}
