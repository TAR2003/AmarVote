#!/bin/bash

echo "=========================================="
echo "Stopping AmarVote Blockchain Network"
echo "=========================================="

# Navigate to fabric-network directory
cd "$(dirname "$0")/.."

# Stop and remove containers
echo "Stopping containers..."
docker-compose -f docker-compose-fabric.yaml down

if [ $? -eq 0 ]; then
    echo "✓ Containers stopped successfully"
else
    echo "✗ Failed to stop containers"
    exit 1
fi

# Optional: Remove volumes
read -p "Do you want to remove volumes (this will delete all blockchain data)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    docker-compose -f docker-compose-fabric.yaml down -v
    echo "✓ Volumes removed"
fi

echo ""
echo "=========================================="
echo "Network stopped successfully"
echo "=========================================="
