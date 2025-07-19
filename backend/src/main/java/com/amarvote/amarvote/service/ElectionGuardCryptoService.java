package com.amarvote.amarvote.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ElectionGuardCryptoService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    /**
     * Encrypts a guardian's private key using the ElectionGuard microservice
     * @param privateKey The guardian's private key to encrypt
     * @return EncryptionResult containing encrypted_data and credentials
     */
    public EncryptionResult encryptPrivateKey(String privateKey) {
        try {
            System.out.println("Calling ElectionGuard encryption service for guardian private key");
            
            // Prepare request body
            Map<String, String> requestBody = Map.of("private_key", privateKey);
            
            // Call the microservice
            String response = webClient.post()
                .uri("/api/encrypt")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            
            if (response == null) {
                throw new RuntimeException("No response from ElectionGuard encryption service");
            }
            
            // Parse the response
            @SuppressWarnings("unchecked")
            Map<String, Object> responseData = objectMapper.readValue(response, Map.class);
            
            if (!"success".equals(responseData.get("status"))) {
                throw new RuntimeException("Encryption failed: " + responseData.get("message"));
            }
            
            String encryptedData = (String) responseData.get("encrypted_data");
            String credentials = (String) responseData.get("credentials");
            
            System.out.println("Successfully encrypted guardian private key");
            
            return new EncryptionResult(encryptedData, credentials);
            
        } catch (WebClientResponseException e) {
            System.err.println("ElectionGuard encryption service error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString());
            throw new RuntimeException("Failed to encrypt private key: " + e.getMessage(), e);
        } catch (Exception e) {
            System.err.println("Error calling ElectionGuard encryption service: " + e.getMessage());
            throw new RuntimeException("Failed to encrypt private key", e);
        }
    }

    /**
     * Decrypts a guardian's private key using the ElectionGuard microservice
     * @param encryptedData The encrypted private key data
     * @param credentials The credentials needed for decryption
     * @return The decrypted private key
     */
    public String decryptPrivateKey(String encryptedData, String credentials) {
        try {
            System.out.println("Calling ElectionGuard decryption service for guardian private key");
            
            // Prepare request body
            Map<String, String> requestBody = Map.of(
                "encrypted_data", encryptedData,
                "credentials", credentials
            );
            
            // Call the microservice
            String response = webClient.post()
                .uri("/api/decrypt")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            
            if (response == null) {
                throw new RuntimeException("No response from ElectionGuard decryption service");
            }
            
            // Parse the response
            @SuppressWarnings("unchecked")
            Map<String, Object> responseData = objectMapper.readValue(response, Map.class);
            
            if (!"success".equals(responseData.get("status"))) {
                throw new RuntimeException("Decryption failed: " + responseData.get("message"));
            }
            
            String privateKey = (String) responseData.get("private_key");
            
            System.out.println("Successfully decrypted guardian private key");
            
            return privateKey;
            
        } catch (WebClientResponseException e) {
            System.err.println("ElectionGuard decryption service error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString());
            throw new RuntimeException("Failed to decrypt private key: " + e.getMessage(), e);
        } catch (Exception e) {
            System.err.println("Error calling ElectionGuard decryption service: " + e.getMessage());
            throw new RuntimeException("Failed to decrypt private key", e);
        }
    }

    /**
     * Creates a credential file for a guardian
     * @param guardianEmail The guardian's email
     * @param electionId The election ID
     * @param encryptedData The encrypted private key data
     * @return Path to the created credential file
     */
    public Path createCredentialFile(String guardianEmail, Long electionId, String encryptedData) {
        try {
            // Create credentials directory if it doesn't exist
            Path credentialsDir = Paths.get("credentials");
            Files.createDirectories(credentialsDir);
            
            // Create filename: guardian_email_electionId.txt
            String sanitizedEmail = guardianEmail.replaceAll("[^a-zA-Z0-9._-]", "_");
            String filename = String.format("guardian_%s_%d.txt", sanitizedEmail, electionId);
            Path credentialFile = credentialsDir.resolve(filename);
            
            // Write encrypted data to file
            Files.write(credentialFile, encryptedData.getBytes());
            
            System.out.println("Created credential file: " + credentialFile.toAbsolutePath());
            
            return credentialFile;
            
        } catch (IOException e) {
            System.err.println("Error creating credential file: " + e.getMessage());
            throw new RuntimeException("Failed to create credential file", e);
        }
    }

    /**
     * Reads encrypted data from a credential file
     * @param credentialFilePath Path to the credential file
     * @return The encrypted data content
     */
    public String readCredentialFile(Path credentialFilePath) {
        try {
            if (!Files.exists(credentialFilePath)) {
                throw new RuntimeException("Credential file not found: " + credentialFilePath);
            }
            
            String encryptedData = Files.readString(credentialFilePath);
            
            System.out.println("Read credential file: " + credentialFilePath.toAbsolutePath());
            
            return encryptedData;
            
        } catch (IOException e) {
            System.err.println("Error reading credential file: " + e.getMessage());
            throw new RuntimeException("Failed to read credential file", e);
        }
    }

    /**
     * Result class for encryption operations
     */
    public static class EncryptionResult {
        private final String encryptedData;
        private final String credentials;

        public EncryptionResult(String encryptedData, String credentials) {
            this.encryptedData = encryptedData;
            this.credentials = credentials;
        }

        public String getEncryptedData() {
            return encryptedData;
        }

        public String getCredentials() {
            return credentials;
        }
    }
}
