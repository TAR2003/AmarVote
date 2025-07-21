#!/bin/bash

# Create the channel

# Use the CLI container to create the channel
docker exec cli peer channel create -o orderer.amarvote.com:7050 -c amarvote-channel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/amarvote-channel.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/amarvote.com/orderers/orderer.amarvote.com/msp/tlscacerts/tlsca.amarvote.com-cert.pem

if [ $? -ne 0 ]; then
  echo "Failed to create channel..."
  exit 1
fi

echo "✅ Channel 'amarvote-channel' created successfully"
