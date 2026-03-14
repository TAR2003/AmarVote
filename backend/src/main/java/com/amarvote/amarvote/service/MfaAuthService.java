package com.amarvote.amarvote.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.AppUser;
import com.amarvote.amarvote.repository.AppUserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MfaAuthService {

    private final AppUserRepository appUserRepository;
    private final TotpService totpService;
    private final TempJwtService tempJwtService;
    private final JWTService jwtService;
    private final EmailService emailService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

    @Transactional
    public Map<String, Object> registerAndStartMfaSetup(String email, String password) {
        String normalizedEmail = email.trim().toLowerCase();

        if (appUserRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("User already exists");
        }

        String secret = totpService.generateSecret();

        AppUser user = AppUser.builder()
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(password))
                .mfaSecret(secret)
                .isMfaEnabled(false)
                .mfaRegistered(false)
                .build();

        appUserRepository.save(user);

        String otpAuthUri = totpService.buildOtpAuthUri(normalizedEmail, secret);
        String qrCodeDataUri = totpService.generateQrCodeDataUri(otpAuthUri);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "MFA_SETUP_REQUIRED");
        response.put("qrCodeDataUri", qrCodeDataUri);
        response.put("secret", secret);
        return response;
    }

    @Transactional
    public Optional<String> confirmMfaSetup(String email, String totpCode) {
        String normalizedEmail = email.trim().toLowerCase();
        Optional<AppUser> userOpt = appUserRepository.findByEmail(normalizedEmail);
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }

        AppUser user = userOpt.get();
        if (user.getMfaSecret() == null) {
            return Optional.empty();
        }

        if (!totpService.verifyCode(user.getMfaSecret(), totpCode)) {
            return Optional.empty();
        }

        user.setMfaRegistered(true);
        user.setIsMfaEnabled(true);
        appUserRepository.save(user);

        emailService.sendSignupVerificationEmail(normalizedEmail, "Welcome! 2FA is successfully enabled");

        return Optional.of(jwtService.generateJWTToken(normalizedEmail));
    }

    public Optional<Map<String, Object>> loginStepOne(String email, String password) {
        String normalizedEmail = email.trim().toLowerCase();
        Optional<AppUser> userOpt = appUserRepository.findByEmail(normalizedEmail);

        if (userOpt.isEmpty()) {
            return Optional.empty();
        }

        AppUser user = userOpt.get();
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            return Optional.empty();
        }

        if (!Boolean.TRUE.equals(user.getIsMfaEnabled())) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "MFA_SETUP_REQUIRED");
            response.put("message", "MFA must be configured for this account");
            return Optional.of(response);
        }

        String tempToken = tempJwtService.generateMfaPendingToken(normalizedEmail);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "MFA_REQUIRED");
        response.put("tempToken", tempToken);
        return Optional.of(response);
    }

    @Transactional(readOnly = true)
    public Optional<String> verifyMfaAndIssueFinalToken(String tempToken, String totpCode) {
        Optional<String> emailOpt = tempJwtService.extractEmailIfValidMfaToken(tempToken);
        if (emailOpt.isEmpty()) {
            return Optional.empty();
        }

        String email = emailOpt.get();
        Optional<AppUser> userOpt = appUserRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }

        AppUser user = userOpt.get();
        if (!Boolean.TRUE.equals(user.getIsMfaEnabled()) || user.getMfaSecret() == null) {
            return Optional.empty();
        }

        boolean valid = totpService.verifyCode(user.getMfaSecret(), totpCode);
        if (!valid) {
            return Optional.empty();
        }

        return Optional.of(jwtService.generateJWTToken(email));
    }
}
