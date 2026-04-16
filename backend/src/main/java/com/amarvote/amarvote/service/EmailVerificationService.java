package com.amarvote.amarvote.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    @SuppressWarnings("null")
    public void sendEmailVerificationCode(String email) {
        String normalizedEmail = email.trim().toLowerCase();

        otpVerificationRepository.deleteByUserEmail(normalizedEmail);

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        Instant now = Instant.now();

        OtpVerification verification = OtpVerification.builder()
                .userEmail(normalizedEmail)
                .otpCode(code)
                .createdAt(now)
                .expiresAt(now.plus(CODE_VALIDITY_MINUTES, ChronoUnit.MINUTES))
                .isUsed(false)
                .build();

        otpVerificationRepository.save(Objects.requireNonNull(verification));
        emailService.sendSignupVerificationEmail(normalizedEmail, code);
    }

    @Transactional
    @SuppressWarnings("null")
    public void sendPasswordResetCode(String email) {
        String normalizedEmail = email.trim().toLowerCase();

        otpVerificationRepository.deleteByUserEmail(normalizedEmail);

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        Instant now = Instant.now();

        OtpVerification verification = OtpVerification.builder()
                .userEmail(normalizedEmail)
                .otpCode(code)
                .createdAt(now)
                .expiresAt(now.plus(CODE_VALIDITY_MINUTES, ChronoUnit.MINUTES))
                .isUsed(false)
                .build();

        otpVerificationRepository.save(Objects.requireNonNull(verification));
        emailService.sendPasswordResetCodeEmail(normalizedEmail, code);
    }

    @Transactional
    public Optional<String> verifyEmailCodeAndIssueToken(String email, String code) {
        String normalizedEmail = email.trim().toLowerCase();

        Optional<OtpVerification> verificationOpt = otpVerificationRepository
                .findByUserEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfter(normalizedEmail, code, Instant.now());

        if (verificationOpt.isEmpty()) {
            return Optional.empty();
        }

        OtpVerification verification = verificationOpt.get();
        verification.setIsUsed(true);
        otpVerificationRepository.save(verification);

        return Optional.of(tempJwtService.generateEmailVerificationToken(normalizedEmail));
    }

    @Transactional
    public Optional<String> verifyPasswordResetCodeAndIssueToken(String email, String code) {
        String normalizedEmail = email.trim().toLowerCase();

        Optional<OtpVerification> verificationOpt = otpVerificationRepository
                .findByUserEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfter(normalizedEmail, code, Instant.now());

        if (verificationOpt.isEmpty()) {
            return Optional.empty();
        }

        OtpVerification verification = verificationOpt.get();
        verification.setIsUsed(true);
        otpVerificationRepository.save(verification);

        return Optional.of(tempJwtService.generatePasswordResetToken(normalizedEmail));
    }
}
