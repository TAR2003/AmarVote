# Quick Start - Deploy Fixed Version

## For Production (Docker)

```bash
# 1. Pull latest code (if using git)
git pull

# 2. Stop existing containers
docker-compose -f docker-compose.prod.yml down

# 3. Rebuild and start
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Verify credentials directory
docker exec amarvote_backend ls -la /app/data/credentials

# 5. Check logs for successful startup
docker logs amarvote_backend | tail -n 50

# 6. Monitor for credential file operations
docker logs -f amarvote_backend | grep -i credential
```

## For Local Development

```bash
# 1. Navigate to backend
cd backend

# 2. Clean and rebuild
./mvnw clean package -DskipTests

# 3. Run the application
./mvnw spring-boot:run

# 4. Check credentials directory was created
ls -la credentials/
```

## Verify the Fix

### Test Guardian Creation

1. **Login** to AmarVote admin panel
2. **Create a new election**
3. **Add guardians** with email addresses
4. **Check logs** for:
   ```
   ✅ Successfully created credential file for guardian <email>
   ```
5. **Verify email** was sent to guardians
6. **Check logs** for:
   ```
   🗑️ Successfully deleted credential file
   ```

### Expected Log Output

**Success:**
```
Creating credential file for guardian: tawkir2003@gmail.com (election: 1)
✅ Successfully created credential file for guardian tawkir2003@gmail.com (election 1): /app/data/credentials/guardian_tawkir2003@gmail.com_1.txt
Sending guardian credential email to: tawkir2003@gmail.com
🗑️ Successfully deleted credential file: /app/data/credentials/guardian_tawkir2003@gmail.com_1.txt
```

**If Error Occurs:**
```
❌ Failed to create credential file for guardian tawkir2003@gmail.com: <detailed error message>
```

## Troubleshooting

### Issue: Permission Denied

```bash
# Check directory permissions
docker exec amarvote_backend ls -la /app/data

# Fix permissions (if needed)
docker exec -u root amarvote_backend chown -R spring:spring /app/data/credentials
docker exec -u root amarvote_backend chmod 700 /app/data/credentials
```

### Issue: Directory Not Found

```bash
# Verify volume is mounted
docker inspect amarvote_backend | grep -A 10 Mounts

# Recreate volume
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d --build
```

### Issue: Files Not Being Deleted

```bash
# Check for orphaned files
docker exec amarvote_backend find /app/data/credentials -type f

# Manually clean if needed
docker exec amarvote_backend sh -c "rm -f /app/data/credentials/*"
```

## Environment Variables

Ensure these are set (in `.env` or docker-compose):

```bash
CREDENTIALS_DIRECTORY=/app/data/credentials  # For Docker
# OR
CREDENTIALS_DIRECTORY=/var/amarvote/credentials  # For native deployment
```

## Rollback (If Needed)

```bash
# Revert to previous version
git checkout <previous-commit>
docker-compose -f docker-compose.prod.yml up -d --build
```

## Get Help

See detailed documentation:
- **Production Guide**: [SECURE_CREDENTIALS_PRODUCTION_GUIDE.md](./SECURE_CREDENTIALS_PRODUCTION_GUIDE.md)
- **Fix Summary**: [CREDENTIAL_FILE_FIX.md](./CREDENTIAL_FILE_FIX.md)

Check logs for detailed error messages:
```bash
docker logs amarvote_backend | grep -A 10 "❌"
```
