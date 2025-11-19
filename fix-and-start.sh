#!/bin/bash

echo "=========================================="
echo "  AmarVote Cloud Deployment Script"
echo "=========================================="
echo ""

# Fix Docker socket permissions
echo "1. Fixing Docker socket permissions..."
sudo chmod 666 /var/run/docker.sock
sudo chown root:docker /var/run/docker.sock
echo "   ✓ Docker socket permissions fixed"

# Stop existing containers
echo ""
echo "2. Stopping existing containers..."
sudo docker-compose -f docker-compose.prod.yml down
echo "   ✓ Containers stopped"

# Pull latest images
echo ""
echo "3. Pulling latest Hyperledger Fabric images..."
sudo docker pull hyperledger/fabric-peer:2.5
sudo docker pull hyperledger/fabric-orderer:2.5
sudo docker pull hyperledger/fabric-tools:2.5
echo "   ✓ Images pulled"

# Start services
echo ""
echo "4. Starting all services..."
sudo docker-compose -f docker-compose.prod.yml up -d
echo "   ✓ Services started"

echo ""
echo "=========================================="
echo "  Waiting for services to initialize..."
echo "=========================================="
sleep 10

# Check service status
echo ""
echo "Service Status:"
sudo docker-compose -f docker-compose.prod.yml ps

echo ""
echo "=========================================="
echo "  Monitoring CLI logs (Ctrl+C to exit)"
echo "=========================================="
echo ""
sudo docker-compose -f docker-compose.prod.yml logs -f cli
