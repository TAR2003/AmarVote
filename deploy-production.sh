#!/bin/bash

# AmarVote Production Deployment with Blockchain
# This script deploys the complete AmarVote stack including Hyperledger Fabric blockchain

set -e

echo "🚀 Starting AmarVote Production Deployment with Blockchain..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check prerequisites
print_status "Checking prerequisites..."

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

# Check if environment file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating template..."
    cat > .env << EOF
# Database Configuration (Required)
NEON_HOST=your-neon-host
NEON_PORT=5432
NEON_DATABASE=your-database
NEON_USERNAME=your-username
NEON_PASSWORD=your-password

# Security Configuration
MASTER_KEY_PQ=your-master-key

# Optional: SSL Configuration
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
EOF
    print_error "Please configure the .env file with your database credentials and run again."
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
if [ -z "$NEON_HOST" ] || [ -z "$NEON_USERNAME" ] || [ -z "$NEON_PASSWORD" ]; then
    print_error "Database configuration missing in .env file. Please check NEON_HOST, NEON_USERNAME, and NEON_PASSWORD."
    exit 1
fi

print_status "Environment validated successfully"

# Clean up any existing containers
print_status "Cleaning up existing containers..."
docker-compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || true

# Remove orphaned containers and networks
docker container prune -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true

print_status "Building and starting services..."

# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

print_status "Waiting for services to be ready..."

# Wait for services to start
sleep 30

# Check service health
print_status "Checking service health..."

SERVICES=(
    "orderer.amarvote.com:7050"
    "peer0.org1.amarvote.com:7051"
    "peer1.org1.amarvote.com:8051"
    "blockchain_gateway:3001"
    "amarvote_backend:8080"
    "amarvote_frontend:80"
    "electionguard_service:5000"
    "rag_service:5001"
)

ALL_HEALTHY=true

for service in "${SERVICES[@]}"; do
    container_name=$(echo $service | cut -d':' -f1)
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        print_success "$container_name is running"
    else
        print_error "$container_name is not running"
        ALL_HEALTHY=false
    fi
done

# Test blockchain connectivity
print_status "Testing blockchain connectivity..."

# Wait a bit more for blockchain to be ready
sleep 20

# Test blockchain gateway health
if curl -s --max-time 10 http://localhost:3001/health | grep -q "healthy"; then
    print_success "Blockchain gateway is healthy"
else
    print_warning "Blockchain gateway health check failed - may still be starting"
fi

# Test chaincode (if available)
CHAINCODE_TEST=$(docker exec peer0.org1.amarvote.com peer chaincode query -C mychannel -n ballot-verification -c '{"Args":["GetAllBallots"]}' 2>/dev/null || echo "failed")
if [ "$CHAINCODE_TEST" != "failed" ]; then
    print_success "Chaincode is responding"
else
    print_warning "Chaincode not ready - will be deployed automatically on first use"
fi

# Test application endpoints
print_status "Testing application endpoints..."

# Test backend health
if curl -s --max-time 10 http://localhost:8080/actuator/health | grep -q "UP"; then
    print_success "Backend is healthy"
else
    print_warning "Backend health check failed - may still be starting"
fi

# Test frontend
if curl -s --max-time 10 http://localhost:80 >/dev/null 2>&1; then
    print_success "Frontend is responding"
else
    print_warning "Frontend not yet responding - may still be starting"
fi

if [ "$ALL_HEALTHY" = true ]; then
    print_success "🎉 AmarVote Production Deployment Complete!"
else
    print_warning "⚠️ Some services may still be starting. Check logs if issues persist."
fi

echo ""
echo "📊 Production Deployment Status:"
echo "  🌐 Frontend: http://localhost (HTTP) / https://localhost (HTTPS)"
echo "  🔧 Backend API: http://localhost:8080"
echo "  🛡️ ElectionGuard: http://localhost:5000"
echo "  🤖 RAG Service: http://localhost:5001"
echo "  ⛓️ Blockchain Gateway: http://localhost:3001"
echo "  📦 Fabric Orderer: localhost:7050"
echo "  🔗 Fabric Peer0: localhost:7051"
echo "  🔗 Fabric Peer1: localhost:8051"
echo ""
echo "🔧 Management Commands:"
echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f [service]"
echo "  Stop all: docker-compose -f docker-compose.prod.yml down"
echo "  Restart: docker-compose -f docker-compose.prod.yml restart [service]"
echo "  Scale: docker-compose -f docker-compose.prod.yml up -d --scale [service]=[number]"
echo ""
echo "🔍 Health Checks:"
echo "  Backend: curl http://localhost:8080/actuator/health"
echo "  Blockchain: curl http://localhost:3001/health"
echo "  Containers: docker ps"
echo ""
echo "📝 Logs:"
echo "  All services: docker-compose -f docker-compose.prod.yml logs -f"
echo "  Blockchain: docker-compose -f docker-compose.prod.yml logs -f blockchain-gateway"
echo "  Backend: docker-compose -f docker-compose.prod.yml logs -f backend"
echo ""
print_status "🗳️ AmarVote with Blockchain is ready for production! ⛓️"

# Show next steps
echo ""
echo "🚀 Next Steps:"
echo "  1. Configure your domain DNS to point to this server"
echo "  2. Set up SSL certificates (Let's Encrypt recommended)"
echo "  3. Configure reverse proxy (Nginx recommended)"
echo "  4. Set up monitoring and backup procedures"
echo "  5. Configure firewall rules for production"
echo ""
echo "📚 Documentation:"
echo "  - Blockchain: ./BLOCKCHAIN_IMPLEMENTATION.md"
echo "  - Complete Guide: ./BLOCKCHAIN_COMPLETE.md"
echo "  - Testing: ./test-blockchain.sh"
