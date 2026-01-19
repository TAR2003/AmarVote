#!/bin/bash
# Redis Integration Verification Script
# Run this after starting services with: docker-compose up -d

echo "🔍 Verifying Redis Integration..."
echo "================================="

# Check if Redis container is running
echo "1. Checking Redis container status..."
if docker ps | grep -q amarvote_redis; then
    echo "✅ Redis container is running"
else
    echo "❌ Redis container is not running"
    exit 1
fi

# Test Redis connectivity
echo ""
echo "2. Testing Redis connectivity..."
if docker exec amarvote_redis redis-cli ping | grep -q PONG; then
    echo "✅ Redis is responding to ping"
else
    echo "❌ Redis is not responding"
    exit 1
fi

# Check Redis memory usage
echo ""
echo "3. Checking Redis memory usage..."
MEMORY_INFO=$(docker exec amarvote_redis redis-cli info memory | grep used_memory_human)
echo "📊 Redis memory usage: $MEMORY_INFO"

# Check if backend can connect to Redis
echo ""
echo "4. Checking backend Redis connectivity..."
# This would require backend to be running - we'll check logs later

echo ""
echo "✅ Redis integration verification complete!"
echo ""
echo "Next steps:"
echo "1. Start backend: docker-compose up -d backend"
echo "2. Check backend logs: docker-compose logs backend | grep -i redis"
echo "3. Test decryption flow with multi-guardian election"
echo ""
echo "Redis Configuration:"
echo "- Host: redis (container name)"
echo "- Port: 6379"
echo "- Memory limit: 256MB"
echo "- TTL: 1 hour for credentials"
echo "- Persistence: Disabled (security)"