package com.amarvote.amarvote.service;

import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthRateLimitService {

    public static final String SCOPE_OTP_LOGIN_SEND = "otp-login-send";
    public static final String SCOPE_EMAIL_VERIFY_SEND = "email-verify-send";
    public static final String SCOPE_PASSWORD_RESET_SEND = "password-reset-send";

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCKOUT_MINUTES = 15;
    private static final long ATTEMPT_WINDOW_MINUTES = 15;

    @Value("${amarvote.otp.send-cooldown-seconds:300}")
    private long otpSendCooldownSeconds;

    @Value("${amarvote.otp.daily-limit-per-email:10}")
    private int otpDailyLimitPerEmail;

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

    public void ensureOtpDailyLimit(String scope, String email) {
        String normalized = normalize(email);
        if (normalized.isBlank()) {
            return;
        }

        String dailyKey = otpSendDailyKey(scope, normalized);
        String countValue = stringRedisTemplate.opsForValue().get(dailyKey);
        int count = countValue == null ? 0 : Integer.parseInt(countValue);
        if (count >= otpDailyLimitPerEmail) {
            throw new AuthRateLimitExceededException(
                    "Daily verification code limit reached. Please try again tomorrow.",
                    3600);
        }
    }

    public void ensureOtpSendCooldown(String scope, String email) {
        String normalized = normalize(email);
        if (normalized.isBlank()) {
            return;
        }

        String cooldownKey = otpSendCooldownKey(scope, normalized);
        if (Boolean.TRUE.equals(stringRedisTemplate.hasKey(cooldownKey))) {
            Long retryAfter = stringRedisTemplate.getExpire(cooldownKey, TimeUnit.SECONDS);
            int seconds = retryAfter != null && retryAfter > 0 ? retryAfter.intValue() : (int) otpSendCooldownSeconds;
            throw new AuthRateLimitExceededException(
                    "Please wait before requesting another verification code.",
                    seconds);
        }
    }

    public boolean isOnOtpSendCooldown(String scope, String email) {
        String normalized = normalize(email);
        if (normalized.isBlank()) {
            return false;
        }
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(otpSendCooldownKey(scope, normalized)));
    }

    public void recordOtpSend(String scope, String email) {
        String normalized = normalize(email);
        if (normalized.isBlank()) {
            return;
        }

        String cooldownKey = otpSendCooldownKey(scope, normalized);
        stringRedisTemplate.opsForValue().set(cooldownKey, "1", otpSendCooldownSeconds, TimeUnit.SECONDS);

        String dailyKey = otpSendDailyKey(scope, normalized);
        Long count = stringRedisTemplate.opsForValue().increment(dailyKey);
        if (count != null && count == 1L) {
            stringRedisTemplate.expire(dailyKey, 24, TimeUnit.HOURS);
        }
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String failKey(String scope, String identifier) {
        return "auth:fail:" + scope + ":" + identifier.trim().toLowerCase();
    }

    private static String lockKey(String scope, String identifier) {
        return "auth:lock:" + scope + ":" + identifier.trim().toLowerCase();
    }

    private static String otpSendCooldownKey(String scope, String email) {
        return "auth:otp-send:cooldown:" + scope + ":" + email;
    }

    private static String otpSendDailyKey(String scope, String email) {
        return "auth:otp-send:daily:" + scope + ":" + email;
    }

    public static class AuthRateLimitExceededException extends RuntimeException {
        private final int retryAfterSeconds;

        public AuthRateLimitExceededException(String message) {
            this(message, 900);
        }

        public AuthRateLimitExceededException(String message, int retryAfterSeconds) {
            super(message);
            this.retryAfterSeconds = Math.max(retryAfterSeconds, 1);
        }

        public int getRetryAfterSeconds() {
            return retryAfterSeconds;
        }
    }
}
