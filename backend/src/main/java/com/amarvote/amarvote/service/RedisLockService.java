package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.LockMetadata;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

/**
 * Redis-based distributed lock service with metadata support.
 * Prevents redundant operations and tracks who initiated tasks.
 */
@Service
@RequiredArgsConstructor
public class RedisLockService {
    
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    
    // Default lock expiration: 2 hours (safely longer than any expected operation)
    private static final long DEFAULT_LOCK_EXPIRATION_SECONDS = 7200;
    
    /**
     * Try to acquire a lock with metadata.
     * Returns true if lock was successfully acquired, false if already locked.
     * 
     * @param lockKey Unique identifier for the lock
     * @param userEmail Email of user initiating the operation
     * @param operationType Type of operation being performed
     * @param context Additional context information
     * @return true if lock acquired, false if already locked
     */
    public boolean tryAcquireLock(String lockKey, String userEmail, String operationType, String context) {
        return tryAcquireLock(lockKey, userEmail, operationType, context, DEFAULT_LOCK_EXPIRATION_SECONDS);
    }
    
    /**
     * Try to acquire a lock with metadata and custom expiration.
     * 
     * @param lockKey Unique identifier for the lock
     * @param userEmail Email of user initiating the operation
     * @param operationType Type of operation being performed
     * @param context Additional context information
     * @param expirationSeconds Lock expiration time in seconds
     * @return true if lock acquired, false if already locked
     */
    public boolean tryAcquireLock(String lockKey, String userEmail, String operationType, 
                                  String context, long expirationSeconds) {
        try {
            // Create lock metadata
            LockMetadata metadata = LockMetadata.builder()
                .lockKey(lockKey)
                .userEmail(userEmail)
                .startTime(Instant.now())
                .operationType(operationType)
                .context(context)
                .build();
            
            String metadataJson = objectMapper.writeValueAsString(metadata);
            
            // Try to set the key only if it doesn't exist (NX option)
            Boolean success = redisTemplate.opsForValue()
                .setIfAbsent(lockKey, metadataJson, expirationSeconds, TimeUnit.SECONDS);
            
            if (Boolean.TRUE.equals(success)) {
                System.out.println("🔒 Lock acquired: " + lockKey);
                System.out.println("   User: " + userEmail);
                System.out.println("   Operation: " + operationType);
                System.out.println("   Start time: " + metadata.getStartTime());
                return true;
            } else {
                System.out.println("⚠️ Lock already held: " + lockKey);
                return false;
            }
        } catch (Exception e) {
            System.err.println("❌ Error acquiring lock: " + e.getMessage());
            // In case of Redis error, fail safe by returning false (don't acquire lock)
            return false;
        }
    }
    
    /**
     * Get metadata for an existing lock.
     * Returns empty if lock doesn't exist.
     * 
     * @param lockKey Lock identifier
     * @return LockMetadata if lock exists, empty otherwise
     */
    public Optional<LockMetadata> getLockMetadata(String lockKey) {
        try {
            String metadataJson = redisTemplate.opsForValue().get(lockKey);
            if (metadataJson == null) {
                return Optional.empty();
            }
            
            LockMetadata metadata = objectMapper.readValue(metadataJson, LockMetadata.class);
            return Optional.of(metadata);
        } catch (Exception e) {
            System.err.println("❌ Error reading lock metadata: " + e.getMessage());
            return Optional.empty();
        }
    }
    
    /**
     * Release a lock.
     * 
     * @param lockKey Lock identifier
     * @return true if lock was released, false if it didn't exist
     */
    public boolean releaseLock(String lockKey) {
        try {
            Boolean deleted = redisTemplate.delete(lockKey);
            if (Boolean.TRUE.equals(deleted)) {
                System.out.println("🔓 Lock released: " + lockKey);
                return true;
            } else {
                System.out.println("⚠️ Lock not found when trying to release: " + lockKey);
                return false;
            }
        } catch (Exception e) {
            System.err.println("❌ Error releasing lock: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Check if a lock exists without retrieving metadata.
     * 
     * @param lockKey Lock identifier
     * @return true if lock exists, false otherwise
     */
    public boolean isLocked(String lockKey) {
        try {
            Boolean exists = redisTemplate.hasKey(lockKey);
            return Boolean.TRUE.equals(exists);
        } catch (Exception e) {
            System.err.println("❌ Error checking lock existence: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Get remaining time until lock expires.
     * 
     * @param lockKey Lock identifier
     * @return Remaining time in seconds, or -1 if lock doesn't exist
     */
    public long getRemainingTime(String lockKey) {
        try {
            Long ttl = redisTemplate.getExpire(lockKey, TimeUnit.SECONDS);
            return ttl != null ? ttl : -1;
        } catch (Exception e) {
            System.err.println("❌ Error getting lock TTL: " + e.getMessage());
            return -1;
        }
    }
    
    /**
     * Extend lock expiration time.
     * 
     * @param lockKey Lock identifier
     * @param additionalSeconds Additional seconds to add to expiration
     * @return true if successful, false otherwise
     */
    public boolean extendLock(String lockKey, long additionalSeconds) {
        try {
            long currentTtl = getRemainingTime(lockKey);
            if (currentTtl > 0) {
                Boolean success = redisTemplate.expire(lockKey, currentTtl + additionalSeconds, TimeUnit.SECONDS);
                if (Boolean.TRUE.equals(success)) {
                    System.out.println("⏰ Lock extended: " + lockKey + " (+" + additionalSeconds + "s)");
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            System.err.println("❌ Error extending lock: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Build a lock key for tally creation.
     * 
     * @param electionId Election ID
     * @return Lock key string
     */
    public static String buildTallyLockKey(Long electionId) {
        return "lock:tally:election:" + electionId;
    }
    
    /**
     * Build a lock key for guardian decryption.
     * 
     * @param electionId Election ID
     * @param guardianId Guardian ID
     * @return Lock key string
     */
    public static String buildDecryptionLockKey(Long electionId, String guardianId) {
        return "lock:decryption:election:" + electionId + ":guardian:" + guardianId;
    }
    
    /**
     * Build a lock key for combine decryption shares.
     * 
     * @param electionId Election ID
     * @return Lock key string
     */
    public static String buildCombineLockKey(Long electionId) {
        return "lock:combine:election:" + electionId;
    }

    // =========================================================================
    // Atomic counter helpers — used to detect phase completion without races
    // =========================================================================

    /**
     * Atomically increment a counter and return the new value.
     * Sets a TTL on the very first increment so stale counters are auto-cleaned.
     *
     * @param key              Redis key for the counter
     * @param expirationSeconds TTL to set on first creation
     * @return new counter value, or -1 if Redis is unavailable
     */
    public long incrementCounter(String key, long expirationSeconds) {
        try {
            Long newValue = redisTemplate.opsForValue().increment(key);
            if (Long.valueOf(1L).equals(newValue)) {
                // First increment — set expiration so orphaned counters clean themselves up
                redisTemplate.expire(key, expirationSeconds, TimeUnit.SECONDS);
            }
            return newValue != null ? newValue : 0L;
        } catch (Exception e) {
            System.err.println("❌ Error incrementing Redis counter [" + key + "]: " + e.getMessage());
            return -1L;
        }
    }

    /**
     * Atomically set a flag key only if it does not already exist (SET NX).
     * Returns true if this caller is the first to set it ("wins" the trigger slot).
     * Used as a one-shot trigger guard to prevent duplicate phase transitions.
     *
     * @param key              Redis key for the flag
     * @param expirationSeconds TTL so orphaned flags are auto-cleaned
     * @return true if the flag was newly set by this call; false if already existed
     */
    public boolean setFlagIfAbsent(String key, long expirationSeconds) {
        try {
            Boolean set = redisTemplate.opsForValue().setIfAbsent(key, "1", expirationSeconds, TimeUnit.SECONDS);
            return Boolean.TRUE.equals(set);
        } catch (Exception e) {
            System.err.println("❌ Error setting Redis flag [" + key + "]: " + e.getMessage());
            return false;
        }
    }

    /**
     * Clear a counter or flag key created by this service.
     */
    public void deleteKey(String key) {
        try {
            redisTemplate.delete(key);
        } catch (Exception e) {
            System.err.println("❌ Error deleting Redis key [" + key + "]: " + e.getMessage());
        }
    }

    // ---- Static key builders for progress counters ----

    /** Redis counter key: how many partial-decryption chunks completed for a guardian */
    public static String buildPhase1CounterKey(Long electionId, Long guardianId) {
        return "counter:partial_decryption:" + electionId + ":" + guardianId;
    }

    /** Redis flag key: Phase-2 (compensated decryption) already triggered for a guardian */
    public static String buildPhase1TriggerKey(Long electionId, Long guardianId) {
        return "trigger:compensated_queued:" + electionId + ":" + guardianId;
    }

    /** Redis counter key: how many compensated-decryption chunks completed for a guardian */
    public static String buildPhase2CounterKey(Long electionId, Long guardianId) {
        return "counter:compensated_decryption:" + electionId + ":" + guardianId;
    }

    /** Redis flag key: guardian already marked as decrypted */
    public static String buildPhase2TriggerKey(Long electionId, Long guardianId) {
        return "trigger:guardian_marked:" + electionId + ":" + guardianId;
    }
}
