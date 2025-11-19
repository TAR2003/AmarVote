#!/bin/bash
# Pre-deployment checklist and verification script

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}AmarVote VM Deployment Checklist${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Function to check pass
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

# Function to check fail
check_fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

# Function to check warning
check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

echo -e "${BLUE}1. Checking required files...${NC}"

# Check deployment scripts
if [ -f "fix-vm-deployment.sh" ]; then
    check_pass "fix-vm-deployment.sh exists"
else
    check_fail "fix-vm-deployment.sh missing"
fi

if [ -f "vm-commands.sh" ]; then
    check_pass "vm-commands.sh exists"
else
    check_fail "vm-commands.sh missing"
fi

# Check docker-compose file
if [ -f "docker-compose.prod.yml" ]; then
    check_pass "docker-compose.prod.yml exists"
else
    check_fail "docker-compose.prod.yml missing"
fi

# Check blockchain-api files
if [ -f "blockchain-api/enrollAdmin.js" ]; then
    check_pass "blockchain-api/enrollAdmin.js exists"
else
    check_fail "blockchain-api/enrollAdmin.js missing"
fi

if [ -f "blockchain-api/start.sh" ]; then
    check_pass "blockchain-api/start.sh exists"
else
    check_fail "blockchain-api/start.sh missing"
fi

# Check fabric network scripts
if [ -f "fabric-network/scripts/auto-setup.sh" ]; then
    check_pass "fabric-network/scripts/auto-setup.sh exists"
else
    check_fail "fabric-network/scripts/auto-setup.sh missing"
fi

if [ -f "fabric-network/scripts/generate-artifacts-docker.sh" ]; then
    check_pass "fabric-network/scripts/generate-artifacts-docker.sh exists"
else
    check_fail "fabric-network/scripts/generate-artifacts-docker.sh missing"
fi

# Check chaincode
if [ -d "fabric-network/chaincode/election-logs" ]; then
    check_pass "Chaincode directory exists"
else
    check_fail "Chaincode directory missing"
fi

echo ""
echo -e "${BLUE}2. Checking system requirements...${NC}"

# Check Docker
if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
    DOCKER_VERSION=$(docker --version)
    echo "   Version: $DOCKER_VERSION"
else
    check_fail "Docker is not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    check_pass "Docker Compose is installed"
    COMPOSE_VERSION=$(docker-compose --version)
    echo "   Version: $COMPOSE_VERSION"
else
    check_fail "Docker Compose is not installed"
fi

# Check Docker daemon
if docker info &> /dev/null; then
    check_pass "Docker daemon is running"
else
    check_fail "Docker daemon is not running"
fi

# Check disk space
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
echo "   Available disk space: $AVAILABLE_SPACE"
if [ "$(df . | awk 'NR==2 {print $4}')" -gt 10485760 ]; then
    check_pass "Sufficient disk space (>10GB)"
else
    check_warn "Low disk space (<10GB)"
fi

echo ""
echo -e "${BLUE}3. Checking environment variables...${NC}"

# Check for .env file
if [ -f ".env" ]; then
    check_pass ".env file exists"
    
    # Check required variables
    if grep -q "NEON_HOST" .env; then
        check_pass "Database configuration found"
    else
        check_warn "Database configuration may be incomplete"
    fi
    
    if grep -q "JWT_SECRET" .env; then
        check_pass "JWT secret configured"
    else
        check_warn "JWT secret not found"
    fi
    
    if grep -q "MASTER_KEY_PQ" .env; then
        check_pass "Master key configured"
    else
        check_warn "Master key not found"
    fi
else
    check_warn ".env file not found (may cause issues)"
fi

echo ""
echo -e "${BLUE}4. Checking ports...${NC}"

# Function to check if port is in use
check_port() {
    if netstat -tuln 2>/dev/null | grep -q ":$1 "; then
        return 0
    elif ss -tuln 2>/dev/null | grep -q ":$1 "; then
        return 0
    else
        return 1
    fi
}

# Check critical ports
PORTS=(80 3000 5000 5001 5984 7050 7051 8080)
PORT_NAMES=("Frontend" "Blockchain-API" "ElectionGuard" "RAG-Service" "CouchDB" "Orderer" "Peer" "Backend")

for i in "${!PORTS[@]}"; do
    if check_port "${PORTS[$i]}"; then
        check_warn "Port ${PORTS[$i]} (${PORT_NAMES[$i]}) is already in use"
    else
        check_pass "Port ${PORTS[$i]} (${PORT_NAMES[$i]}) is available"
    fi
done

echo ""
echo -e "${BLUE}5. Checking existing containers...${NC}"

# Check if containers are running
if docker ps | grep -q "amarvote"; then
    check_warn "AmarVote containers are already running"
    echo "   Tip: Stop them with: docker-compose -f docker-compose.prod.yml down"
else
    check_pass "No conflicting containers running"
fi

# Check for old volumes
if docker volume ls | grep -q "amarvote"; then
    check_warn "Old AmarVote volumes exist"
    echo "   Tip: They will be cleaned by fix-vm-deployment.sh"
else
    check_pass "No old volumes found"
fi

echo ""
echo -e "${BLUE}6. Checking script permissions...${NC}"

# Check if scripts are executable
if [ -x "fix-vm-deployment.sh" ]; then
    check_pass "fix-vm-deployment.sh is executable"
else
    check_warn "fix-vm-deployment.sh is not executable"
    echo "   Fix: chmod +x fix-vm-deployment.sh"
fi

if [ -x "vm-commands.sh" ]; then
    check_pass "vm-commands.sh is executable"
else
    check_warn "vm-commands.sh is not executable"
    echo "   Fix: chmod +x vm-commands.sh"
fi

if [ -x "blockchain-api/start.sh" ]; then
    check_pass "blockchain-api/start.sh is executable"
else
    check_warn "blockchain-api/start.sh is not executable"
    echo "   Fix: chmod +x blockchain-api/start.sh"
fi

echo ""
echo -e "${BLUE}7. Verifying network configuration...${NC}"

# Check if network already exists
if docker network ls | grep -q "amarvote_election_net"; then
    check_warn "Network amarvote_election_net already exists"
else
    check_pass "Network name is available"
fi

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠ Cannot proceed with deployment. Please fix the failed checks above.${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Warnings detected. Deployment may proceed but review warnings above.${NC}"
    echo ""
    read -p "Do you want to proceed with deployment? (yes/no): " PROCEED
    if [ "$PROCEED" != "yes" ]; then
        echo -e "${YELLOW}Deployment cancelled.${NC}"
        exit 0
    fi
fi

echo -e "${GREEN}✓ All checks passed! Ready for deployment.${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Run: ./fix-vm-deployment.sh"
echo "2. Wait for deployment to complete (3-5 minutes)"
echo "3. Verify with: curl http://localhost:3000/api/blockchain/health"
echo "4. Use vm-commands.sh for ongoing management"
echo ""
echo -e "${BLUE}Quick fix commands if needed:${NC}"
echo "  chmod +x *.sh blockchain-api/*.sh fabric-network/scripts/*.sh"
echo "  docker-compose -f docker-compose.prod.yml down -v"
echo ""

exit 0
