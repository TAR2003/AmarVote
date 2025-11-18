# AmarVote Hyperledger Fabric Blockchain Network

This directory contains the Hyperledger Fabric blockchain network configuration for AmarVote election logging system.

## Directory Structure

```
fabric-network/
├── chaincode/
│   └── election-logs/          # Smart contract for election logging
│       ├── index.js
│       ├── package.json
│       └── lib/
│           └── electionLogContract.js
├── config/
│   ├── configtx.yaml           # Channel and network configuration
│   └── crypto-config.yaml      # Cryptographic material configuration
├── scripts/
│   ├── generate-artifacts.sh   # Generate crypto materials and channel artifacts
│   ├── setup-network.sh        # Setup channel and deploy chaincode
│   ├── start-network.sh        # Start the entire network
│   └── stop-network.sh         # Stop the network
├── docker-compose-fabric.yaml  # Docker compose for Fabric components
└── channel-artifacts/          # Generated channel configuration (auto-created)
```

## Components

### Blockchain Network Components

1. **Orderer** (`orderer.amarvote.com`)
   - Handles transaction ordering
   - Creates blocks
   - Port: 7050

2. **Peer** (`peer0.amarvote.com`)
   - Maintains ledger copy
   - Executes chaincode
   - Port: 7051

3. **CouchDB**
   - State database for the peer
   - Web UI: http://localhost:5984/_utils
   - Username: `admin`, Password: `adminpw`

4. **CLI**
   - Command-line interface for network operations
   - Used for setup and administration

### Chaincode Functions

The `election-logs` chaincode provides the following functions:

- `initLedger()` - Initialize the ledger
- `logElectionCreated(electionId, electionName, organizerName, startDate, endDate)` - Log election creation
- `logBallotReceived(electionId, trackingCode, ballotHash, voterId)` - Log ballot submission
- `logElectionEnded(electionId, totalVotes, endedBy)` - Log election closure
- `logElectionStarted(electionId, startedBy)` - Log election start
- `logBallotAudited(electionId, trackingCode, ballotHash)` - Log ballot audit (Benaloh challenge)
- `getElectionLogs(electionId)` - Retrieve all logs for an election
- `queryLogsByType(electionId, logType)` - Query logs by type
- `getAllLogs()` - Get all logs (admin function)

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Hyperledger Fabric binaries (cryptogen, configtxgen)
- Node.js 16+ (for chaincode)

### Quick Start

1. **Generate network artifacts:**
   ```bash
   cd fabric-network
   chmod +x scripts/*.sh
   ./scripts/generate-artifacts.sh
   ```

2. **Start the network:**
   ```bash
   ./scripts/start-network.sh
   ```

3. **Verify the network:**
   ```bash
   docker ps
   ```

   You should see containers for: orderer, peer, couchdb, and cli

### Manual Setup

If the automated script fails, you can set up manually:

1. **Generate crypto materials:**
   ```bash
   cryptogen generate --config=./config/crypto-config.yaml --output=crypto-config
   ```

2. **Generate genesis block:**
   ```bash
   configtxgen -profile AmarVoteOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block -configPath ./config
   ```

3. **Generate channel transaction:**
   ```bash
   configtxgen -profile ElectionChannel -outputCreateChannelTx ./channel-artifacts/electionchannel.tx -channelID electionchannel -configPath ./config
   ```

4. **Start containers:**
   ```bash
   docker-compose -f docker-compose-fabric.yaml up -d
   ```

5. **Setup network (inside CLI container):**
   ```bash
   docker exec -it cli bash
   cd scripts
   ./setup-network.sh
   ```

## Stopping the Network

```bash
./scripts/stop-network.sh
```

## Integration with AmarVote

The blockchain network is integrated with AmarVote through the `blockchain-api` service, which:

1. Provides REST API endpoints for logging election events
2. Manages connections to the Fabric network
3. Handles transaction submission and queries

The backend service communicates with the blockchain-api to log important election events, creating an immutable audit trail.

## Troubleshooting

### Containers not starting
```bash
docker-compose -f docker-compose-fabric.yaml logs
```

### Chaincode deployment issues
```bash
docker logs cli
```

### Reset the network
```bash
./scripts/stop-network.sh
docker volume prune -f
rm -rf channel-artifacts crypto-config
./scripts/generate-artifacts.sh
./scripts/start-network.sh
```

## Security Notes

- This is a development configuration with TLS disabled for simplicity
- For production, enable TLS and use proper certificate management
- Implement access control for sensitive chaincode functions
- Use proper identity management instead of mock certificates

## Logging Events

The blockchain automatically logs:
- Election creation
- Election start
- Ballot submissions (with tracking codes and hashes)
- Ballot audits (Benaloh challenges)
- Election closure

All logs are immutable and timestamped, providing a transparent audit trail.
