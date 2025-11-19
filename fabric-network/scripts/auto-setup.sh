#!/bin/bash
set -e

echo "=========================================="
echo "Initializing Blockchain Network"
echo "=========================================="

# Wait for orderer and peer to be ready
echo "Waiting for Fabric components to start..."
sleep 15

# Set environment variables
export CORE_PEER_TLS_ENABLED=false
export CORE_PEER_LOCALMSPID="AmarVoteOrgMSP"
export CORE_PEER_ADDRESS=peer0.amarvote.com:7051
export CORE_PEER_MSPCONFIGPATH=/shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp
export CHANNEL_NAME=electionchannel

# Check if channel already exists
CHANNEL_EXISTS=false
if peer channel list 2>&1 | grep -q "electionchannel"; then
    CHANNEL_EXISTS=true
    echo "✓ Channel already exists and peer is joined"
fi

# Check if chaincode is already installed
CHAINCODE_INSTALLED=false
if peer lifecycle chaincode queryinstalled 2>&1 | grep -q "election-logs_1"; then
    CHAINCODE_INSTALLED=true
    echo "✓ Chaincode already installed"
fi

# If both channel and chaincode exist, we're done
if [ "$CHANNEL_EXISTS" = true ] && [ "$CHAINCODE_INSTALLED" = true ]; then
    echo "✓ Blockchain network already configured"
    exit 0
fi

# If channel exists but chaincode doesn't, or neither exists, we need to do full setup
echo "Setting up Fabric network..."

# Only create and join channel if it doesn't exist
if [ "$CHANNEL_EXISTS" = false ]; then
    # Create channel
    echo "Creating channel..."
    peer channel create -o orderer.amarvote.com:7050 -c electionchannel -f /shared/channel-artifacts/electionchannel.tx --outputBlock /shared/channel-artifacts/electionchannel.block 2>&1

    if [ $? -eq 0 ]; then
        echo "✓ Channel created"
    else
        echo "✗ Failed to create channel"
        exit 1
    fi

    # Join peer to channel
    echo "Joining peer to channel..."
    peer channel join -b /shared/channel-artifacts/electionchannel.block

    if [ $? -eq 0 ]; then
        echo "✓ Peer joined channel"
    else
        echo "✗ Failed to join peer to channel"
        exit 1
    fi

    # Update anchor peers
    echo "Updating anchor peers..."
    peer channel update -o orderer.amarvote.com:7050 -c $CHANNEL_NAME -f /shared/channel-artifacts/AmarVoteOrgMSPanchors.tx 2>&1
fi
    echo "✓ Peer joined channel"
else
    echo "✗ Failed to join peer to channel"
    exit 1
fi

# Update anchor peers
echo "Updating anchor peers..."
peer channel update -o orderer.amarvote.com:7050 -c $CHANNEL_NAME -f /shared/channel-artifacts/AmarVoteOrgMSPanchors.tx 2>&1

# Package chaincode
echo "Packaging chaincode..."
peer lifecycle chaincode package election-logs.tar.gz --path /opt/gopath/src/github.com/chaincode/election-logs --lang node --label election-logs_1 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Chaincode packaged"
else
    echo "✗ Failed to package chaincode"
    exit 1
fi

# Install chaincode
echo "Installing chaincode..."
peer lifecycle chaincode install election-logs.tar.gz 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Chaincode installed"
else
    echo "✗ Failed to install chaincode"
    exit 1
fi

# Get package ID
echo "Getting chaincode package ID..."
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled 2>&1 | grep election-logs_1 | awk '{print $3}' | sed 's/,$//')

if [ -z "$PACKAGE_ID" ]; then
    echo "✗ Failed to get package ID"
    exit 1
fi

echo "Package ID: $PACKAGE_ID"

# Approve chaincode
echo "Approving chaincode..."
peer lifecycle chaincode approveformyorg -o orderer.amarvote.com:7050 --channelID $CHANNEL_NAME --name election-logs --version 1.0 --package-id $PACKAGE_ID --sequence 1 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Chaincode approved"
else
    echo "✗ Failed to approve chaincode"
    exit 1
fi

# Wait a bit before commit
sleep 5

# Commit chaincode
echo "Committing chaincode..."
peer lifecycle chaincode commit -o orderer.amarvote.com:7050 --channelID $CHANNEL_NAME --name election-logs --version 1.0 --sequence 1 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Chaincode committed"
else
    echo "✗ Failed to commit chaincode"
    exit 1
fi

# Wait for chaincode to be ready
sleep 10

# Initialize chaincode
echo "Initializing chaincode..."
peer chaincode invoke -o orderer.amarvote.com:7050 -C $CHANNEL_NAME -n election-logs -c '{"function":"initLedger","Args":[]}' 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Chaincode initialized"
else
    echo "✗ Failed to initialize chaincode"
fi

echo ""
echo "=========================================="
echo "✓ Blockchain network setup complete!"
echo "=========================================="
