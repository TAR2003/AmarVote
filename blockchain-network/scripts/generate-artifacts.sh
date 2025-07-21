#!/bin/bash

# Generate genesis block and channel configuration

# Remove existing artifacts
rm -rf artifacts/channel/genesis.block
rm -rf artifacts/channel/*.tx

# Generate genesis block
configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock ./artifacts/channel/genesis.block

if [ $? -ne 0 ]; then
  echo "Failed to generate genesis block..."
  exit 1
fi

# Generate channel configuration transaction
configtxgen -profile Channel -outputCreateChannelTx ./artifacts/channel/amarvote-channel.tx -channelID amarvote-channel

if [ $? -ne 0 ]; then
  echo "Failed to generate channel configuration transaction..."
  exit 1
fi

# Generate anchor peer transaction for Org1
configtxgen -profile Channel -outputAnchorPeersUpdate ./artifacts/channel/Org1MSPanchors.tx -channelID amarvote-channel -asOrg Org1MSP

if [ $? -ne 0 ]; then
  echo "Failed to generate anchor peer update for Org1MSP..."
  exit 1
fi

echo "✅ Genesis block and channel configuration generated successfully"
