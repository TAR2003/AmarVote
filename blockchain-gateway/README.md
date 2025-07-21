# AmarVote Blockchain Gateway

This service provides a REST API gateway for interacting with the Hyperledger Fabric blockchain network for ballot verification in the AmarVote system.

## Overview

The Blockchain Gateway acts as a bridge between the AmarVote backend (Java Spring Boot) and the Hyperledger Fabric network. It provides RESTful endpoints for:

- Recording ballots on the blockchain
- Verifying ballot authenticity 
- Retrieving ballot records by election
- Health monitoring of the blockchain network

## Architecture

```
AmarVote Backend (Java) → Blockchain Gateway (Node.js) → Hyperledger Fabric Network
```

## Features

- **Ballot Recording**: Secure recording of ballot data to blockchain
- **Ballot Verification**: Cryptographic verification of ballot authenticity
- **Election Queries**: Retrieve all ballots for specific elections
- **Health Monitoring**: Network connectivity and service health checks
- **Error Handling**: Comprehensive error handling and logging
- **CORS Support**: Cross-origin resource sharing for web integration

## API Endpoints

### Health Check
```
GET /health
```
Returns the health status of the blockchain network.

### Record Ballot
```
POST /record-ballot
Content-Type: application/json

{
  "electionId": "123",
  "trackingCode": "TRACK-ABC-123",
  "ballotHash": "sha256-hash-of-ballot",
  "timestamp": "2025-01-20T10:30:00Z"
}
```

### Verify Ballot
```
POST /verify-ballot
Content-Type: application/json

{
  "trackingCode": "TRACK-ABC-123",
  "ballotHash": "sha256-hash-of-ballot"
}
```

### Get Election Ballots
```
GET /election/{electionId}/ballots
```

### Get All Ballots
```
GET /ballots
```

## Installation

1. **Prerequisites**
   - Node.js >= 14.0.0
   - npm >= 6.0.0
   - Running Hyperledger Fabric network
   - Properly configured wallet and connection profile

2. **Install Dependencies**
   ```bash
   cd blockchain-gateway
   npm install
   ```

3. **Configuration**
   - Ensure the Hyperledger Fabric network is running
   - Verify wallet contains Admin identity
   - Check connection profile path

4. **Start Service**
   ```bash
   # Production
   npm start

   # Development with auto-reload
   npm run dev
   ```

## Configuration

The service uses the following default configuration:

- **Port**: 3001
- **Channel**: amarvotechannel
- **Chaincode**: ballot-verification
- **Wallet Path**: ../blockchain-network/wallet
- **Connection Profile**: ../blockchain-network/artifacts/channel/connection-profile.json

## Prerequisites

### Hyperledger Fabric Network
The blockchain network must be running with:
- Orderer service
- Peer nodes
- Channel created and joined
- Ballot verification chaincode deployed

### Wallet Setup
An Admin identity must exist in the wallet directory:
```
blockchain-network/wallet/
├── Admin.id
```

### Connection Profile
A valid connection profile must exist:
```
blockchain-network/artifacts/channel/connection-profile.json
```

## Integration with AmarVote Backend

The AmarVote backend service communicates with this gateway through the `BlockchainService` class:

1. **Ballot Recording**: After successful ballot casting, data is sent to `/record-ballot`
2. **Verification**: Users can verify their ballots through `/verify-ballot`
3. **Election Results**: Ballot lists are retrieved via `/election/{id}/ballots`

## Error Handling

The service provides comprehensive error handling:

- **Network Errors**: Fabric network connectivity issues
- **Chaincode Errors**: Smart contract execution errors
- **Validation Errors**: Invalid request parameters
- **Authentication Errors**: Wallet/identity issues

## Logging

All operations are logged with timestamps and severity levels:
- **INFO**: Normal operations
- **WARN**: Non-critical issues
- **ERROR**: Critical errors requiring attention

## Security Considerations

- **Identity Management**: Uses Fabric wallet for secure identity management
- **TLS**: Secure communication with Fabric network
- **Input Validation**: Request parameter validation
- **CORS**: Configurable cross-origin access

## Monitoring

Health check endpoint provides:
- Network connectivity status
- Chaincode availability
- Service uptime
- Error rates

## Development

### Local Development
```bash
# Install dependencies
npm install

# Start with auto-reload
npm run dev
```

### Testing
```bash
# Health check
curl http://localhost:3001/health

# Record test ballot
curl -X POST http://localhost:3001/record-ballot \
  -H "Content-Type: application/json" \
  -d '{"electionId":"1","trackingCode":"TEST-123","ballotHash":"test-hash"}'
```

## Troubleshooting

### Common Issues

1. **Gateway connection failed**
   - Check if Fabric network is running
   - Verify connection profile path
   - Ensure wallet contains Admin identity

2. **Chaincode not found**
   - Verify chaincode is deployed
   - Check chaincode name configuration
   - Ensure channel is properly configured

3. **Permission denied**
   - Check wallet permissions
   - Verify Admin identity is valid
   - Ensure proper MSP configuration

### Logs
Check console output for detailed error messages and debugging information.

## License

MIT License - See LICENSE file for details.
