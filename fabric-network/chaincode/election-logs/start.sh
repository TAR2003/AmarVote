#!/bin/sh
set -e

echo "Starting chaincode service..."

# Set default values if not provided
: ${CHAINCODE_SERVER_ADDRESS:=0.0.0.0:9999}

# For external chaincode in server mode, we don't strictly need CHAINCODE_ID_NAME
# The peer will connect to us via the address in connection.json
export CHAINCODE_SERVER_ADDRESS

echo "CHAINCODE_SERVER_ADDRESS: $CHAINCODE_SERVER_ADDRESS"

# Start the chaincode in server mode
exec npm start
