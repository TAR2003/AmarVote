#!/bin/bash

echo "=========================================="
echo "Setting up Fabric Network and Chaincode"
echo "=========================================="

# Set environment variables
export CORE_PEER_TLS_ENABLED=false
export CORE_PEER_LOCALMSPID="AmarVoteOrgMSP"
export CORE_PEER_ADDRESS=peer0.amarvote.com:7051
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp
export ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/amarvote.com/orderers/orderer.amarvote.com/msp/tlscacerts/tlsca.amarvote.com-cert.pem
export CHANNEL_NAME=electionchannel

echo "Creating channel..."
peer channel create -o orderer.amarvote.com:7050 -c $CHANNEL_NAME -f ./channel-artifacts/electionchannel.tx --outputBlock ./channel-artifacts/$CHANNEL_NAME.block

if [ $? -eq 0 ]; then
    echo "✓ Channel created successfully"
else
    echo "✗ Failed to create channel"
    exit 1
fi

echo "Joining peer to channel..."
peer channel join -b ./channel-artifacts/$CHANNEL_NAME.block

if [ $? -eq 0 ]; then
    echo "✓ Peer joined channel successfully"
else
    echo "✗ Failed to join peer to channel"
    exit 1
fi

echo "Updating anchor peers..."
peer channel update -o orderer.amarvote.com:7050 -c $CHANNEL_NAME -f ./channel-artifacts/AmarVoteOrgMSPanchors.tx

if [ $? -eq 0 ]; then
    echo "✓ Anchor peers updated successfully"
else
    echo "✗ Failed to update anchor peers"
    exit 1
fi

echo ""
echo "Installing chaincode..."
peer lifecycle chaincode package election-logs.tar.gz --path /opt/gopath/src/github.com/chaincode/election-logs --lang node --label election-logs_1

if [ $? -eq 0 ]; then
    echo "✓ Chaincode packaged successfully"
else
    echo "✗ Failed to package chaincode"
    exit 1
fi

peer lifecycle chaincode install election-logs.tar.gz

if [ $? -eq 0 ]; then
    echo "✓ Chaincode installed successfully"
else
    echo "✗ Failed to install chaincode"
    exit 1
fi

echo ""
echo "Getting installed chaincode package ID..."
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep election-logs_1 | awk '{print $3}' | sed 's/,$//')

if [ -z "$PACKAGE_ID" ]; then
    echo "✗ Failed to get package ID"
    exit 1
fi

echo "✓ Package ID: $PACKAGE_ID"

echo ""
echo "Approving chaincode for organization..."
peer lifecycle chaincode approveformyorg -o orderer.amarvote.com:7050 --channelID $CHANNEL_NAME --name election-logs --version 1.0 --package-id $PACKAGE_ID --sequence 1

if [ $? -eq 0 ]; then
    echo "✓ Chaincode approved successfully"
else
    echo "✗ Failed to approve chaincode"
    exit 1
fi

echo ""
echo "Checking commit readiness..."
peer lifecycle chaincode checkcommitreadiness --channelID $CHANNEL_NAME --name election-logs --version 1.0 --sequence 1

echo ""
echo "Committing chaincode..."
peer lifecycle chaincode commit -o orderer.amarvote.com:7050 --channelID $CHANNEL_NAME --name election-logs --version 1.0 --sequence 1

if [ $? -eq 0 ]; then
    echo "✓ Chaincode committed successfully"
else
    echo "✗ Failed to commit chaincode"
    exit 1
fi

echo ""
echo "Initializing chaincode..."
peer chaincode invoke -o orderer.amarvote.com:7050 -C $CHANNEL_NAME -n election-logs -c '{"function":"initLedger","Args":[]}'

if [ $? -eq 0 ]; then
    echo "✓ Chaincode initialized successfully"
else
    echo "✗ Failed to initialize chaincode"
    exit 1
fi

echo ""
echo "=========================================="
echo "Network setup completed successfully!"
echo "=========================================="
