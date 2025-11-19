#!/bin/bash
# Pre-Deployment Validation Script for AmarVote
# Run this before deploying: bash validate-deployment.sh

echo "=========================================="
echo "  AmarVote Pre-Deployment Validation"
echo "=========================================="
echo ""

ERRORS=0

# Check 1: .env file exists
echo "✓ Checking .env file..."
if [ ! -f ".env" ]; then
    echo "  ✗ ERROR: .env file not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ .env file exists"
fi

# Check 2: Docker is installed
echo "✓ Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "  ✗ ERROR: Docker is not installed"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ Docker is installed: $(docker --version)"
fi

# Check 3: Docker Compose is installed
echo "✓ Checking Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo "  ✗ ERROR: Docker Compose is not installed"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ Docker Compose is installed: $(docker-compose --version)"
fi

# Check 4: Critical files exist
echo "✓ Checking critical files..."
FILES=(
    "docker-compose.prod.yml"
    "fabric-network/scripts/auto-setup.sh"
    "fabric-network/scripts/generate-artifacts-docker.sh"
    "fabric-network/chaincode/election-logs/Dockerfile"
    "fabric-network/chaincode/election-logs/start.sh"
    "fabric-network/chaincode/election-logs/package.json"
    "blockchain-api/start.sh"
    "blockchain-api/enrollAdmin.js"
)

for file in "${FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "  ✗ ERROR: Missing file: $file"
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $ERRORS -eq 0 ]; then
    echo "  ✓ All critical files present"
fi

# Check 5: Ports availability
echo "✓ Checking port availability..."
PORTS=(80 3000 5000 5001 5984 7050 7051 8080 9999)
for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "  ⚠ WARNING: Port $port is already in use"
    fi
done

# Check 6: Disk space
echo "✓ Checking disk space..."
AVAILABLE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE" -lt 20 ]; then
    echo "  ⚠ WARNING: Less than 20GB available ($AVAILABLE GB)"
else
    echo "  ✓ Sufficient disk space: ${AVAILABLE}GB available"
fi

# Check 7: Memory
echo "✓ Checking memory..."
TOTAL_MEM=$(free -g | grep Mem | awk '{print $2}')
if [ "$TOTAL_MEM" -lt 4 ]; then
    echo "  ⚠ WARNING: Less than 4GB RAM ($TOTAL_MEM GB)"
else
    echo "  ✓ Sufficient memory: ${TOTAL_MEM}GB RAM"
fi

# Check 8: Validate docker-compose.prod.yml syntax
echo "✓ Validating docker-compose.prod.yml..."
if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    echo "  ✓ docker-compose.prod.yml syntax is valid"
else
    echo "  ✗ ERROR: docker-compose.prod.yml has syntax errors"
    ERRORS=$((ERRORS + 1))
fi

# Check 9: Shell scripts are executable
echo "✓ Checking script permissions..."
SCRIPTS=(
    "fabric-network/scripts/auto-setup.sh"
    "fabric-network/scripts/generate-artifacts-docker.sh"
    "fabric-network/chaincode/election-logs/start.sh"
    "blockchain-api/start.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ] && [ ! -x "$script" ]; then
        echo "  ⚠ Making $script executable..."
        chmod +x "$script"
    fi
done
echo "  ✓ All scripts are executable"

echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "  ✓ Validation Passed!"
    echo "  Ready for deployment"
    echo ""
    echo "  To deploy, run:"
    echo "  sudo docker-compose -f docker-compose.prod.yml up -d --build"
else
    echo "  ✗ Validation Failed!"
    echo "  Found $ERRORS error(s)"
    echo "  Please fix the errors before deploying"
fi
echo "=========================================="
echo ""
