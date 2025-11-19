#!/bin/bash
set -e

echo "Installing external chaincode..."

# Create package directory
rm -rf /tmp/cc-ext
mkdir -p /tmp/cc-ext

# Create connection.json
cat > /tmp/cc-ext/connection.json << 'CONN'
{
  "address": "election-logs-chaincode:9999",
  "dial_timeout": "10s",
  "tls_required": false
}
CONN

# Package connection.json
cd /tmp/cc-ext
tar czf code.tar.gz connection.json
rm connection.json

# Create metadata.json
cat > /tmp/cc-ext/metadata.json << 'META'
{
  "path": "",
  "type": "ccaas",
  "label": "election-logs_1.3"
}
META

# Create the chaincode package
cd /tmp
tar czf election-logs-1.3.tar.gz -C cc-ext metadata.json code.tar.gz

echo "✓ Package created: /tmp/election-logs-1.3.tar.gz"
echo "Contents:"
tar -tzf election-logs-1.3.tar.gz

# Install the chaincode
echo "Installing chaincode..."
peer lifecycle chaincode install /tmp/election-logs-1.3.tar.gz

# Get the package ID
sleep 2
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep election-logs_1.3 | awk '{print $3}' | sed 's/,//')

if [ -z "$PACKAGE_ID" ]; then
    echo "✗ Failed to get package ID"
    exit 1
fi

echo "✓ Package ID: $PACKAGE_ID"

# Approve the chaincode
echo "Approving chaincode..."
peer lifecycle chaincode approveformyorg \
    -o orderer.amarvote.com:7050 \
    --channelID electionchannel \
    --name election-logs \
    --version 1.3 \
    --package-id $PACKAGE_ID \
    --sequence 4

echo "✓ Chaincode approved"

# Commit the chaincode
echo "Committing chaincode..."
peer lifecycle chaincode commit \
    -o orderer.amarvote.com:7050 \
    --channelID electionchannel \
    --name election-logs \
    --version 1.3 \
    --sequence 4

echo "✓ Chaincode committed"
echo ""
echo "=========================================="
echo "✓ External chaincode installation complete!"
echo "=========================================="
