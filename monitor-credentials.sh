#!/bin/bash

# AmarVote Credentials Directory Monitor
# This script helps monitor the credentials directory in production

set -e

CONTAINER_NAME="amarvote_backend"
CREDENTIALS_DIR="/app/data/credentials"

echo "🔍 AmarVote Credentials Directory Monitor"
echo "=========================================="
echo ""

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container '$CONTAINER_NAME' is not running"
    exit 1
fi

echo "✅ Container is running"
echo ""

# Check directory exists
echo "📁 Checking directory..."
if docker exec "$CONTAINER_NAME" test -d "$CREDENTIALS_DIR"; then
    echo "✅ Directory exists: $CREDENTIALS_DIR"
else
    echo "❌ Directory not found: $CREDENTIALS_DIR"
    exit 1
fi
echo ""

# Check permissions
echo "🔐 Directory permissions:"
docker exec "$CONTAINER_NAME" ls -ld "$CREDENTIALS_DIR"
echo ""

# Count files
FILE_COUNT=$(docker exec "$CONTAINER_NAME" sh -c "find $CREDENTIALS_DIR -type f | wc -l" | tr -d ' ')
echo "📊 File count: $FILE_COUNT"

if [ "$FILE_COUNT" -eq 0 ]; then
    echo "✅ No files (expected - files should be deleted after sending emails)"
elif [ "$FILE_COUNT" -lt 5 ]; then
    echo "⚠️  Warning: $FILE_COUNT file(s) found (should normally be 0)"
    echo "   Files may be waiting to be sent or there's an email delivery issue"
else
    echo "❌ Alert: $FILE_COUNT files found! This indicates a problem with email delivery"
fi
echo ""

# List files if any exist
if [ "$FILE_COUNT" -gt 0 ]; then
    echo "📄 Files in directory:"
    docker exec "$CONTAINER_NAME" ls -lh "$CREDENTIALS_DIR"
    echo ""
    
    # Check for old files (older than 1 hour)
    echo "⏰ Checking for old files (>1 hour)..."
    OLD_FILES=$(docker exec "$CONTAINER_NAME" sh -c "find $CREDENTIALS_DIR -type f -mmin +60 2>/dev/null" || echo "")
    
    if [ -n "$OLD_FILES" ]; then
        echo "⚠️  Found old files:"
        docker exec "$CONTAINER_NAME" sh -c "find $CREDENTIALS_DIR -type f -mmin +60 -exec ls -lh {} \;"
        echo ""
        echo "💡 Recommendation: Check email service logs and consider manual cleanup"
    else
        echo "✅ No old files found"
    fi
fi
echo ""

# Check disk usage
echo "💾 Disk usage:"
docker exec "$CONTAINER_NAME" du -sh "$CREDENTIALS_DIR"
echo ""

# Check recent logs
echo "📋 Recent credential-related logs (last 20 lines):"
docker logs "$CONTAINER_NAME" 2>&1 | grep -i "credential" | tail -n 20
echo ""

# Health summary
echo "🏥 Health Summary:"
echo "=================="
if [ "$FILE_COUNT" -eq 0 ]; then
    echo "✅ Status: HEALTHY"
    echo "   - No orphaned files"
    echo "   - Credentials are being properly cleaned up"
elif [ "$FILE_COUNT" -lt 5 ]; then
    echo "⚠️  Status: WARNING"
    echo "   - Some files present (may be temporary)"
    echo "   - Monitor for growth"
else
    echo "❌ Status: CRITICAL"
    echo "   - Too many credential files"
    echo "   - Check email service immediately"
    echo "   - Consider manual cleanup"
fi
echo ""

# Optional cleanup function
read -p "🗑️  Do you want to clean up old files (>1 hour)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning up old files..."
    DELETED=$(docker exec "$CONTAINER_NAME" sh -c "find $CREDENTIALS_DIR -type f -mmin +60 -delete -print | wc -l" | tr -d ' ')
    echo "✅ Deleted $DELETED file(s)"
else
    echo "Cleanup skipped"
fi

echo ""
echo "Monitor completed at $(date)"
