#!/bin/bash

# AmarVote Blockchain Network Startup Script
# This script starts the complete Hyperledger Fabric network for AmarVote

set -e

echo "🚀 Starting AmarVote Blockchain Network..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose >/dev/null 2>&1; then
    print_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Navigate to blockchain network directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BLOCKCHAIN_DIR="$SCRIPT_DIR/blockchain-network"

if [ ! -d "$BLOCKCHAIN_DIR" ]; then
    print_error "Blockchain network directory not found: $BLOCKCHAIN_DIR"
    exit 1
fi

cd "$BLOCKCHAIN_DIR"

print_status "Cleaning up any existing containers and networks..."

# Stop and remove existing containers
docker-compose down -v --remove-orphans 2>/dev/null || true

# Remove any orphaned containers
docker container prune -f 2>/dev/null || true

# Remove any unused networks
docker network prune -f 2>/dev/null || true

print_status "Starting Hyperledger Fabric network..."

# Start the network
docker-compose up -d

# Wait for containers to be ready
print_status "Waiting for containers to be ready..."
sleep 10

# Check if containers are running
CONTAINERS=(
    "peer0.org1.amarvote.com"
    "orderer.amarvote.com"
    "ca.org1.amarvote.com"
)

for container in "${CONTAINERS[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "$container"; then
        print_success "$container is running"
    else
        print_error "$container is not running"
        docker logs "$container" 2>/dev/null || true
        exit 1
    fi
done

print_status "Deploying ballot verification chaincode..."

# Deploy chaincode
if [ -f "./scripts/deploy-chaincode.sh" ]; then
    chmod +x ./scripts/deploy-chaincode.sh
    ./scripts/deploy-chaincode.sh
    if [ $? -eq 0 ]; then
        print_success "Chaincode deployed successfully"
    else
        print_error "Failed to deploy chaincode"
        exit 1
    fi
else
    print_warning "Chaincode deployment script not found. Skipping chaincode deployment."
fi

print_status "Starting Node.js blockchain gateway..."

# Start the blockchain gateway
GATEWAY_DIR="$SCRIPT_DIR/blockchain-gateway"
if [ -d "$GATEWAY_DIR" ]; then
    cd "$GATEWAY_DIR"
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing Node.js dependencies..."
        npm install
    fi
    
    # Start the gateway in background
    print_status "Starting blockchain gateway on port 3001..."
    nohup npm start > gateway.log 2>&1 &
    GATEWAY_PID=$!
    echo $GATEWAY_PID > gateway.pid
    
    # Wait a bit and check if it's running
    sleep 5
    if kill -0 $GATEWAY_PID 2>/dev/null; then
        print_success "Blockchain gateway started (PID: $GATEWAY_PID)"
    else
        print_error "Failed to start blockchain gateway"
        cat gateway.log
        exit 1
    fi
else
    print_warning "Blockchain gateway directory not found: $GATEWAY_DIR"
fi

# Check network health
print_status "Checking network health..."

# Test orderer connection
if docker exec peer0.org1.amarvote.com peer channel list >/dev/null 2>&1; then
    print_success "Peer can connect to orderer"
else
    print_warning "Peer cannot connect to orderer - check network configuration"
fi

# Test chaincode if deployed
CHAINCODE_TEST=$(docker exec peer0.org1.amarvote.com peer chaincode query -C mychannel -n ballot-verification -c '{"Args":["GetAllBallots"]}' 2>/dev/null || echo "failed")
if [ "$CHAINCODE_TEST" != "failed" ]; then
    print_success "Chaincode is responding"
else
    print_warning "Chaincode is not responding - may need manual deployment"
fi

print_success "🎉 AmarVote Blockchain Network is ready!"
echo ""
echo "📊 Network Status:"
echo "  - Fabric Network: Running on docker network"
echo "  - Orderer: orderer.amarvote.com:7050"
echo "  - Peer: peer0.org1.amarvote.com:7051"
echo "  - CA: ca.org1.amarvote.com:7054"
echo "  - Gateway API: http://localhost:3001"
echo ""
echo "🔧 Management Commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop network: docker-compose down"
echo "  - Restart: docker-compose restart"
echo "  - Stop gateway: kill \$(cat $GATEWAY_DIR/gateway.pid 2>/dev/null || echo '')"
echo ""
echo "🔍 Health Check:"
echo "  - Network: curl -s http://localhost:3001/health"
echo "  - Containers: docker ps"
echo ""
print_status "Ready for blockchain ballot verification! 🗳️"
