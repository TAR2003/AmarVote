#!/bin/bash

# Generate cryptographic material for the network

# Remove existing crypto material
rm -rf artifacts/channel/crypto-config
mkdir -p artifacts/channel

# Generate crypto material using cryptogen
cryptogen generate --config=./crypto-config.yaml --output="artifacts/channel/crypto-config"

if [ $? -ne 0 ]; then
  echo "Failed to generate crypto material..."
  exit 1
fi

echo "✅ Crypto material generated successfully"
