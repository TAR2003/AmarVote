package com.amarvote.amarvote.config;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

@Configuration
public class FirebaseAdminConfig {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseAdminConfig.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Value("${firebase.service-account.path}")
    private String serviceAccountPath;

    public synchronized boolean ensureInitialized() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return true;
        }

        try (InputStream serviceAccountStream = resolveServiceAccountStream()) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccountStream))
                    .build();

            FirebaseApp.initializeApp(options);
            logger.info("Firebase Admin initialized successfully");
            return true;
        } catch (Exception e) {
            logger.error("Firebase Admin initialization failed: {}", e.getMessage());
            return false;
        }
    }

    private InputStream resolveServiceAccountStream() throws IOException {
        String jsonB64 = getEnv("FIREBASE_SERVICE_ACCOUNT_JSON_B64");
        if (jsonB64 != null) {
            byte[] decoded = Base64.getDecoder().decode(jsonB64);
            logger.info("Using Firebase credentials from FIREBASE_SERVICE_ACCOUNT_JSON_B64");
            return new ByteArrayInputStream(decoded);
        }

        String rawJson = getEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
        if (rawJson != null) {
            logger.info("Using Firebase credentials from FIREBASE_SERVICE_ACCOUNT_JSON");
            return new ByteArrayInputStream(rawJson.getBytes(StandardCharsets.UTF_8));
        }

        InputStream envCredentialStream = resolveFromDiscreteEnvVars();
        if (envCredentialStream != null) {
            logger.info("Using Firebase credentials from discrete FIREBASE_* env vars");
            return envCredentialStream;
        }

        return resolveServiceAccountStreamFromPath(serviceAccountPath);
    }

    private InputStream resolveFromDiscreteEnvVars() throws IOException {
        String projectId = getEnv("FIREBASE_PROJECT_ID");
        String privateKey = getEnv("FIREBASE_PRIVATE_KEY");
        String clientEmail = getEnv("FIREBASE_CLIENT_EMAIL");

        if (projectId == null || privateKey == null || clientEmail == null) {
            return null;
        }

        Map<String, Object> json = new LinkedHashMap<>();
        json.put("type", getEnvOrDefault("FIREBASE_TYPE", "service_account"));
        json.put("project_id", projectId);
        json.put("private_key_id", getEnvOrDefault("FIREBASE_PRIVATE_KEY_ID", ""));
        json.put("private_key", normalizePrivateKey(privateKey));
        json.put("client_email", clientEmail);
        json.put("client_id", getEnvOrDefault("FIREBASE_CLIENT_ID", ""));
        json.put("auth_uri", getEnvOrDefault("FIREBASE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"));
        json.put("token_uri", getEnvOrDefault("FIREBASE_TOKEN_URI", "https://oauth2.googleapis.com/token"));
        json.put("auth_provider_x509_cert_url", getEnvOrDefault("FIREBASE_AUTH_PROVIDER_X509_CERT_URL", "https://www.googleapis.com/oauth2/v1/certs"));
        json.put("client_x509_cert_url", getEnvOrDefault("FIREBASE_CLIENT_X509_CERT_URL", ""));
        json.put("universe_domain", getEnvOrDefault("FIREBASE_UNIVERSE_DOMAIN", "googleapis.com"));

        byte[] jsonBytes = OBJECT_MAPPER.writeValueAsBytes(json);
        return new ByteArrayInputStream(jsonBytes);
    }

    private String normalizePrivateKey(String privateKey) {
        return privateKey.replace("\\n", "\n");
    }

    private String getEnv(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }

    private String getEnvOrDefault(String key, String defaultValue) {
        String value = getEnv(key);
        return value != null ? value : defaultValue;
    }

    private InputStream resolveServiceAccountStreamFromPath(String path) throws IOException {
        if (path == null || path.isBlank()) {
            throw new IOException("Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON_B64 or FIREBASE_* vars, or provide firebase.service-account.path");
        }

        if (path.startsWith("classpath:")) {
            String classpathLocation = path.substring("classpath:".length());
            logger.info("Using Firebase credentials from classpath path: {}", classpathLocation);
            return new ClassPathResource(classpathLocation).getInputStream();
        }

        logger.info("Using Firebase credentials from file path: {}", path);
        return Files.newInputStream(Path.of(path));
    }
}
