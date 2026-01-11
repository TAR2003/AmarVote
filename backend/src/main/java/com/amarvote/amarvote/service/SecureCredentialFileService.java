package com.amarvote.amarvote.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;

/**
 * Secure credential file management service for production environments.
 * Handles creation, reading, and secure deletion of guardian credential files.
 * 
 * Security features:
 * - Configurable storage directory with validation
 * - Secure file permissions (600 on Unix/Linux)
 * - Atomic file operations
 * - Path traversal prevention
 * - Comprehensive error handling and logging
 * - Secure deletion with overwrite
 */
@Slf4j
@Service
public class SecureCredentialFileService {

    @Value("${amarvote.credentials.directory:credentials}")
    private String credentialsBaseDirectory;

    @Value("${amarvote.credentials.secure-delete:true}")
    private boolean secureDeleteEnabled;

    @Value("${amarvote.credentials.max-file-size-mb:10}")
    private int maxFileSizeMB;

    private static final String FILE_PREFIX = "guardian_";
    private static final String FILE_EXTENSION = ".txt";
    private static final int OVERWRITE_PASSES = 3; // For secure deletion

    /**
     * Creates a secure credential file for a guardian.
     * 
     * @param guardianEmail The guardian's email address
     * @param electionId The election ID
     * @param encryptedData The encrypted credential data to store
     * @return Path to the created credential file
     * @throws IllegalArgumentException if inputs are invalid
     * @throws SecurityException if directory cannot be secured
     * @throws IOException if file operations fail
     */
    public Path createCredentialFile(String guardianEmail, Long electionId, String encryptedData) 
            throws IOException {
        
        // Input validation
        validateInputs(guardianEmail, electionId, encryptedData);
        
        // Get or create secure credentials directory
        Path credentialsDir = getOrCreateCredentialsDirectory();
        
        // Generate safe filename
        String sanitizedEmail = sanitizeEmail(guardianEmail);
        String filename = generateFilename(sanitizedEmail, electionId);
        Path credentialFile = credentialsDir.resolve(filename);
        
        // Validate path to prevent directory traversal
        validatePath(credentialsDir, credentialFile);
        
        try {
            // Write file atomically with secure permissions
            writeSecureFile(credentialFile, encryptedData);
            
            log.info("✅ Successfully created credential file for guardian {} (election {}): {}", 
                    guardianEmail, electionId, credentialFile.toAbsolutePath());
            
            return credentialFile;
            
        } catch (IOException e) {
            log.error("❌ Failed to create credential file for guardian {} (election {}): {}", 
                    guardianEmail, electionId, e.getMessage(), e);
            throw new IOException("Failed to create credential file: " + e.getMessage(), e);
        }
    }

    /**
     * Reads encrypted data from a credential file.
     * 
     * @param credentialFilePath Path to the credential file
     * @return The encrypted data content
     * @throws IllegalArgumentException if file doesn't exist or is invalid
     * @throws IOException if read operation fails
     */
    public String readCredentialFile(Path credentialFilePath) throws IOException {
        
        if (credentialFilePath == null) {
            throw new IllegalArgumentException("Credential file path cannot be null");
        }
        
        if (!Files.exists(credentialFilePath)) {
            log.error("❌ Credential file not found: {}", credentialFilePath.toAbsolutePath());
            throw new IllegalArgumentException("Credential file not found: " + credentialFilePath.toAbsolutePath());
        }
        
        if (!Files.isRegularFile(credentialFilePath)) {
            log.error("❌ Path is not a regular file: {}", credentialFilePath.toAbsolutePath());
            throw new IllegalArgumentException("Path is not a regular file");
        }
        
        // Check file size
        long fileSizeBytes = Files.size(credentialFilePath);
        long maxSizeBytes = maxFileSizeMB * 1024L * 1024L;
        if (fileSizeBytes > maxSizeBytes) {
            log.error("❌ Credential file too large: {} bytes (max: {} MB)", fileSizeBytes, maxFileSizeMB);
            throw new IllegalArgumentException("Credential file exceeds maximum size");
        }
        
        try {
            String content = Files.readString(credentialFilePath, StandardCharsets.UTF_8);
            log.debug("✅ Successfully read credential file: {}", credentialFilePath.toAbsolutePath());
            return content;
            
        } catch (IOException e) {
            log.error("❌ Failed to read credential file {}: {}", 
                    credentialFilePath.toAbsolutePath(), e.getMessage(), e);
            throw new IOException("Failed to read credential file: " + e.getMessage(), e);
        }
    }

    /**
     * Securely deletes a credential file.
     * If secure delete is enabled, overwrites the file before deletion.
     * 
     * @param credentialFilePath Path to the credential file to delete
     * @throws IOException if deletion fails
     */
    public void deleteCredentialFile(Path credentialFilePath) throws IOException {
        
        if (credentialFilePath == null) {
            log.warn("⚠️ Attempted to delete null credential file path");
            return;
        }
        
        if (!Files.exists(credentialFilePath)) {
            log.warn("⚠️ Credential file already deleted or doesn't exist: {}", 
                    credentialFilePath.toAbsolutePath());
            return;
        }
        
        try {
            if (secureDeleteEnabled) {
                // Securely overwrite file before deletion
                secureOverwrite(credentialFilePath);
            }
            
            Files.delete(credentialFilePath);
            log.info("🗑️ Successfully deleted credential file: {}", credentialFilePath.toAbsolutePath());
            
        } catch (IOException e) {
            log.error("❌ Failed to delete credential file {}: {}", 
                    credentialFilePath.toAbsolutePath(), e.getMessage(), e);
            throw new IOException("Failed to delete credential file: " + e.getMessage(), e);
        }
    }

    /**
     * Gets or creates the credentials directory with secure permissions.
     * 
     * @return Path to the credentials directory
     * @throws IOException if directory cannot be created or secured
     */
    private Path getOrCreateCredentialsDirectory() throws IOException {
        
        Path credentialsDir = Paths.get(credentialsBaseDirectory);
        
        // Create absolute path if relative
        if (!credentialsDir.isAbsolute()) {
            credentialsDir = Paths.get(System.getProperty("user.dir"), credentialsBaseDirectory);
        }
        
        log.debug("Using credentials directory: {}", credentialsDir.toAbsolutePath());
        
        if (!Files.exists(credentialsDir)) {
            try {
                // Create directory with secure permissions
                if (isUnixLike()) {
                    Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rwx------");
                    Files.createDirectories(credentialsDir, 
                            PosixFilePermissions.asFileAttribute(perms));
                } else {
                    Files.createDirectories(credentialsDir);
                    // On Windows, restrict access to current user
                    setWindowsPermissions(credentialsDir.toFile());
                }
                
                log.info("✅ Created credentials directory with secure permissions: {}", 
                        credentialsDir.toAbsolutePath());
                
            } catch (IOException e) {
                log.error("❌ Failed to create credentials directory {}: {}", 
                        credentialsDir.toAbsolutePath(), e.getMessage(), e);
                throw new IOException("Failed to create credentials directory: " + e.getMessage(), e);
            }
        } else if (!Files.isDirectory(credentialsDir)) {
            log.error("❌ Credentials path exists but is not a directory: {}", 
                    credentialsDir.toAbsolutePath());
            throw new IOException("Credentials path exists but is not a directory");
        }
        
        return credentialsDir;
    }

    /**
     * Writes data to a file with secure permissions.
     * 
     * @param filePath Path to write to
     * @param content Content to write
     * @throws IOException if write operation fails
     */
    private void writeSecureFile(Path filePath, String content) throws IOException {
        
        // Write to temporary file first (atomic operation)
        Path tempFile = filePath.getParent().resolve(filePath.getFileName() + ".tmp");
        
        try {
            // Write content to temp file
            if (isUnixLike()) {
                // Set permissions during creation (Unix/Linux)
                Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rw-------");
                Files.writeString(tempFile, content, StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE,
                        StandardOpenOption.TRUNCATE_EXISTING);
                Files.setPosixFilePermissions(tempFile, perms);
            } else {
                // Windows: create file then restrict permissions
                Files.writeString(tempFile, content, StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE,
                        StandardOpenOption.TRUNCATE_EXISTING);
                setWindowsPermissions(tempFile.toFile());
            }
            
            // Atomic move from temp to final location
            Files.move(tempFile, filePath, 
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.ATOMIC_MOVE);
            
        } catch (UnsupportedOperationException e) {
            // Atomic move not supported, fall back to regular move
            log.warn("⚠️ Atomic move not supported, using standard move");
            Files.move(tempFile, filePath, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            // Clean up temp file if it still exists
            Files.deleteIfExists(tempFile);
        }
    }

    /**
     * Securely overwrites a file before deletion.
     * 
     * @param filePath Path to the file to overwrite
     * @throws IOException if overwrite fails
     */
    private void secureOverwrite(Path filePath) throws IOException {
        
        long fileSize = Files.size(filePath);
        SecureRandom random = new SecureRandom();
        
        // Overwrite multiple times with random data
        for (int pass = 0; pass < OVERWRITE_PASSES; pass++) {
            byte[] randomData = new byte[(int) Math.min(fileSize, 8192)];
            random.nextBytes(randomData);
            
            try (var channel = Files.newByteChannel(filePath, 
                    StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
                long remaining = fileSize;
                while (remaining > 0) {
                    int toWrite = (int) Math.min(remaining, randomData.length);
                    channel.write(java.nio.ByteBuffer.wrap(randomData, 0, toWrite));
                    remaining -= toWrite;
                }
            }
        }
        
        log.debug("🔒 Securely overwritten file: {}", filePath.toAbsolutePath());
    }

    /**
     * Validates input parameters.
     */
    private void validateInputs(String guardianEmail, Long electionId, String encryptedData) {
        if (guardianEmail == null || guardianEmail.trim().isEmpty()) {
            throw new IllegalArgumentException("Guardian email cannot be null or empty");
        }
        if (electionId == null || electionId <= 0) {
            throw new IllegalArgumentException("Election ID must be positive");
        }
        if (encryptedData == null || encryptedData.trim().isEmpty()) {
            throw new IllegalArgumentException("Encrypted data cannot be null or empty");
        }
        // Check encrypted data size
        long dataSizeBytes = encryptedData.getBytes(StandardCharsets.UTF_8).length;
        long maxSizeBytes = maxFileSizeMB * 1024L * 1024L;
        if (dataSizeBytes > maxSizeBytes) {
            throw new IllegalArgumentException("Encrypted data exceeds maximum size");
        }
    }

    /**
     * Sanitizes email for safe filename usage.
     */
    private String sanitizeEmail(String email) {
        return email.replaceAll("[^a-zA-Z0-9._@-]", "_");
    }

    /**
     * Generates a secure filename.
     */
    private String generateFilename(String sanitizedEmail, Long electionId) {
        return FILE_PREFIX + sanitizedEmail + "_" + electionId + FILE_EXTENSION;
    }

    /**
     * Validates that the resolved path is within the credentials directory.
     * Prevents path traversal attacks.
     */
    private void validatePath(Path baseDir, Path resolvedPath) throws IOException {
        Path normalizedBase = baseDir.toAbsolutePath().normalize();
        Path normalizedResolved = resolvedPath.toAbsolutePath().normalize();
        
        if (!normalizedResolved.startsWith(normalizedBase)) {
            log.error("🚨 Security violation: Path traversal attempt detected. Base: {}, Resolved: {}", 
                    normalizedBase, normalizedResolved);
            throw new SecurityException("Path traversal attempt detected");
        }
    }

    /**
     * Checks if the current OS is Unix-like (supports POSIX permissions).
     */
    private boolean isUnixLike() {
        String os = System.getProperty("os.name").toLowerCase();
        return os.contains("nix") || os.contains("nux") || os.contains("mac");
    }

    /**
     * Sets Windows file permissions to restrict access to current user only.
     * This is a best-effort approach for Windows systems.
     */
    private void setWindowsPermissions(File file) {
        try {
            // Remove all permissions
            file.setReadable(false, false);
            file.setWritable(false, false);
            file.setExecutable(false, false);
            
            // Add permissions only for owner
            file.setReadable(true, true);
            file.setWritable(true, true);
            
            log.debug("Set Windows permissions for: {}", file.getAbsolutePath());
        } catch (SecurityException e) {
            log.warn("⚠️ Failed to set Windows permissions for {}: {}", 
                    file.getAbsolutePath(), e.getMessage());
        }
    }

    /**
     * Generates a unique temporary filename for atomic operations.
     */
    private String generateTempFilename() {
        byte[] randomBytes = new byte[8];
        new SecureRandom().nextBytes(randomBytes);
        String randomSuffix = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(randomBytes);
        return ".tmp_" + randomSuffix;
    }
}
