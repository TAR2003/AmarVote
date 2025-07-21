#!/bin/bash

# Join peers to the channel

# Join peer0 to the channel
docker exec cli peer channel join -b amarvote-channel.block --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/amarvote.com/orderers/orderer.amarvote.com/msp/tlscacerts/tlsca.amarvote.com-cert.pem

if [ $? -ne 0 ]; then
  echo "Failed to join peer0 to channel..."
  exit 1
fi

# Join peer1 to the channel
CORE_PEER_ADDRESS=peer1.org1.amarvote.com:8051 docker exec cli peer channel join -b amarvote-channel.block --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/amarvote.com/orderers/orderer.amarvote.com/msp/tlscacerts/tlsca.amarvote.com-cert.pem

if [ $? -ne 0 ]; then
  echo "Failed to join peer1 to channel..."
  exit 1
fi

echo "✅ All peers joined the channel successfully"
