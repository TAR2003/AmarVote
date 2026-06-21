package com.amarvote.amarvote.service;

import java.util.concurrent.TimeUnit;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthRateLimitService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCKOUT_MINUTES = 15;
    private static final long ATTEMPT_WINDOW_MINUTES = 15;

    private final StringRedisTemplate stringRedisTemplate;

    public void ensureAllowed(String scope, String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return;
        }
        String lockKey = lockKey(scope, identifier);
        if (Boolean.TRUE.equals(stringRedisTemplate.hasKey(lockKey))) {
            throw new AuthRateLimitExceededException(
                    "Too many failed attempts. Please try again in " + LOCKOUT_MINUTES + " minutes.");
        }
    }

    public void recordFailure(String scope, String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return;
        }
        String failKey = failKey(scope, identifier);
        Long count = stringRedisTemplate.opsForValue().increment(failKey);
        if (count != null && count == 1L) {
            stringRedisTemplate.expire(failKey, ATTEMPT_WINDOW_MINUTES, TimeUnit.MINUTES);
        }
        if (count != null && count >= MAX_ATTEMPTS) {
            stringRedisTemplate.opsForValue().set(
                    lockKey(scope, identifier), "1", LOCKOUT_MINUTES, TimeUnit.MINUTES);
        }
    }

    public void resetFailures(String scope, String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return;
        }
        stringRedisTemplate.delete(failKey(scope, identifier));
        stringRedisTemplate.delete(lockKey(scope, identifier));
    }

    private static String failKey(String scope, String identifier) {
        return "auth:fail:" + scope + ":" + identifier.trim().toLowerCase();
    }

    private static String lockKey(String scope, String identifier) {
        return "auth:lock:" + scope + ":" + identifier.trim().toLowerCase();
    }

    public static class AuthRateLimitExceededException extends RuntimeException {
        public AuthRateLimitExceededException(String message) {
            super(message);
        }
    }
}
