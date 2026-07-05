package com.amarvote.amarvote.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.OtpSendResult;
import com.amarvote.amarvote.model.OtpVerification;
import com.amarvote.amarvote.repository.OtpVerificationRepository;
import com.amarvote.amarvote.util.JwtUtil;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OtpAuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int OTP_VALIDITY_MINUTES = 5;

    private final OtpVerificationRepository otpVerificationRepository;
    private final EmailService emailService;
    private final JwtUtil jwtUtil;
    private final AuthRateLimitService authRateLimitService;

    private String generateOtpCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public OtpSendResult sendOtp(String userEmail) {
        String normalizedEmail = normalizeEmail(userEmail);
        String scope = AuthRateLimitService.SCOPE_OTP_LOGIN_SEND;

        try {
            authRateLimitService.ensureOtpDailyLimit(scope, normalizedEmail);

            Instant now = Instant.now();
            Optional<OtpVerification> activeOtp = otpVerificationRepository
                    .findFirstByUserEmailAndIsUsedFalseAndExpiresAtAfter(normalizedEmail, now);

            if (activeOtp.isPresent()) {
                if (authRateLimitService.isOnOtpSendCooldown(scope, normalizedEmail)) {
                    return OtpSendResult.alreadySent(
                            "A verification code was already sent to your email. Please check your inbox or wait before requesting another.");
                }

                String existingCode = activeOtp.get().getOtpCode();
                emailService.sendOtpEmail(normalizedEmail, existingCode);
                authRateLimitService.recordOtpSend(scope, normalizedEmail);
                return OtpSendResult.resent("Verification code resent to your email.");
            }

            authRateLimitService.ensureOtpSendCooldown(scope, normalizedEmail);

            String otpCode = generateOtpCode();
            Instant expiresAt = now.plus(OTP_VALIDITY_MINUTES, ChronoUnit.MINUTES);

            OtpVerification otp = OtpVerification.builder()
                    .userEmail(normalizedEmail)
                    .otpCode(otpCode)
                    .createdAt(now)
                    .expiresAt(expiresAt)
                    .isUsed(false)
                    .build();

            otpVerificationRepository.save(otp);
            emailService.sendOtpEmail(normalizedEmail, otpCode);
            authRateLimitService.recordOtpSend(scope, normalizedEmail);

            return OtpSendResult.sent("Verification code sent to your email.");
        } catch (AuthRateLimitService.AuthRateLimitExceededException ex) {
            throw ex;
        } catch (Exception ex) {
            return OtpSendResult.failed("Failed to send verification code. Please try again.");
        }
    }

    @Transactional
    public Optional<String> verifyOtpAndGenerateToken(String userEmail, String otpCode) {
        String normalizedEmail = normalizeEmail(userEmail);
        Instant now = Instant.now();

        Optional<OtpVerification> otpOpt = otpVerificationRepository
                .findByUserEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfter(normalizedEmail, otpCode, now);

        if (otpOpt.isEmpty()) {
            return Optional.empty();
        }

        OtpVerification otp = otpOpt.get();
        otp.setIsUsed(true);
        otpVerificationRepository.save(otp);

        return Optional.of(jwtUtil.generateToken(normalizedEmail));
    }
}
