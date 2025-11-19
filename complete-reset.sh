#!/bin/bash

echo "=========================================="
echo "  COMPLETE BLOCKCHAIN RESET"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will:"
echo "  - Stop all containers"
echo "  - Remove ALL volumes (including data)"
echo "  - Remove ALL chaincode containers/images"
echo "  - Delete ALL blockchain state"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Reset cancelled."
    exit 0
fi

echo ""
echo "Starting complete reset..."
echo ""

# Stop all containers
echo "1. Stopping all containers..."
docker-compose -f docker-compose.prod.yml down -v --remove-orphans

# Stop any running containers related to the project
echo "2. Stopping any orphaned containers..."
docker ps -a | grep -E "amarvote|hyperledger|couchdb|dev-peer" | awk '{print $1}' | xargs -r docker stop 2>/dev/null || true
docker ps -a | grep -E "amarvote|hyperledger|couchdb|dev-peer" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true

# Remove all volumes (try multiple patterns)
echo "3. Removing all volumes..."
docker volume ls | grep -E "amarvote|fabric|orderer|peer|couchdb" | awk '{print $2}' | xargs -r docker volume rm -f 2>/dev/null || true

# Clean up chaincode containers
echo "4. Cleaning up chaincode containers..."
docker ps -a | grep "dev-peer" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true

# Clean up chaincode images
echo "5. Cleaning up chaincode images..."
docker images | grep "dev-peer" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# Remove blockchain-api wallet
echo "6. Removing blockchain-api wallet..."
rm -rf blockchain-api/wallet 2>/dev/null || true

# Remove network
echo "7. Removing Docker network..."
docker network rm amarvote_election_net 2>/dev/null || true

# Prune Docker system
echo "8. Pruning Docker system..."
docker system prune -f --volumes 2>/dev/null || true

echo ""
echo "=========================================="
echo "  ✓ COMPLETE RESET FINISHED"
echo "=========================================="
echo ""
echo "Now start fresh with:"
echo "  docker-compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "Monitor the setup:"
echo "  docker-compose -f docker-compose.prod.yml logs -f cli"
echo ""
