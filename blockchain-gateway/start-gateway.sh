#!/bin/bash

# Start Blockchain Gateway Service for AmarVote
echo "🚀 Starting AmarVote Blockchain Gateway Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14.0.0 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "📦 Node.js version: $NODE_VERSION"

# Navigate to gateway directory
cd "$(dirname "$0")"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the blockchain-gateway directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies."
        exit 1
    fi
fi

# Check if Hyperledger Fabric network is running
echo "🔍 Checking Hyperledger Fabric network..."
FABRIC_NETWORK_PATH="../blockchain-network"

if [ ! -d "$FABRIC_NETWORK_PATH" ]; then
    echo "⚠️  Fabric network directory not found at $FABRIC_NETWORK_PATH"
    echo "   Please ensure the blockchain network is set up properly."
fi

# Check for wallet
WALLET_PATH="../blockchain-network/wallet"
if [ ! -d "$WALLET_PATH" ]; then
    echo "⚠️  Wallet directory not found at $WALLET_PATH"
    echo "   Please ensure the Fabric wallet is properly configured."
fi

# Check for connection profile
CONNECTION_PROFILE="../blockchain-network/artifacts/channel/connection-profile.json"
if [ ! -f "$CONNECTION_PROFILE" ]; then
    echo "⚠️  Connection profile not found at $CONNECTION_PROFILE"
    echo "   Please ensure the Fabric network configuration is complete."
fi

# Set environment variables
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3001}

echo "🌐 Environment: $NODE_ENV"
echo "🔌 Port: $PORT"

# Start the gateway service
echo "🚀 Starting Blockchain Gateway Service..."
echo "   - Health check will be available at: http://localhost:$PORT/health"
echo "   - API endpoints available at: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the service"
echo "=================================================="

# Start the server
npm start
