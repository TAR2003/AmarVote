#!/bin/bash

# ========================================
# AmarVote Cloud Deployment Script
# ========================================
# This script deploys AmarVote to a Linux cloud VM
# Usage: ./deploy-to-cloud.sh

set -e

echo ""
echo "=========================================="
echo "  AMARVOTE CLOUD DEPLOYMENT"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with all required environment variables."
    exit 1
fi

echo "✓ .env file found"

# Load environment variables
source .env

# Check for required variables
REQUIRED_VARS=(
    "NEON_HOST"
    "NEON_PORT"
    "NEON_DATABASE"
    "NEON_USERNAME"
    "NEON_PASSWORD"
    "MASTER_KEY_PQ"
    "DEEPSEEK_API_KEY"
    "JWT_SECRET"
    "MAIL_PASSWORD"
    "CLOUDINARY_NAME"
    "CLOUDINARY_KEY"
    "CLOUDINARY_SECRET"
)

echo ""
echo "Checking required environment variables..."
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
    echo "✓ $var is set"
done

echo ""
echo "=========================================="
echo "  STEP 1: Clean up old deployment"
echo "=========================================="
echo ""

# Stop and remove old containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Ask user if they want to reset blockchain
echo ""
read -p "Do you want to RESET the blockchain network? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Resetting blockchain network..."
    
    # Remove blockchain volumes
    docker volume rm amarvote_fabric_shared 2>/dev/null || true
    docker volume rm amarvote_orderer_data 2>/dev/null || true
    docker volume rm amarvote_peer_data 2>/dev/null || true
    docker volume rm amarvote_couchdb_data 2>/dev/null || true
    
    # Clean up chaincode containers and images
    docker ps -a | grep "dev-peer" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
    docker images | grep "dev-peer" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    
    # Remove blockchain-api wallet
    rm -rf blockchain-api/wallet 2>/dev/null || true
    
    echo "✓ Blockchain reset complete"
else
    echo "Keeping existing blockchain data..."
fi

echo ""
echo "=========================================="
echo "  STEP 2: Build Docker images"
echo "=========================================="
echo ""

# Build all services
echo "Building Docker images (this may take several minutes)..."
docker-compose -f docker-compose.prod.yml build

if [ $? -eq 0 ]; then
    echo "✓ Docker images built successfully"
else
    echo "❌ Failed to build Docker images"
    exit 1
fi

echo ""
echo "=========================================="
echo "  STEP 3: Start services"
echo "=========================================="
echo ""

# Start all services
echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

if [ $? -eq 0 ]; then
    echo "✓ Services started successfully"
else
    echo "❌ Failed to start services"
    exit 1
fi

echo ""
echo "=========================================="
echo "  STEP 4: Wait for services to be ready"
echo "=========================================="
echo ""

# Wait for services to be healthy
echo "Waiting for services to initialize (90 seconds)..."
sleep 90

echo ""
echo "=========================================="
echo "  STEP 5: Verify deployment"
echo "=========================================="
echo ""

# Check service status
echo "Checking service status..."
echo ""

services=(
    "amarvote_backend:8080"
    "amarvote_frontend:80"
    "electionguard_service:5000"
    "rag_service:5001"
    "orderer.amarvote.com:7050"
    "peer0.amarvote.com:7051"
    "couchdb:5984"
    "blockchain_api:3000"
)

all_running=true
for service in "${services[@]}"; do
    container_name="${service%%:*}"
    port="${service##*:}"
    
    if docker ps | grep -q "$container_name"; then
        echo "✓ $container_name is running"
    else
        echo "❌ $container_name is NOT running"
        all_running=false
    fi
done

echo ""

if [ "$all_running" = true ]; then
    echo "=========================================="
    echo "  ✓ DEPLOYMENT SUCCESSFUL!"
    echo "=========================================="
    echo ""
    echo "Your application is now running at:"
    echo "  Frontend: http://$(hostname -I | awk '{print $1}')"
    echo "  Backend API: http://$(hostname -I | awk '{print $1}'):8080"
    echo ""
    echo "To view logs:"
    echo "  All services: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  Backend only: docker logs amarvote_backend -f"
    echo "  Blockchain API: docker logs blockchain_api -f"
    echo ""
    echo "To stop services:"
    echo "  docker-compose -f docker-compose.prod.yml down"
    echo ""
else
    echo "=========================================="
    echo "  ⚠️  DEPLOYMENT COMPLETED WITH WARNINGS"
    echo "=========================================="
    echo ""
    echo "Some services are not running. Check logs with:"
    echo "  docker-compose -f docker-compose.prod.yml logs"
    echo ""
fi
