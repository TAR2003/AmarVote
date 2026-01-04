package com.amarvote.amarvote.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.OtpVerification;
import com.amarvote.amarvote.repository.OtpVerificationRepository;
import com.amarvote.amarvote.util.JwtUtil;

@Service
public class OtpAuthService {

    @Autowired
    private OtpVerificationRepository otpVerificationRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private JwtUtil jwtUtil;

    private static final SecureRandom random = new SecureRandom();
    private static final int OTP_VALIDITY_MINUTES = 5;

    /**
     * Generate a 6-digit OTP code
     */
    private String generateOtpCode() {
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    /**
     * Send OTP to user email
     * @param userEmail User email address
     * @return true if OTP sent successfully
     */
    @Transactional
    public boolean sendOtp(String userEmail) {
        try {
            // Delete any existing OTPs for this email
            otpVerificationRepository.deleteByUserEmail(userEmail);

            // Generate new OTP
            String otpCode = generateOtpCode();
            Instant now = Instant.now();
            Instant expiresAt = now.plus(OTP_VALIDITY_MINUTES, ChronoUnit.MINUTES);

            // Save OTP to database
            OtpVerification otp = OtpVerification.builder()
                    .userEmail(userEmail)
                    .otpCode(otpCode)
                    .createdAt(now)
                    .expiresAt(expiresAt)
                    .isUsed(false)
                    .build();

            otpVerificationRepository.save(otp);

            // Send OTP email
            emailService.sendOtpEmail(userEmail, otpCode);

            System.out.println("✅ OTP sent to: " + userEmail);
            return true;

        } catch (Exception e) {
            System.err.println("❌ Failed to send OTP to " + userEmail + ": " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Verify OTP and generate JWT token
     * @param userEmail User email address
     * @param otpCode OTP code to verify
     * @return JWT token if verification successful, empty otherwise
     */
    @Transactional
    public Optional<String> verifyOtpAndGenerateToken(String userEmail, String otpCode) {
        Instant now = Instant.now();

        Optional<OtpVerification> otpOpt = otpVerificationRepository
                .findByUserEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfter(userEmail, otpCode, now);

        if (otpOpt.isEmpty()) {
            System.out.println("❌ Invalid or expired OTP for: " + userEmail);
            return Optional.empty();
        }

        // Mark OTP as used
        OtpVerification otp = otpOpt.get();
        otp.setIsUsed(true);
        otpVerificationRepository.save(otp);

        // Generate JWT token
        String token = jwtUtil.generateToken(userEmail);

        System.out.println("✅ OTP verified and token generated for: " + userEmail);
        return Optional.of(token);
    }
}
