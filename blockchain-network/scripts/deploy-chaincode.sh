#!/bin/bash

# Deploy the ballot verification chaincode
echo "Deploying ballot verification chaincode..."

# Package the chaincode
echo "Packaging chaincode..."
docker exec cli peer lifecycle chaincode package ballot-verification.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/ballot-verification \
  --lang golang \
  --label ballot-verification_1.0

# Install chaincode on peer0
echo "Installing chaincode on peer0..."
docker exec cli peer lifecycle chaincode install ballot-verification.tar.gz

# Install chaincode on peer1
echo "Installing chaincode on peer1..."
docker exec -e CORE_PEER_ADDRESS=peer1.org1.amarvote.com:8051 \
  -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.amarvote.com/peers/peer1.org1.amarvote.com/tls/server.crt \
  -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.amarvote.com/peers/peer1.org1.amarvote.com/tls/server.key \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.amarvote.com/peers/peer1.org1.amarvote.com/tls/ca.crt \
  cli peer lifecycle chaincode install ballot-verification.tar.gz

# Get package ID
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[0].package_id')
echo "Package ID: $PACKAGE_ID"

# Approve chaincode for Org1
echo "Approving chaincode for Org1..."
docker exec cli peer lifecycle chaincode approveformyorg \
  -o orderer.amarvote.com:7050 \
  --ordererTLSHostnameOverride orderer.amarvote.com \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/amarvote.com/orderers/orderer.amarvote.com/msp/tlscacerts/tlsca.amarvote.com-cert.pem \
  --channelID amarvotechannel \
  --name ballot-verification \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1

# Check commit readiness
echo "Checking commit readiness..."
docker exec cli peer lifecycle chaincode checkcommitreadiness \
  --channelID amarvotechannel \
  --name ballot-verification \
  --version 1.0 \
  --sequence 1 \
  --output json

# Commit chaincode
echo "Committing chaincode..."
docker exec cli peer lifecycle chaincode commit \
  -o orderer.amarvote.com:7050 \
  --ordererTLSHostnameOverride orderer.amarvote.com \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/amarvote.com/orderers/orderer.amarvote.com/msp/tlscacerts/tlsca.amarvote.com-cert.pem \
  --channelID amarvotechannel \
  --name ballot-verification \
  --peerAddresses peer0.org1.amarvote.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.amarvote.com/peers/peer0.org1.amarvote.com/tls/ca.crt \
  --peerAddresses peer1.org1.amarvote.com:8051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.amarvote.com/peers/peer1.org1.amarvote.com/tls/ca.crt \
  --version 1.0 \
  --sequence 1

# Verify chaincode is committed
echo "Verifying chaincode deployment..."
docker exec cli peer lifecycle chaincode querycommitted --channelID amarvotechannel --name ballot-verification

# Initialize the chaincode
echo "Initializing chaincode..."
docker exec cli peer chaincode invoke \
  -o orderer.amarvote.com:7050 \
  --ordererTLSHostnameOverride orderer.amarvote.com \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/amarvote.com/orderers/orderer.amarvote.com/msp/tlscacerts/tlsca.amarvote.com-cert.pem \
  -C amarvotechannel \
  -n ballot-verification \
  --peerAddresses peer0.org1.amarvote.com:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.amarvote.com/peers/peer0.org1.amarvote.com/tls/ca.crt \
  -c '{"function":"InitLedger","Args":[]}'

echo "✅ Ballot verification chaincode deployed successfully!"
