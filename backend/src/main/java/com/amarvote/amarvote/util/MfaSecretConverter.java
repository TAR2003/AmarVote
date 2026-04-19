package com.amarvote.amarvote.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Component
@Converter
public class MfaSecretConverter implements AttributeConverter<String, String> {

    private static String masterKey;

    @Value("${MASTER_KEY_PQ}")
    public void setMasterKey(String key) {
        masterKey = key;
    }

    private SecretKeySpec getKey() throws Exception {
        if (masterKey == null || masterKey.isBlank()) {
            throw new IllegalStateException("MASTER_KEY_PQ is missing for MFA secret encryption");
        }

        byte[] keyBytes = masterKey.getBytes(StandardCharsets.UTF_8);
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        byte[] digest = sha.digest(keyBytes);
        return new SecretKeySpec(digest, "AES");
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.isBlank()) {
            return attribute;
        }

        try {
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, getKey());
            byte[] encrypted = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt MFA secret", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return dbData;
        }

        try {
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, getKey());
            byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(dbData));
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Legacy fallback: old rows may still contain plaintext Base32 secrets.
            return dbData;
        }
    }
}
