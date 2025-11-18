#!/bin/bash

echo "=========================================="
echo "Setting up AmarVote Blockchain Network"
echo "=========================================="

# Change to fabric-network directory
cd "$(dirname "$0")"

# Generate crypto materials
echo "Generating crypto materials..."
if [ ! -d "crypto-config" ]; then
    cryptogen generate --config=./config/crypto-config.yaml --output=crypto-config
    echo "✓ Crypto materials generated"
else
    echo "✓ Crypto materials already exist"
fi

# Create channel-artifacts directory
mkdir -p channel-artifacts

# Generate genesis block
echo "Generating genesis block..."
configtxgen -profile AmarVoteOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block -configPath ./config

if [ $? -eq 0 ]; then
    echo "✓ Genesis block generated"
else
    echo "✗ Failed to generate genesis block"
    exit 1
fi

# Generate channel configuration transaction
echo "Generating channel configuration transaction..."
configtxgen -profile ElectionChannel -outputCreateChannelTx ./channel-artifacts/electionchannel.tx -channelID electionchannel -configPath ./config

if [ $? -eq 0 ]; then
    echo "✓ Channel configuration transaction generated"
else
    echo "✗ Failed to generate channel configuration transaction"
    exit 1
fi

# Generate anchor peer update for AmarVoteOrg
echo "Generating anchor peer update..."
configtxgen -profile ElectionChannel -outputAnchorPeersUpdate ./channel-artifacts/AmarVoteOrgMSPanchors.tx -channelID electionchannel -asOrg AmarVoteOrgMSP -configPath ./config

if [ $? -eq 0 ]; then
    echo "✓ Anchor peer update generated"
else
    echo "✗ Failed to generate anchor peer update"
    exit 1
fi

echo ""
echo "=========================================="
echo "Network artifacts generated successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Start the network: docker-compose -f docker-compose-fabric.yaml up -d"
echo "2. Run the network setup script: ./scripts/setup-network.sh"
echo ""
