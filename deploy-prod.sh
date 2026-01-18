#!/bin/bash

###############################################################################
# AmarVote Production Deployment Script for 4GB RAM Server
# This script automates the deployment process
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

print_header "AmarVote Production Deployment - 4GB RAM Server"

# Check system resources
print_info "Checking system resources..."
TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 4 ]; then
    print_warning "System has less than 4GB RAM. Deployment may fail."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
print_success "RAM check passed: ${TOTAL_RAM}GB available"

# Check if Docker is installed
print_info "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Run: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    exit 1
fi
print_success "Docker is installed: $(docker --version)"

# Check if Docker Compose is installed
if ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed."
    exit 1
fi
print_success "Docker Compose is installed: $(docker compose version)"

# Check for .env file
print_info "Checking environment configuration..."
if [ ! -f .env ]; then
    print_warning ".env file not found!"
    read -p "Create from .env.example? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_warning "Created .env from .env.example. Please edit it with your values."
            exit 0
        else
            print_error ".env.example not found. Please create .env manually."
            exit 1
        fi
    else
        exit 1
    fi
fi
print_success ".env file exists"

# Check swap
print_info "Checking swap configuration..."
SWAP_SIZE=$(free -g | awk '/^Swap:/{print $2}')
if [ "$SWAP_SIZE" -eq 0 ]; then
    print_warning "No swap configured. This is recommended for 4GB RAM servers."
    read -p "Configure 2GB swap now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Creating swap file..."
        sudo fallocate -l 2G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        print_success "Swap configured: 2GB"
    fi
else
    print_success "Swap is configured: ${SWAP_SIZE}GB"
fi

# Stop existing containers
print_header "Stopping Existing Containers"
if docker compose -f docker-compose.prod.yml ps -q | grep -q .; then
    print_info "Stopping running containers..."
    docker compose -f docker-compose.prod.yml down
    print_success "Containers stopped"
else
    print_info "No running containers found"
fi

# Build images
print_header "Building Docker Images"
print_info "This may take 10-15 minutes on first build..."
docker compose -f docker-compose.prod.yml build
print_success "Images built successfully"

# Start services
print_header "Starting Services"
print_info "Starting all containers..."
docker compose -f docker-compose.prod.yml up -d
print_success "Containers started"

# Wait for services to be healthy
print_header "Waiting for Services to Start"

print_info "Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker exec amarvote_postgres pg_isready -U amarvote_user &> /dev/null; then
        print_success "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL failed to start"
        docker compose -f docker-compose.prod.yml logs postgres
        exit 1
    fi
    sleep 2
done

print_info "Waiting for RabbitMQ..."
for i in {1..30}; do
    if docker exec amarvote_rabbitmq rabbitmq-diagnostics -q ping &> /dev/null; then
        print_success "RabbitMQ is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "RabbitMQ failed to start"
        docker compose -f docker-compose.prod.yml logs rabbitmq
        exit 1
    fi
    sleep 2
done

print_info "Waiting for Backend..."
for i in {1..60}; do
    if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
        print_success "Backend is ready"
        break
    fi
    if [ $i -eq 60 ]; then
        print_error "Backend failed to start"
        docker compose -f docker-compose.prod.yml logs backend
        exit 1
    fi
    sleep 2
done

# Verify deployment
print_header "Verifying Deployment"

# Check container status
print_info "Container Status:"
docker compose -f docker-compose.prod.yml ps

# Check memory usage
print_info "Memory Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Print access information
print_header "Deployment Complete! 🎉"

echo ""
print_success "AmarVote is now running!"
echo ""
echo "📱 Access Information:"
echo "   Frontend:        http://$(hostname -I | awk '{print $1}')"
echo "   Backend API:     http://$(hostname -I | awk '{print $1}'):8080"
echo "   RabbitMQ UI:     http://$(hostname -I | awk '{print $1}'):15672"
echo "   Grafana:         http://$(hostname -I | awk '{print $1}'):3000"
echo "   Prometheus:      http://$(hostname -I | awk '{print $1}'):9090"
echo ""
echo "🔐 Default Credentials:"
echo "   RabbitMQ:        amarvote_user / amarvote_password"
echo "   Grafana:         admin / (check .env for GF_SECURITY_ADMIN_PASSWORD)"
echo ""
echo "📊 Monitoring Commands:"
echo "   View logs:       docker compose -f docker-compose.prod.yml logs -f"
echo "   Check status:    docker compose -f docker-compose.prod.yml ps"
echo "   Stop services:   docker compose -f docker-compose.prod.yml down"
echo "   Restart service: docker compose -f docker-compose.prod.yml restart <service>"
echo ""
echo "📚 Documentation:"
echo "   Production Guide: docs/PRODUCTION_DEPLOYMENT_4GB.md"
echo "   RabbitMQ Guide:   docs/RABBITMQ_QUICK_START.md"
echo ""
print_success "Happy Voting! 🗳️"
echo ""
