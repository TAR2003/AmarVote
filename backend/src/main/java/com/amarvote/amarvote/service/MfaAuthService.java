package com.amarvote.amarvote.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
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
    private final AuthorizedUserService authorizedUserService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

    @Transactional
    @SuppressWarnings("null")
    public Map<String, Object> registerAndStartMfaSetup(String email, String password, String emailVerificationToken, boolean enableMfa) {
        String normalizedEmail = email.trim().toLowerCase();

        authorizedUserService.ensureAllowedForRegistration(normalizedEmail);

        Optional<String> verifiedEmailOpt = tempJwtService.extractEmailIfValidVerifiedEmailToken(emailVerificationToken);
        if (verifiedEmailOpt.isEmpty() || !normalizedEmail.equals(verifiedEmailOpt.get())) {
            throw new IllegalArgumentException("Email verification is required");
        }

        if (appUserRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("User already exists");
        }

        AppUser user = AppUser.builder()
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(password))
            .mfaSecret(null)
                .isMfaEnabled(false)
                .mfaRegistered(false)
                .build();

        appUserRepository.save(Objects.requireNonNull(user));
        authorizedUserService.markRegistered(normalizedEmail);

        if (!enableMfa) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "REGISTERED_NO_MFA");
            response.put("token", jwtService.generateJWTToken(normalizedEmail));
            response.put("message", "Registration complete. You can enable 2FA later from Profile.");
            return response;
        }

        String secret = totpService.generateSecret();
        user.setMfaSecret(secret);
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
        authorizedUserService.markRegistered(normalizedEmail);

        emailService.sendSignupVerificationEmail(normalizedEmail, "Welcome! 2FA is successfully enabled");

        return Optional.of(jwtService.generateJWTToken(normalizedEmail));
    }

    public Optional<Map<String, Object>> loginStepOne(String email, String password) {
        String normalizedEmail = email.trim().toLowerCase();
        authorizedUserService.ensureAllowedForLogin(normalizedEmail);
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
            response.put("status", "LOGIN_SUCCESS");
            response.put("token", jwtService.generateJWTToken(normalizedEmail));
            authorizedUserService.markSuccessfulLogin(normalizedEmail);
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

        authorizedUserService.markSuccessfulLogin(email);

        return Optional.of(jwtService.generateJWTToken(email));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getProfileSettings(String email) {
        String normalizedEmail = email.trim().toLowerCase();
        AppUser user = appUserRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("email", user.getEmail());
        profile.put("mfaEnabled", Boolean.TRUE.equals(user.getIsMfaEnabled()));
        profile.put("mfaRegistered", Boolean.TRUE.equals(user.getMfaRegistered()));
        return profile;
    }

    @Transactional
    public void changePassword(String email, String currentPassword, String newPassword) {
        String normalizedEmail = email.trim().toLowerCase();
        AppUser user = appUserRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        appUserRepository.save(user);
    }

    @Transactional
    public Map<String, Object> startProfileMfaSetup(String email) {
        String normalizedEmail = email.trim().toLowerCase();
        AppUser user = appUserRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String secret = totpService.generateSecret();
        user.setMfaSecret(secret);
        user.setIsMfaEnabled(false);
        user.setMfaRegistered(false);
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
    public boolean confirmProfileMfaSetup(String email, String totpCode) {
        String normalizedEmail = email.trim().toLowerCase();
        Optional<AppUser> userOpt = appUserRepository.findByEmail(normalizedEmail);
        if (userOpt.isEmpty()) {
            return false;
        }

        AppUser user = userOpt.get();
        if (user.getMfaSecret() == null || !totpService.verifyCode(user.getMfaSecret(), totpCode)) {
            return false;
        }

        user.setMfaRegistered(true);
        user.setIsMfaEnabled(true);
        appUserRepository.save(user);
        return true;
    }

    @Transactional
    public void disableProfileMfa(String email) {
        String normalizedEmail = email.trim().toLowerCase();
        AppUser user = appUserRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setIsMfaEnabled(false);
        user.setMfaRegistered(false);
        user.setMfaSecret(null);
        appUserRepository.save(user);
    }

    @Transactional
    public void resetPasswordWithToken(String resetToken, String newPassword) {
        Optional<String> emailOpt = tempJwtService.extractEmailIfValidPasswordResetToken(resetToken);
        if (emailOpt.isEmpty()) {
            throw new IllegalArgumentException("Invalid or expired reset token");
        }

        String normalizedEmail = emailOpt.get().trim().toLowerCase();
        AppUser user = appUserRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        appUserRepository.save(user);
    }
}
