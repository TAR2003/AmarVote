#!/bin/bash

echo "🔧 Fixing Redis Connection for Backend..."
echo ""

# Check if Redis is running
echo "1️⃣ Checking Redis status..."
docker compose -f docker-compose.prod.yml ps redis

# Check Redis connectivity
echo ""
echo "2️⃣ Testing Redis connectivity from host..."
docker exec amarvote_redis redis-cli ping

# Restart backend to apply Redis configuration
echo ""
echo "3️⃣ Restarting backend service to apply Redis configuration..."
docker compose -f docker-compose.prod.yml restart backend

echo ""
echo "4️⃣ Waiting for backend to start (15 seconds)..."
sleep 15

# Check backend logs
echo ""
echo "5️⃣ Checking backend logs for Redis connection..."
docker compose -f docker-compose.prod.yml logs --tail=50 backend | grep -i "redis\|connection"

echo ""
echo "✅ Fix complete! Monitor logs with:"
echo "   docker compose -f docker-compose.prod.yml logs -f backend"
