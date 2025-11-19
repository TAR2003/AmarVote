#!/bin/bash

# AmarVote Cloud Deployment Script
# This script rebuilds and restarts the services with fixes

set -e

echo "========================================"
echo "  AmarVote Cloud Deployment"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ docker-compose not found${NC}"
    echo "Please install docker-compose first"
    exit 1
fi

echo -e "${GREEN}✓ docker-compose found${NC}"
echo ""

# Stop all services
echo -e "${YELLOW}Stopping all services...${NC}"
docker-compose -f docker-compose.prod.yml down
echo -e "${GREEN}✓ Services stopped${NC}"
echo ""

# Remove blockchain-api container and volume (to ensure fresh enrollment)
echo -e "${YELLOW}Removing blockchain-api container and wallet...${NC}"
docker rm -f blockchain_api 2>/dev/null || true
docker volume rm amarvote_fabric_shared 2>/dev/null || true
echo -e "${GREEN}✓ Cleaned up old blockchain data${NC}"
echo ""

# Rebuild services
echo -e "${YELLOW}Rebuilding services...${NC}"
echo "  - frontend (with fixed nginx config)"
echo "  - blockchain-api (with fixed enrollment)"
docker-compose -f docker-compose.prod.yml build frontend blockchain-api
echo -e "${GREEN}✓ Services rebuilt${NC}"
echo ""

# Start all services
echo -e "${YELLOW}Starting all services...${NC}"
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Wait for services to initialize
echo -e "${YELLOW}Waiting for services to initialize (60 seconds)...${NC}"
sleep 60
echo ""

# Check service status
echo "========================================"
echo "  Service Status"
echo "========================================"
echo ""

services=("amarvote_backend" "amarvote_frontend" "blockchain_api" "orderer.amarvote.com" "peer0.amarvote.com" "cli")

for service in "${services[@]}"; do
    if docker ps | grep -q "$service"; then
        echo -e "${GREEN}✓ $service${NC} - Running"
    else
        echo -e "${RED}✗ $service${NC} - Not Running"
    fi
done

echo ""
echo "========================================"
echo "  Check Blockchain API Logs"
echo "========================================"
echo ""
echo "Run this command to monitor blockchain-api startup:"
echo -e "${YELLOW}docker logs blockchain_api -f${NC}"
echo ""
echo "Look for these success messages:"
echo -e "${GREEN}  ✓ Crypto materials found!"
echo -e "  ✓ Successfully enrolled admin"
echo -e "  ✓ Admin identity found in wallet${NC}"
echo ""
echo "If you see errors, the logs will show what went wrong."
echo ""
echo "========================================"
echo "  Access Your Application"
echo "========================================"
echo ""
echo "Frontend: http://YOUR-CLOUD-IP"
echo "Backend:  http://YOUR-CLOUD-IP:8080"
echo ""
echo "Deployment complete!"
