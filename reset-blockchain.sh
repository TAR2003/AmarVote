#!/bin/bash

echo "=========================================="
echo "  RESETTING BLOCKCHAIN NETWORK"
echo "=========================================="

# Stop all containers
echo "Stopping all containers..."
docker-compose -f docker-compose.prod.yml down

# Remove all blockchain volumes
echo "Removing blockchain volumes..."
docker volume rm amarvote_fabric_shared 2>/dev/null || echo "fabric_shared volume doesn't exist"
docker volume rm amarvote_orderer_data 2>/dev/null || echo "orderer_data volume doesn't exist"
docker volume rm amarvote_peer_data 2>/dev/null || echo "peer_data volume doesn't exist"
docker volume rm amarvote_couchdb_data 2>/dev/null || echo "couchdb_data volume doesn't exist"

# Clean up any leftover chaincode containers
echo "Cleaning up chaincode containers..."
docker ps -a | grep "dev-peer" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true

# Clean up chaincode images
echo "Cleaning up chaincode images..."
docker images | grep "dev-peer" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# Remove blockchain-api wallet
echo "Removing blockchain-api wallet..."
docker run --rm -v "$(pwd)/blockchain-api:/app" alpine sh -c "rm -rf /app/wallet" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  ✓ BLOCKCHAIN RESET COMPLETE"
echo "=========================================="
echo ""
echo "Now you can start fresh with:"
echo "  docker-compose -f docker-compose.prod.yml up -d"
echo ""
