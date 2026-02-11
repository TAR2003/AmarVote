#!/bin/bash

# ElectionGuard Services Optimization Deployment Script
# This script deploys the optimized ElectionGuard services

set -e  # Exit on any error

echo "=========================================="
echo "ElectionGuard Services Optimization"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}Error: Must run from AmarVote root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Stopping existing services...${NC}"
docker-compose -f docker-compose.prod.yml down
echo -e "${GREEN}✓ Services stopped${NC}"
echo ""

echo -e "${YELLOW}Step 2: Building optimized images...${NC}"
echo "API Service: 8 workers × 4 threads = 32 concurrent handlers"
echo "Worker Service: 1 worker × 4 threads = 4 parallel crypto threads"
docker-compose -f docker-compose.prod.yml build electionguard-api electionguard-worker
echo -e "${GREEN}✓ Images built${NC}"
echo ""

echo -e "${YELLOW}Step 3: Starting all services...${NC}"
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

echo -e "${YELLOW}Step 4: Waiting for services to be ready...${NC}"
sleep 10
echo -e "${GREEN}✓ Services should be ready${NC}"
echo ""

echo -e "${YELLOW}Step 5: Verifying services...${NC}"
echo ""

# Check ElectionGuard API
echo -n "Checking ElectionGuard API (port 5000)... "
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Check ElectionGuard Worker
echo -n "Checking ElectionGuard Worker (port 5001)... "
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Check Backend
echo -n "Checking Backend (port 8080)... "
if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Check Frontend
echo -n "Checking Frontend (port 80)... "
if curl -s http://localhost:80 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

echo ""
echo -e "${YELLOW}Step 6: Displaying service status...${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(NAMES|amarvote|electionguard)"
echo ""

echo -e "${YELLOW}Step 7: Checking worker configuration...${NC}"
echo "ElectionGuard API workers:"
docker logs electionguard_api 2>&1 | grep "Booting worker" | wc -l | xargs echo "  Workers started:"
echo "ElectionGuard Worker threads:"
docker logs electionguard_worker 2>&1 | grep -i "thread\|worker" | head -5
echo ""

echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Performance Summary:"
echo "  • API Service: 8 workers × 4 threads = 32 concurrent handlers"
echo "  • Worker Service: 1 worker × 4 threads = 4 parallel crypto operations"
echo "  • API Memory: 768MB"
echo "  • Worker Memory: 1536MB"
echo ""
echo "Monitoring Commands:"
echo "  • View API logs:     docker logs -f electionguard_api"
echo "  • View Worker logs:  docker logs -f electionguard_worker"
echo "  • Monitor resources: docker stats electionguard_api electionguard_worker"
echo "  • Test API health:   curl http://localhost:5000/health"
echo "  • Test Worker health: curl http://localhost:5001/health"
echo ""
echo "For more details, see: docs/ELECTIONGUARD_PERFORMANCE_OPTIMIZATION.md"
