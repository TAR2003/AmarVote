#!/bin/bash
set -e

echo "Generating Fabric network artifacts..."

# Check if artifacts already generated
if [ -d "/shared/crypto-config" ] && [ -f "/shared/channel-artifacts/genesis.block" ]; then
    echo "Artifacts already exist, skipping generation..."
    exit 0
fi

# Generate crypto materials directly to /shared
echo "Generating cryptographic materials..."
cryptogen generate --config=/config/crypto-config.yaml --output=/shared/crypto-config

if [ $? -ne 0 ]; then
    echo "Failed to generate crypto materials"
    exit 1
fi

# Create channel artifacts directory
mkdir -p /shared/channel-artifacts

# Generate genesis block (set FABRIC_CFG_PATH to use crypto from /shared)
echo "Generating genesis block..."
export FABRIC_CFG_PATH=/shared
configtxgen -profile AmarVoteOrdererGenesis -channelID system-channel -outputBlock /shared/channel-artifacts/genesis.block -configPath /config

if [ $? -ne 0 ]; then
    echo "Failed to generate genesis block"
    exit 1
fi

# Generate channel transaction
echo "Generating channel configuration transaction..."
export FABRIC_CFG_PATH=/shared
configtxgen -profile ElectionChannel -outputCreateChannelTx /shared/channel-artifacts/electionchannel.tx -channelID electionchannel -configPath /config

if [ $? -ne 0 ]; then
    echo "Failed to generate channel transaction"
    exit 1
fi

# Generate anchor peer update
echo "Generating anchor peer update..."
export FABRIC_CFG_PATH=/shared
configtxgen -profile ElectionChannel -outputAnchorPeersUpdate /shared/channel-artifacts/AmarVoteOrgMSPanchors.tx -channelID electionchannel -asOrg AmarVoteOrgMSP -configPath /config

if [ $? -ne 0 ]; then
    echo "Failed to generate anchor peer update"
    exit 1
fi

echo "✓ All artifacts generated successfully!"
echo "✓ Artifacts saved to shared volume"
