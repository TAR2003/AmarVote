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
sleep 30

# Enroll admin (this must succeed)
echo ""
echo "Enrolling admin identity..."
if ! node enrollAdmin.js; then
    echo "✗ Admin enrollment FAILED - cannot continue"
    exit 1
fi

echo ""
echo "========================================"
echo "  Starting Blockchain API Server"
echo "========================================"
echo ""

# Start the server
exec node server.js
