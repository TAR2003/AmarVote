#!/bin/bash

echo "=========================================="
echo "  RESETTING BLOCKCHAIN NETWORK"
echo "=========================================="

# Stop all containers
echo "Stopping all containers..."
docker-compose -f docker-compose.prod.yml down -v

# Remove all blockchain volumes (try both with and without prefix)
echo "Removing blockchain volumes..."
docker volume rm amarvote_fabric_shared 2>/dev/null || echo "  fabric_shared volume removed or doesn't exist"
docker volume rm amarvote_orderer_data 2>/dev/null || echo "  orderer_data volume removed or doesn't exist"
docker volume rm amarvote_peer_data 2>/dev/null || echo "  peer_data volume removed or doesn't exist"
docker volume rm amarvote_couchdb_data 2>/dev/null || echo "  couchdb_data volume removed or doesn't exist"

# Also try without prefix
docker volume rm fabric_shared 2>/dev/null || true
docker volume rm orderer_data 2>/dev/null || true
docker volume rm peer_data 2>/dev/null || true
docker volume rm couchdb_data 2>/dev/null || true

# Clean up any leftover chaincode containers
echo "Cleaning up chaincode containers..."
docker ps -a | grep "dev-peer" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || echo "  No chaincode containers found"

# Clean up chaincode images
echo "Cleaning up chaincode images..."
docker images | grep "dev-peer" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || echo "  No chaincode images found"

# Remove blockchain-api wallet
echo "Removing blockchain-api wallet..."
rm -rf blockchain-api/wallet 2>/dev/null || echo "  Wallet directory removed or doesn't exist"

# Clean up any stale network
echo "Cleaning up Docker networks..."
docker network rm amarvote_election_net 2>/dev/null || echo "  Network removed or doesn't exist"

echo ""
echo "=========================================="
echo "  ✓ BLOCKCHAIN RESET COMPLETE"
echo "=========================================="
echo ""
echo "Now start fresh with:"
echo "  docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "Monitor the logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
