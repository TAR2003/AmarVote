#!/bin/bash
# AmarVote Deployment Script for Debian Server
# Run with: sudo bash deploy-debian.sh

set -e

echo "=========================================="
echo "  AmarVote Production Deployment"
echo "  Platform: Debian Linux"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: Please run with sudo"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found"
    echo "Please create .env file with required environment variables"
    exit 1
fi

echo ""
echo "Step 1: Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed"
    exit 1
fi

echo "✓ Docker and Docker Compose are installed"

echo ""
echo "Step 2: Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down || true

echo ""
echo "Step 3: Cleaning up old volumes (optional)..."
read -p "Do you want to clean all volumes (this will reset blockchain)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose -f docker-compose.prod.yml down -v
    echo "✓ Volumes cleaned"
else
    echo "✓ Keeping existing volumes"
fi

echo ""
echo "Step 4: Building images..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "Step 5: Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 6: Waiting for services to start..."
sleep 10

echo ""
echo "Step 7: Checking service status..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Services running:"
echo "  - Frontend:         http://YOUR_SERVER_IP:80"
echo "  - Backend API:      http://YOUR_SERVER_IP:8080"
echo "  - ElectionGuard:    http://YOUR_SERVER_IP:5000"
echo "  - RAG Service:      http://YOUR_SERVER_IP:5001"
echo "  - Blockchain API:   http://YOUR_SERVER_IP:3000"
echo "  - CouchDB:          http://YOUR_SERVER_IP:5984"
echo ""
echo "To view logs:"
echo "  sudo docker-compose -f docker-compose.prod.yml logs -f [service_name]"
echo ""
echo "To check blockchain setup:"
echo "  sudo docker-compose -f docker-compose.prod.yml logs cli"
echo ""
echo "To restart a service:"
echo "  sudo docker-compose -f docker-compose.prod.yml restart [service_name]"
echo ""
