#!/bin/bash

echo "=========================================="
echo "Starting AmarVote Blockchain Network"
echo "=========================================="

# Navigate to fabric-network directory
cd "$(dirname "$0")/.."

# Check if artifacts exist
if [ ! -d "crypto-config" ] || [ ! -d "channel-artifacts" ]; then
    echo "Network artifacts not found. Running generate-artifacts.sh..."
    ./scripts/generate-artifacts.sh
fi

# Start the network
echo ""
echo "Starting Fabric network containers..."
docker-compose -f docker-compose-fabric.yaml up -d

if [ $? -eq 0 ]; then
    echo "✓ Fabric network started successfully"
else
    echo "✗ Failed to start Fabric network"
    exit 1
fi

# Wait for containers to be ready
echo ""
echo "Waiting for containers to be ready..."
sleep 10

# Check if containers are running
echo ""
echo "Checking container status..."
docker ps --filter "name=orderer.amarvote.com" --filter "name=peer0.amarvote.com" --filter "name=couchdb"

# Setup the network (create channel, deploy chaincode)
echo ""
echo "Setting up channel and deploying chaincode..."
echo "This will be executed inside the CLI container..."
docker exec cli bash -c "cd /opt/gopath/src/github.com/hyperledger/fabric/peer/scripts && ./setup-network.sh"

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "Blockchain network is ready!"
    echo "=========================================="
    echo ""
    echo "Access CouchDB at: http://localhost:5984/_utils"
    echo "Username: admin"
    echo "Password: adminpw"
    echo ""
else
    echo "✗ Failed to setup network"
    exit 1
fi
