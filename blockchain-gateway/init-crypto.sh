#!/bin/sh

echo "🔧 Initializing crypto materials..."

# Create writable crypto directory
mkdir -p /app/crypto-local

# Copy crypto materials to writable location
cp -r /app/crypto-config/* /app/crypto-local/

# Change ownership to nodejs user
chown -R nodejs:nodejs /app/crypto-local /app/wallets

echo "✅ Crypto materials initialized"

# Now run the admin setup as nodejs user
echo "🔧 Setting up admin identity..."
su -s /bin/sh nodejs -c "cd /app && node setup-admin.js"

# Ensure wallet ownership is correct
chown -R nodejs:nodejs /app/wallets

echo "🚀 Starting gateway server..."
exec su -s /bin/sh nodejs -c "cd /app && node server.js"
