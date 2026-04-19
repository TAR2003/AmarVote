package com.amarvote.amarvote.config;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.AppUser;
import com.amarvote.amarvote.repository.AppUserRepository;
import com.amarvote.amarvote.util.MfaSecretConverter;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class MfaAutoEncryptionScanner implements CommandLineRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(MfaAutoEncryptionScanner.class);

    private final AppUserRepository appUserRepository;
    private final MfaSecretConverter mfaSecretConverter;

    @Override
    @Transactional
    public void run(String... args) {
        LOGGER.info("Scanning database for plaintext 2FA secrets...");

        List<AppUser> unencryptedUsers = appUserRepository.findUsersWithPlaintextMfaSecrets();
        if (unencryptedUsers.isEmpty()) {
            LOGGER.info("All 2FA secrets are already encrypted.");
            return;
        }

        LOGGER.warn("Found {} plaintext 2FA secrets. Upgrading now...", unencryptedUsers.size());

        int updatedCount = 0;
        for (AppUser user : unencryptedUsers) {
            if (user.getUserId() == null || user.getMfaSecret() == null || user.getMfaSecret().isBlank()) {
                continue;
            }

            String encryptedSecret = mfaSecretConverter.convertToDatabaseColumn(user.getMfaSecret());
            updatedCount += appUserRepository.updateMfaSecretRaw(user.getUserId(), encryptedSecret);
        }

        LOGGER.info("Startup migration complete. Upgraded {} MFA secrets.", updatedCount);
    }
}
