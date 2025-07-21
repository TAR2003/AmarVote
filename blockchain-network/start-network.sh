#!/bin/bash

# Start the Hyperledger Fabric network for AmarVote
echo "Starting AmarVote Hyperledger Fabric Network..."

# Generate crypto material
echo "Generating crypto material..."
./scripts/generate-crypto.sh

# Generate genesis block and channel configuration
echo "Generating genesis block and channel configuration..."
./scripts/generate-artifacts.sh

# Start the network
echo "Starting Docker containers..."
docker-compose up -d

# Wait for network to be ready
echo "Waiting for network to be ready..."
sleep 30

# Create channel
echo "Creating channel..."
./scripts/create-channel.sh

# Join peers to channel
echo "Joining peers to channel..."
./scripts/join-channel.sh

# Deploy chaincode
echo "Deploying ballot verification chaincode..."
./scripts/deploy-chaincode.sh

echo "✅ AmarVote Hyperledger Fabric Network started successfully!"
echo "Network endpoints:"
echo "  - Orderer: localhost:7050"
echo "  - Peer0: localhost:7051"
echo "  - Peer1: localhost:8051"
echo ""
echo "To interact with the network, use:"
echo "  docker exec -it cli bash"
