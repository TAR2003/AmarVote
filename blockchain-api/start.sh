#!/bin/sh
set -e

echo "Starting blockchain API initialization..."

# Wait for crypto materials to be available
max_attempts=30
attempt=0
while [ ! -f "/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem" ]; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "Crypto materials not found after $max_attempts attempts"
        echo "Starting without enrollment (will retry later)..."
        break
    fi
    echo "Waiting for crypto materials... (attempt $attempt/$max_attempts)"
    sleep 5
done

# Wait for peer to be ready
echo "Waiting for peer to be ready..."
sleep 20

# Try to enroll admin
if [ -f "/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem" ]; then
    echo "Enrolling admin identity..."
    node enrollAdmin.js || echo "Admin enrollment failed, will retry on API calls"
fi

# Start the server
echo "Starting blockchain API server..."
exec node server.js
