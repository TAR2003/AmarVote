# Secure Credential File Management - Production Deployment Guide

## Overview

The AmarVote application now uses a secure, industrial-grade credential file management system for handling guardian credentials. This guide explains how to properly configure and deploy this feature in production.

## What Was Fixed

### Previous Issues
- **Directory Creation Failure**: Credentials directory creation could fail due to permission issues
- **No Error Handling**: Minimal error handling and logging for debugging production issues
- **Insecure File Permissions**: Files created with default permissions (potentially world-readable)
- **No Path Validation**: Vulnerable to path traversal attacks
- **Simple Deletion**: Files were simply deleted without secure overwrite

### New Implementation

The new `SecureCredentialFileService` provides:

1. **Configurable Storage Directory**: Environment-variable based configuration
2. **Secure File Permissions**: 600 (owner read/write only) on Unix/Linux
3. **Atomic File Operations**: Prevents corruption during writes
4. **Path Traversal Prevention**: Validates all paths before use
5. **Secure Deletion**: Overwrites files with random data before deletion
6. **Comprehensive Logging**: Detailed error messages with SLF4J
7. **Input Validation**: Validates all inputs before processing
8. **File Size Limits**: Configurable maximum file size

## Configuration

### Application Properties

Add these properties to your `application.properties`:

```properties
# AmarVote Credentials Configuration
# Directory for storing temporary credential files
# In production, use an absolute path or mounted volume
amarvote.credentials.directory=${CREDENTIALS_DIRECTORY:credentials}

# Enable secure deletion (overwrite files before deletion)
amarvote.credentials.secure-delete=true

# Maximum credential file size in MB
amarvote.credentials.max-file-size-mb=10
```

### Environment Variables

#### Development (Local)

```bash
# Not required - defaults to ./credentials directory
```

#### Production (Linux/Unix)

```bash
# Option 1: Use a dedicated directory with proper permissions
export CREDENTIALS_DIRECTORY=/var/amarvote/credentials

# Create directory with secure permissions
sudo mkdir -p /var/amarvote/credentials
sudo chown amarvote:amarvote /var/amarvote/credentials
sudo chmod 700 /var/amarvote/credentials
```

#### Production (Docker)

```bash
# Use a mounted volume for credentials
export CREDENTIALS_DIRECTORY=/app/data/credentials
```

## Docker Configuration

### Docker Compose (Production)

Update your `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      # ... other environment variables ...
      CREDENTIALS_DIRECTORY: /app/data/credentials
    volumes:
      # Mount a volume for credential files
      - credentials-data:/app/data/credentials
    # ... rest of configuration ...

volumes:
  credentials-data:
    driver: local
```

### Dockerfile

Ensure your `Dockerfile` creates the directory:

```dockerfile
FROM openjdk:17-jdk-slim

WORKDIR /app

# Create data directory for credentials
RUN mkdir -p /app/data/credentials && \
    chmod 700 /app/data/credentials

COPY target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

## Security Best Practices

### 1. Directory Permissions

**Linux/Unix:**
```bash
# Owner: read, write, execute
# Group: none
# Others: none
chmod 700 /path/to/credentials
```

**Docker:**
```yaml
# Use a named volume with proper permissions
volumes:
  credentials-data:
    driver: local
    driver_opts:
      type: none
      device: /var/amarvote/credentials
      o: bind,mode=700
```

### 2. Volume Mounting

**Recommended**: Use Docker named volumes instead of bind mounts:

```yaml
# ✅ GOOD: Named volume
volumes:
  - credentials-data:/app/data/credentials

# ❌ AVOID: Bind mount (can have permission issues)
volumes:
  - ./credentials:/app/data/credentials
```

### 3. Backup Strategy

Credential files are **temporary** - they should be deleted after being sent via email. However, if you need backups:

```bash
# Backup with encryption
tar -czf credentials-backup.tar.gz /var/amarvote/credentials
gpg --encrypt --recipient admin@amarvote.com credentials-backup.tar.gz
rm credentials-backup.tar.gz
```

### 4. Monitoring

Monitor the credentials directory:

```bash
# Check disk usage
du -sh /var/amarvote/credentials

# Check file count (should be low/zero if emails are working)
find /var/amarvote/credentials -type f | wc -l

# Check old files (older than 1 hour indicates email issue)
find /var/amarvote/credentials -type f -mmin +60
```

## Troubleshooting

### Issue: "Failed to create credential file"

**Possible Causes:**
1. Directory doesn't exist or can't be created
2. Insufficient permissions
3. Disk full
4. Path is not a directory

**Solutions:**

```bash
# Check directory exists and permissions
ls -la /var/amarvote/credentials

# Check disk space
df -h

# Check Java process permissions
ps aux | grep java
id <java-user>

# Check logs for detailed error
docker logs amarvote-backend 2>&1 | grep -A 10 "Failed to create credential file"
```

### Issue: "Security violation: Path traversal attempt"

**Cause:** Attempting to write outside the credentials directory

**Solution:** This is a security feature working correctly. Check that:
- `CREDENTIALS_DIRECTORY` is set correctly
- No one is tampering with email addresses or election IDs

### Issue: Permission Denied Errors

**Cause:** Java process doesn't have write permissions

**Solutions:**

```bash
# Docker: Ensure volume has correct permissions
docker exec -it amarvote-backend ls -la /app/data/credentials

# Docker: Run as specific user
# In docker-compose.yml:
services:
  backend:
    user: "1000:1000"  # Match your host user ID
```

### Issue: Files Not Being Deleted

**Check:**
1. Email service is working (files should be deleted after sending)
2. Logs for deletion errors
3. Secure delete might be slow for large files

**Monitor:**
```bash
# Check for orphaned files
find /var/amarvote/credentials -type f -mmin +120

# Clean up manually if needed (careful!)
find /var/amarvote/credentials -type f -mmin +120 -delete
```

## Testing

### Local Testing

```bash
# Start application
./mvnw spring-boot:run

# Check credentials directory was created
ls -la credentials/

# Trigger guardian creation (via UI or API)
# Check file was created
ls -la credentials/

# Verify file permissions (Unix/Linux)
stat credentials/guardian_*.txt

# Check file was deleted after email sent
# Directory should be empty
```

### Production Testing

```bash
# Check environment variable
docker exec amarvote-backend env | grep CREDENTIALS_DIRECTORY

# Check directory exists
docker exec amarvote-backend ls -la /app/data/credentials

# Check logs
docker logs amarvote-backend | grep "credential file"

# Test file creation
docker exec amarvote-backend touch /app/data/credentials/test.txt
docker exec amarvote-backend ls -la /app/data/credentials/test.txt
docker exec amarvote-backend rm /app/data/credentials/test.txt
```

## Logging

The service provides comprehensive logging:

```
✅ Successfully created credential file for guardian user@example.com (election 123): /app/data/credentials/guardian_user_example.com_123.txt
🗑️ Successfully deleted credential file: /app/data/credentials/guardian_user_example.com_123.txt
❌ Failed to create credential file for guardian user@example.com (election 123): Permission denied
🚨 Security violation: Path traversal attempt detected
```

Log levels:
- `INFO`: Successful operations
- `DEBUG`: Detailed operation steps
- `ERROR`: Failures with stack traces
- `WARN`: Non-critical issues

## Production Checklist

- [ ] Set `CREDENTIALS_DIRECTORY` environment variable
- [ ] Create credentials directory with 700 permissions
- [ ] Configure Docker volume or bind mount
- [ ] Verify Java process has write permissions
- [ ] Test credential file creation via UI
- [ ] Verify email delivery (files should be deleted)
- [ ] Set up monitoring for orphaned files
- [ ] Configure log aggregation for error tracking
- [ ] Test disaster recovery procedures
- [ ] Document backup/restore procedures

## Security Considerations

### File Lifecycle

1. **Creation**: Atomic write with secure permissions (600)
2. **Storage**: Temporary storage until email sent (< 1 minute typically)
3. **Deletion**: Secure overwrite (3 passes) + deletion
4. **Never Stored Long-Term**: Files should not persist

### Attack Mitigations

| Attack Vector | Mitigation |
|---------------|------------|
| Path Traversal | Path validation against base directory |
| Unauthorized Access | File permissions (600) + directory permissions (700) |
| Information Disclosure | Secure deletion with overwrite |
| DoS (Large Files) | File size limits (configurable) |
| Race Conditions | Atomic file operations |

### Compliance

This implementation follows:
- **OWASP Secure Coding Practices**
- **CWE-22**: Path Traversal Prevention
- **CWE-732**: Incorrect Permission Assignment
- **CWE-377**: Insecure Temporary File

## Migration from Old System

The new system is **backward compatible** - it uses the same file naming convention and API. No code changes required in calling services.

### Steps

1. Deploy new code
2. Set environment variables
3. Restart application
4. Monitor logs for any issues
5. Verify credential files are created/deleted correctly

## Support

For issues or questions:
1. Check logs: `docker logs amarvote-backend | grep -i credential`
2. Verify configuration: Environment variables and permissions
3. Test file operations: Manual file creation in credentials directory
4. Review this guide's troubleshooting section

## References

- **Source Code**: `backend/src/main/java/com/amarvote/amarvote/service/SecureCredentialFileService.java`
- **Configuration**: `backend/src/main/resources/application.properties`
- **Docker Compose**: `docker-compose.prod.yml`
