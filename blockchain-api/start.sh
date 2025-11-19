#!/bin/sh
set -e

echo "🚀 Starting blockchain API initialization..."

# Install netcat if not available (for connection testing)
if ! command -v nc > /dev/null 2>&1; then
    echo "Installing netcat..."
    apk add --no-cache netcat-openbsd 2>/dev/null || apt-get update && apt-get install -y netcat 2>/dev/null || true
fi

# Wait for crypto materials to be available
echo "⏳ Waiting for crypto materials..."
max_attempts=60
attempt=0
while [ ! -f "/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem" ]; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "❌ Crypto materials not found after $max_attempts attempts"
        echo "Contents of /shared:"
        ls -la /shared/ || echo "Cannot list /shared"
        echo "Starting without enrollment (will retry later)..."
        break
    fi
    echo "   Waiting... (attempt $attempt/$max_attempts)"
    sleep 2
done

# Wait for peer to be ready
echo "⏳ Waiting for peer to be ready..."
peer_timeout=120
peer_elapsed=0
while ! nc -z peer0.amarvote.com 7051 2>/dev/null; do
    if [ $peer_elapsed -ge $peer_timeout ]; then
        echo "⚠️  Peer not responding, but continuing..."
        break
    fi
    sleep 2
    peer_elapsed=$((peer_elapsed + 2))
    if [ $((peer_elapsed % 10)) -eq 0 ]; then
        echo "   Waiting for peer... ($peer_elapsed/$peer_timeout seconds)"
    fi
done

if nc -z peer0.amarvote.com 7051 2>/dev/null; then
    echo "✓ Peer is ready"
fi

# Wait for orderer to be ready
echo "⏳ Waiting for orderer to be ready..."
orderer_timeout=60
orderer_elapsed=0
while ! nc -z orderer.amarvote.com 7050 2>/dev/null; do
    if [ $orderer_elapsed -ge $orderer_timeout ]; then
        echo "⚠️  Orderer not responding, but continuing..."
        break
    fi
    sleep 2
    orderer_elapsed=$((orderer_elapsed + 2))
done

if nc -z orderer.amarvote.com 7050 2>/dev/null; then
    echo "✓ Orderer is ready"
fi

# Additional wait for channel setup
echo "⏳ Waiting for channel setup (30s)..."
sleep 30

# Try to enroll admin
if [ -f "/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem" ]; then
    echo "🔑 Enrolling admin identity..."
    node enrollAdmin.js || echo "⚠️  Admin enrollment failed, will retry on API calls"
    echo "✓ Enrollment attempted"
else
    echo "⚠️  Crypto materials still not found, skipping enrollment"
fi

# Start the server
echo "🌐 Starting blockchain API server..."
echo "✓ API will be available on port ${PORT:-3000}"
exec node server.js
