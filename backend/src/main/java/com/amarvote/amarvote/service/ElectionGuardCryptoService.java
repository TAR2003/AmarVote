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
     * Encrypts a guardian's private key and polynomial using the ElectionGuard microservice
     * @param privateKey The guardian's private key to encrypt
     * @param polynomial The guardian's polynomial to encrypt
     * @return EncryptionResult containing encrypted_data and credentials
     */
    public EncryptionResult encryptGuardianData(String privateKey, String polynomial) {
        try {
            System.out.println("Calling ElectionGuard encryption service for guardian private key and polynomial");
            
            // Create the combined string format
            String combinedData = createCombinedGuardianString(privateKey, polynomial);
            
            // Prepare request body
            Map<String, String> requestBody = Map.of("private_key", combinedData);
            
            // Call the microservice
            String response = webClient.post()
                .uri("/api/encrypt")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
            
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
            
            System.out.println("Successfully encrypted guardian private key and polynomial");
            
            return new EncryptionResult(encryptedData, credentials);
            
        } catch (WebClientResponseException e) {
            System.err.println("ElectionGuard encryption service error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString());
            throw new RuntimeException("Failed to encrypt guardian data: " + e.getMessage(), e);
        } catch (Exception e) {
            System.err.println("Error calling ElectionGuard encryption service: " + e.getMessage());
            throw new RuntimeException("Failed to encrypt guardian data", e);
        }
    }

    /**
     * Encrypts a guardian's private key using the ElectionGuard microservice (deprecated)
     * @param privateKey The guardian's private key to encrypt
     * @return EncryptionResult containing encrypted_data and credentials
     * @deprecated Use encryptGuardianData(String, String) instead
     */
    @Deprecated
    public EncryptionResult encryptPrivateKey(String privateKey) {
        try {
            System.out.println("Calling ElectionGuard encryption service for guardian private key (deprecated method)");
            
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
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
            
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
     * Decrypts a guardian's combined data (private key and polynomial) using the ElectionGuard microservice
     * @param encryptedData The encrypted combined data
     * @param credentials The credentials needed for decryption
     * @return GuardianDecryptionResult containing the decrypted private key and polynomial
     */
    public GuardianDecryptionResult decryptGuardianData(String encryptedData, String credentials) {
        try {
            System.out.println("Calling ElectionGuard decryption service for guardian combined data");
            
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
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
            
            if (response == null) {
                throw new RuntimeException("No response from ElectionGuard decryption service");
            }
            
            // Parse the response
            @SuppressWarnings("unchecked")
            Map<String, Object> responseData = objectMapper.readValue(response, Map.class);
            
            if (!"success".equals(responseData.get("status"))) {
                throw new RuntimeException("Decryption failed: " + responseData.get("message"));
            }
            
            String decryptedCombinedData = (String) responseData.get("private_key");
            
            // Parse the combined string to extract private key and polynomial
            GuardianDecryptionResult result = parseCombinedGuardianString(decryptedCombinedData);
            
            System.out.println("Successfully decrypted guardian private key and polynomial");
            
            return result;
            
        } catch (WebClientResponseException e) {
            System.err.println("ElectionGuard decryption service error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString());
            throw new RuntimeException("Failed to decrypt guardian data: " + e.getMessage(), e);
        } catch (Exception e) {
            System.err.println("Error calling ElectionGuard decryption service: " + e.getMessage());
            throw new RuntimeException("Failed to decrypt guardian data", e);
        }
    }

    /**
     * Decrypts a guardian's private key using the ElectionGuard microservice (deprecated)
     * @param encryptedData The encrypted private key data
     * @param credentials The credentials needed for decryption
     * @return The decrypted private key
     * @deprecated Use decryptGuardianData(String, String) instead
     */
    @Deprecated
    public String decryptPrivateKey(String encryptedData, String credentials) {
        try {
            System.out.println("Calling ElectionGuard decryption service for guardian private key (deprecated method)");
            
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
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
            
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
     * Deletes a credential file for security purposes after it has been sent via email
     * @param credentialFilePath Path to the credential file to delete
     */
    public void deleteCredentialFile(Path credentialFilePath) {
        try {
            if (Files.exists(credentialFilePath)) {
                Files.delete(credentialFilePath);
                System.out.println("🔒 Security: Deleted credential file: " + credentialFilePath.toAbsolutePath());
            } else {
                System.out.println("⚠️ Credential file not found for deletion: " + credentialFilePath.toAbsolutePath());
            }
        } catch (IOException e) {
            System.err.println("❌ Error deleting credential file: " + e.getMessage());
            // Don't throw exception - log error but continue execution
            // The file will be overwritten on next use if it still exists
        }
    }

    /**
     * Creates a combined string format for guardian private key and polynomial
     * @param privateKey The guardian's private key
     * @param polynomial The guardian's polynomial
     * @return Combined string in the specified format
     */
    private String createCombinedGuardianString(String privateKey, String polynomial) {
        StringBuilder combined = new StringBuilder();
        combined.append("===Private Key===\n");
        combined.append(privateKey);
        combined.append("\n===Polynomial===\n");
        combined.append(polynomial);
        return combined.toString();
    }

    /**
     * Parses the combined guardian string to extract private key and polynomial
     * @param combinedString The combined string containing both private key and polynomial
     * @return GuardianDecryptionResult containing the extracted private key and polynomial
     */
    private GuardianDecryptionResult parseCombinedGuardianString(String combinedString) {
        if (combinedString == null || combinedString.trim().isEmpty()) {
            throw new IllegalArgumentException("Combined string cannot be null or empty");
        }

        try {
            // Split the string using the markers
            String[] parts = combinedString.split("===Private Key===|===Polynomial===");
            
            if (parts.length != 3) {
                throw new IllegalArgumentException("Invalid combined string format. Expected format: ===Private Key===\\n{key}\\n===Polynomial===\\n{polynomial}");
            }

            // Extract private key (second part, after first marker)
            String privateKey = parts[1].trim();
            
            // Extract polynomial (third part, after second marker)
            String polynomial = parts[2].trim();

            if (privateKey.isEmpty()) {
                throw new IllegalArgumentException("Private key cannot be empty");
            }

            if (polynomial.isEmpty()) {
                throw new IllegalArgumentException("Polynomial cannot be empty");
            }

            return new GuardianDecryptionResult(privateKey, polynomial);

        } catch (Exception e) {
            System.err.println("Error parsing combined guardian string: " + e.getMessage());
            throw new RuntimeException("Failed to parse combined guardian data", e);
        }
    }

    /**
     * Result class for decryption operations containing both private key and polynomial
     */
    public static class GuardianDecryptionResult {
        private final String privateKey;
        private final String polynomial;

        public GuardianDecryptionResult(String privateKey, String polynomial) {
            this.privateKey = privateKey;
            this.polynomial = polynomial;
        }

        public String getPrivateKey() {
            return privateKey;
        }

        public String getPolynomial() {
            return polynomial;
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
