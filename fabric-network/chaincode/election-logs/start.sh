#!/bin/sh
set -e

echo "Starting chaincode service..."

# Set default values if not provided
: ${CHAINCODE_SERVER_ADDRESS:=0.0.0.0:9999}
: ${CHAINCODE_ID_NAME:=election-logs_1:placeholder}

export CHAINCODE_SERVER_ADDRESS
export CHAINCODE_ID_NAME

echo "CHAINCODE_SERVER_ADDRESS: $CHAINCODE_SERVER_ADDRESS"
echo "CHAINCODE_ID_NAME: $CHAINCODE_ID_NAME"

# Start the chaincode in server mode
exec fabric-chaincode-node server --chaincode-address="$CHAINCODE_SERVER_ADDRESS" --chaincode-id="$CHAINCODE_ID_NAME"
