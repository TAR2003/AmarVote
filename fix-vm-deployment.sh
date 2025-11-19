#!/bin/bash
# Fix for Debian VM Deployment Issues
# This script resolves certificate and chaincode issues

set -e

echo "🔧 AmarVote VM Deployment Fix Script"
echo "===================================="

# Check Docker socket permissions
echo "🔍 Checking Docker socket permissions..."
if [ ! -w /var/run/docker.sock ]; then
    echo "❌ Docker socket is not writable!"
    echo "Run: sudo chmod 666 /var/run/docker.sock"
    echo "Or run: sudo ./fix-docker-permissions.sh"
    exit 1
fi
echo "✓ Docker socket is accessible"

# Step 1: Stop all containers
echo "⏹️  Stopping all containers..."
docker-compose -f docker-compose.prod.yml down -v

# Step 2: Clean old volumes and data
echo "🧹 Cleaning old volumes and certificates..."
docker volume rm amarvote_fabric_shared 2>/dev/null || true
docker volume rm amarvote_orderer_data 2>/dev/null || true
docker volume rm amarvote_peer_data 2>/dev/null || true
docker volume rm amarvote_couchdb_data 2>/dev/null || true

# Remove blockchain-api wallet
rm -rf ./blockchain-api/wallet/*

# Step 3: Rebuild images
echo "🔨 Rebuilding Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache blockchain-api

# Step 4: Start fabric-tools first to generate fresh crypto
echo "🔑 Generating fresh cryptographic materials..."
docker-compose -f docker-compose.prod.yml up -d fabric-tools

# Wait for crypto generation
echo "⏳ Waiting for crypto generation (30 seconds)..."
sleep 30

# Step 5: Start network infrastructure
echo "🚀 Starting Hyperledger Fabric network..."
docker-compose -f docker-compose.prod.yml up -d orderer.amarvote.com peer0.amarvote.com couchdb

# Wait for network to be ready
echo "⏳ Waiting for network initialization (45 seconds)..."
sleep 45

# Step 6: Start CLI and run auto-setup
echo "⚙️  Starting CLI and running channel setup..."
docker-compose -f docker-compose.prod.yml up -d cli

# Wait for channel setup
echo "⏳ Waiting for channel and chaincode deployment (60 seconds)..."
sleep 60

# Step 7: Start blockchain-api
echo "🔌 Starting blockchain API..."
docker-compose -f docker-compose.prod.yml up -d blockchain-api

# Wait for API to enroll admin
echo "⏳ Waiting for admin enrollment (15 seconds)..."
sleep 15

# Step 8: Start application services
echo "🌐 Starting application services..."
docker-compose -f docker-compose.prod.yml up -d backend frontend electionguard rag-service

echo ""
echo "✅ Deployment fix completed!"
echo ""
echo "📊 Checking status..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🔍 To verify blockchain API:"
echo "   docker logs blockchain_api"
echo ""
echo "🔍 To verify peer:"
echo "   docker logs peer0.amarvote.com"
echo ""
echo "🧪 To test blockchain API:"
echo "   curl http://localhost:3000/api/blockchain/health"
