package com.amarvote.amarvote.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.OtpSendResult;
import com.amarvote.amarvote.model.OtpVerification;
import com.amarvote.amarvote.repository.OtpVerificationRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int CODE_VALIDITY_MINUTES = 10;

    private final OtpVerificationRepository otpVerificationRepository;
    private final EmailService emailService;
    private final TempJwtService tempJwtService;
    private final AuthRateLimitService authRateLimitService;

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String generateCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    @Transactional
    @SuppressWarnings("null")
    public OtpSendResult sendEmailVerificationCode(String email) {
        return sendCode(
                normalizeEmail(email),
                AuthRateLimitService.SCOPE_EMAIL_VERIFY_SEND,
                (normalizedEmail, code) -> emailService.sendSignupVerificationEmail(normalizedEmail, code));
    }

    @Transactional
    @SuppressWarnings("null")
    public OtpSendResult sendPasswordResetCode(String email) {
        return sendCode(
                normalizeEmail(email),
                AuthRateLimitService.SCOPE_PASSWORD_RESET_SEND,
                (normalizedEmail, code) -> emailService.sendPasswordResetCodeEmail(normalizedEmail, code));
    }

    @Transactional
    public Optional<String> verifyEmailCodeAndIssueToken(String email, String code) {
        String normalizedEmail = normalizeEmail(email);
        authRateLimitService.ensureAllowed("email-verify", normalizedEmail);

        Optional<OtpVerification> verificationOpt = otpVerificationRepository
                .findByUserEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfter(normalizedEmail, code, Instant.now());

        if (verificationOpt.isEmpty()) {
            authRateLimitService.recordFailure("email-verify", normalizedEmail);
            return Optional.empty();
        }

        OtpVerification verification = verificationOpt.get();
        verification.setIsUsed(true);
        otpVerificationRepository.save(verification);
        authRateLimitService.resetFailures("email-verify", normalizedEmail);

        return Optional.of(tempJwtService.generateEmailVerificationToken(normalizedEmail));
    }

    @Transactional
    public Optional<String> verifyPasswordResetCodeAndIssueToken(String email, String code) {
        String normalizedEmail = normalizeEmail(email);
        authRateLimitService.ensureAllowed("password-reset-verify", normalizedEmail);

        Optional<OtpVerification> verificationOpt = otpVerificationRepository
                .findByUserEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfter(normalizedEmail, code, Instant.now());

        if (verificationOpt.isEmpty()) {
            authRateLimitService.recordFailure("password-reset-verify", normalizedEmail);
            return Optional.empty();
        }

        OtpVerification verification = verificationOpt.get();
        verification.setIsUsed(true);
        otpVerificationRepository.save(verification);
        authRateLimitService.resetFailures("password-reset-verify", normalizedEmail);

        return Optional.of(tempJwtService.generatePasswordResetToken(normalizedEmail));
    }

    private OtpSendResult sendCode(String normalizedEmail, String scope, EmailCodeSender sender) {
        try {
            authRateLimitService.ensureOtpDailyLimit(scope, normalizedEmail);

            Instant now = Instant.now();
            Optional<OtpVerification> activeCode = otpVerificationRepository
                    .findFirstByUserEmailAndIsUsedFalseAndExpiresAtAfter(normalizedEmail, now);

            if (activeCode.isPresent()) {
                if (authRateLimitService.isOnOtpSendCooldown(scope, normalizedEmail)) {
                    return OtpSendResult.alreadySent(
                            "A verification code was already sent to your email. Please check your inbox or wait before requesting another.");
                }

                String existingCode = activeCode.get().getOtpCode();
                sender.send(normalizedEmail, existingCode);
                authRateLimitService.recordOtpSend(scope, normalizedEmail);
                return OtpSendResult.resent("Verification code resent to your email.");
            }

            authRateLimitService.ensureOtpSendCooldown(scope, normalizedEmail);

            String code = generateCode();
            OtpVerification verification = OtpVerification.builder()
                    .userEmail(normalizedEmail)
                    .otpCode(code)
                    .createdAt(now)
                    .expiresAt(now.plus(CODE_VALIDITY_MINUTES, ChronoUnit.MINUTES))
                    .isUsed(false)
                    .build();

            otpVerificationRepository.save(Objects.requireNonNull(verification));
            sender.send(normalizedEmail, code);
            authRateLimitService.recordOtpSend(scope, normalizedEmail);

            return OtpSendResult.sent("Verification code sent to your email.");
        } catch (AuthRateLimitService.AuthRateLimitExceededException ex) {
            throw ex;
        } catch (Exception ex) {
            return OtpSendResult.failed("Failed to send verification code. Please try again.");
        }
    }

    @FunctionalInterface
    private interface EmailCodeSender {
        void send(String email, String code);
    }
}
