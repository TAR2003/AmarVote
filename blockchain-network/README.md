# Hyperledger Fabric Network for AmarVote

This directory contains the Hyperledger Fabric blockchain network configuration for the AmarVote system.

## Network Components

- **Organization**: AmarVoteOrg
- **Peers**: 2 peers for redundancy
- **Orderer**: Single orderer for simplicity (can be scaled)
- **CA**: Certificate Authority for identity management
- **Chaincode**: Smart contract for ballot verification

## Quick Start

1. Install prerequisites:
```bash
# Install Docker and Docker Compose
# Install Hyperledger Fabric binaries
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.4.7 1.5.2
```

2. Start the network:
```bash
cd blockchain-network
./start-network.sh
```

3. Deploy chaincode:
```bash
./deploy-chaincode.sh
```

## Network Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   AmarVote      │    │   Hyperledger   │
│   Backend       │────│   Fabric        │
│                 │    │   Network       │
└─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         │              │   Ballot        │
         └──────────────│   Chaincode     │
                        │                 │
                        └─────────────────┘
```

## Ballot Data Structure

The blockchain stores the following ballot verification data:
- `election_id`: Election identifier
- `tracking_code`: Unique ballot tracking code
- `ballot_hash`: Cryptographic hash of the ballot
- `timestamp`: When the ballot was cast
- `verified`: Blockchain verification status
