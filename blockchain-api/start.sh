#!/bin/sh
set -e

echo "========================================"
echo "  Blockchain API Initialization"
echo "========================================"

# Wait for crypto materials to be available
max_attempts=60
attempt=0
cert_path="/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem"
key_path="/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/keystore/priv_sk"

echo "Waiting for crypto materials..."
while [ ! -f "$cert_path" ] || [ ! -f "$key_path" ]; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "✗ Crypto materials not found after $max_attempts attempts"
        echo "Expected files:"
        echo "  - $cert_path"
        echo "  - $key_path"
        echo "Listing /shared directory:"
        ls -la /shared/ || echo "Cannot list /shared"
        exit 1
    fi
    echo "  Waiting... (attempt $attempt/$max_attempts)"
    sleep 3
done

echo "✓ Crypto materials found!"
echo "  Certificate: $cert_path"
echo "  Private Key: $key_path"

# Wait for peer and orderer to be ready
echo ""
echo "Waiting for Fabric network to be ready..."
sleep 15

# Wait for channel to be created by CLI
echo "Waiting for channel creation..."
max_channel_wait=40
channel_attempt=0
while [ $channel_attempt -lt $max_channel_wait ]; do
    # Check if CLI setup is complete by looking for a marker or just wait
    channel_attempt=$((channel_attempt + 1))
    echo "  Channel wait attempt $channel_attempt/$max_channel_wait"
    sleep 3
    
    # After some attempts, try to verify peer is accessible
    if [ $channel_attempt -ge 20 ]; then
        break
    fi
done

echo "✓ Network should be ready"

# Clean old wallet completely (fresh start to avoid stale certificates)
echo ""
echo "Cleaning wallet directory..."
if [ -d "/app/wallet" ]; then
    rm -rf /app/wallet
    echo "✓ Old wallet removed"
fi
mkdir -p /app/wallet
echo "✓ Fresh wallet directory created"

# Verify crypto materials are valid
echo ""
echo "Verifying crypto materials..."
if ! grep -q "BEGIN CERTIFICATE" "$cert_path"; then
    echo "✗ Invalid certificate format"
    exit 1
fi
if ! grep -q "PRIVATE KEY" "$key_path"; then
    echo "✗ Invalid private key format"
    exit 1
fi
echo "✓ Crypto materials format validated"

# Enroll admin (this must succeed)
echo ""
echo "Enrolling admin identity..."
if ! node enrollAdmin.js; then
    echo "✗ Admin enrollment FAILED - cannot continue"
    echo "Debugging info:"
    echo "Checking crypto files:"
    ls -la "$cert_path" || echo "Cert file not found"
    ls -la "$key_path" || echo "Key file not found"
    echo "Certificate content (first 5 lines):"
    head -n 5 "$cert_path" || echo "Cannot read cert"
    exit 1
fi

echo ""
echo "========================================"
echo "  Starting Blockchain API Server"
echo "========================================"
echo ""

# Start the server
exec node server.js
