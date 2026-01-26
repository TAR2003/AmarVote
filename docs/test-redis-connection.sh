#!/bin/bash
# Redis Connection Test
echo "🧪 Testing Redis Connection..."

# Test Redis CLI
echo "1. Testing Redis CLI..."
if docker-compose exec redis redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "✅ Redis CLI: PONG received"
else
    echo "❌ Redis CLI: No response"
    exit 1
fi

# Test backend connection (if backend is running)
echo "2. Testing backend Redis connection..."
if docker-compose ps backend | grep -q "Up"; then
    echo "📋 Checking backend logs for Redis connection..."
    if docker-compose logs backend 2>/dev/null | grep -q "stored securely in Redis"; then
        echo "✅ Backend successfully connected to Redis"
    else
        echo "⚠️  Backend logs don't show Redis connection yet"
        echo "   Try submitting guardian credentials to test"
    fi
else
    echo "⚠️  Backend not running - start it with: docker-compose up -d backend"
fi

echo ""
echo "🎯 Next: Submit guardian credentials to test full integration"