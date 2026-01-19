#!/bin/bash
# Quick Redis Fix Script
# Run this when Docker is available

echo "🔧 Starting Redis service..."
cd /path/to/your/amarvote/project

# Stop existing services
docker-compose down

# Start only Redis first
docker-compose up -d redis

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 5

# Check Redis status
echo "🔍 Checking Redis status..."
docker-compose exec redis redis-cli ping

# Start backend
echo "🚀 Starting backend..."
docker-compose up -d backend

# Check backend logs for Redis connection
echo "📋 Checking backend Redis connection..."
sleep 10
docker-compose logs backend | grep -i redis | tail -10

echo ""
echo "✅ Redis integration should now be working!"
echo ""
echo "Test by submitting guardian credentials again."
echo "You should see logs like:"
echo "  '🔒 Guardian credentials stored securely in Redis with 1-hour TTL'"