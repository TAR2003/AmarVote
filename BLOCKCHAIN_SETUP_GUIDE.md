# AmarVote Blockchain Integration Guide

This guide explains the Hyperledger Fabric blockchain integration in the AmarVote election system.

## 🏗️ Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Frontend   │────▶│   Backend    │────▶│  Blockchain API │────▶│  Fabric Network  │
│  (React)    │     │  (Spring)    │     │   (Node.js)     │     │  (Hyperledger)   │
└─────────────┘     └──────────────┘     └─────────────────┘     └──────────────────┘
```

### Components

1. **Frontend (React)**: `BlockchainLogs.jsx` component displays blockchain audit trail
2. **Backend (Spring Boot)**: `BlockchainController` and `BlockchainService` handle blockchain operations
3. **Blockchain API (Node.js)**: Express API that communicates with Hyperledger Fabric
4. **Fabric Network**: Consists of Orderer, Peer, CouchDB, and CLI containers

## 📋 Prerequisites

### Required Tools

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.0+
- Node.js 16+ (for local development)
- Git Bash or WSL (for Windows users)

### Hyperledger Fabric Binaries

Download Fabric binaries (cryptogen, configtxgen):

**On Windows (PowerShell):**
```powershell
cd fabric-network
mkdir bin
cd bin

# Download cryptogen
Invoke-WebRequest -Uri "https://github.com/hyperledger/fabric/releases/download/v2.5.0/hyperledger-fabric-windows-amd64-2.5.0.tar.gz" -OutFile "fabric-binaries.tar.gz"

# Extract
tar -xzf fabric-binaries.tar.gz

# Add to PATH for current session
$env:PATH += ";$PWD\bin"
```

**On Linux/Mac:**
```bash
cd fabric-network
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.5
export PATH=$PWD/bin:$PATH
```

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

**On Windows (PowerShell):**
```powershell
# Navigate to project root
cd C:\Users\TAWKIR\Documents\GitHub\AmarVote

# Generate blockchain artifacts
cd fabric-network
.\scripts\generate-artifacts.sh  # Use Git Bash or WSL

# Start entire application including blockchain
cd ..
docker-compose up --build
```

**On Linux/Mac:**
```bash
# Navigate to project root
cd /path/to/AmarVote

# Generate blockchain artifacts
cd fabric-network
chmod +x scripts/*.sh
./scripts/generate-artifacts.sh

# Start entire application including blockchain
cd ..
docker-compose up --build
```

### Option 2: Step-by-Step Setup

#### Step 1: Generate Network Artifacts

```bash
cd fabric-network

# Generate cryptographic materials
cryptogen generate --config=./config/crypto-config.yaml --output=crypto-config

# Create channel artifacts directory
mkdir -p channel-artifacts

# Generate genesis block
configtxgen -profile AmarVoteOrdererGenesis \
  -channelID system-channel \
  -outputBlock ./channel-artifacts/genesis.block \
  -configPath ./config

# Generate channel transaction
configtxgen -profile ElectionChannel \
  -outputCreateChannelTx ./channel-artifacts/electionchannel.tx \
  -channelID electionchannel \
  -configPath ./config

# Generate anchor peer update
configtxgen -profile ElectionChannel \
  -outputAnchorPeersUpdate ./channel-artifacts/AmarVoteOrgMSPanchors.tx \
  -channelID electionchannel \
  -asOrg AmarVoteOrgMSP \
  -configPath ./config
```

#### Step 2: Start All Services

```bash
cd ..
docker-compose up --build
```

This starts:
- Frontend (port 5173)
- Backend (port 8080)
- ElectionGuard Microservice (port 5000)
- Blockchain API (port 3000)
- Fabric Orderer (port 7050)
- Fabric Peer (port 7051)
- CouchDB (port 5984)

#### Step 3: Setup Blockchain Network

After all containers are running:

```bash
# Execute setup inside CLI container
docker exec -it cli bash

# Inside the container:
cd scripts
./setup-network.sh
```

This will:
- Create the channel
- Join peer to channel
- Install and deploy chaincode
- Initialize the ledger

#### Step 4: Enroll Admin Identity (Blockchain API)

```bash
# In blockchain-api container
docker exec -it blockchain_api npm run enroll-admin
```

## 🔧 Configuration

### Environment Variables

Add to your `.env` file:

```env
# Blockchain Configuration
BLOCKCHAIN_API_URL=http://blockchain-api:3000
BLOCKCHAIN_ENABLED=true
```

### Backend Configuration

Update `application.properties`:

```properties
# Blockchain API
blockchain.api.url=http://blockchain-api:3000
```

## 📝 Usage

### Logging Events from Backend

```java
@Autowired
private BlockchainService blockchainService;

// When creating an election
public void createElection(Election election) {
    // ... save to database ...
    
    // Log to blockchain
    blockchainService.logElectionCreated(
        election.getId().toString(),
        election.getName(),
        election.getOrganizerName(),
        election.getStartDate().toString(),
        election.getEndDate().toString()
    );
}

// When receiving a ballot
public void submitBallot(Ballot ballot) {
    // ... process ballot ...
    
    // Log to blockchain
    blockchainService.logBallotReceived(
        ballot.getElectionId().toString(),
        ballot.getTrackingCode(),
        ballot.getBallotHash(),
        ballot.getVoterId()
    );
}

// When ending an election
public void endElection(Long electionId, String endedBy) {
    // ... end election ...
    
    // Log to blockchain
    blockchainService.logElectionEnded(
        electionId.toString(),
        getTotalVotes(electionId),
        endedBy
    );
}
```

### Displaying Logs in Frontend

```jsx
import BlockchainLogs from './components/BlockchainLogs';

function ElectionVerificationTab({ electionId }) {
  return (
    <div>
      <h2>Election Verification</h2>
      <BlockchainLogs electionId={electionId} />
    </div>
  );
}
```

## 🔍 Monitoring

### CouchDB Web Interface

Access at: http://localhost:5984/_utils

- Username: `admin`
- Password: `adminpw`

View the `electionchannel_election-logs` database to see all blockchain records.

### Container Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f blockchain-api
docker-compose logs -f peer0.amarvote.com
docker-compose logs -f orderer.amarvote.com
```

### Blockchain API Health Check

```bash
curl http://localhost:3000/health
```

## 🧪 Testing

### Test Blockchain API Endpoints

```bash
# Log election created
curl -X POST http://localhost:3000/api/blockchain/log/election-created \
  -H "Content-Type: application/json" \
  -d '{
    "electionId": "test-election-1",
    "electionName": "Test Election",
    "organizerName": "Admin",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-01-31T23:59:59Z"
  }'

# Log ballot received
curl -X POST http://localhost:3000/api/blockchain/log/ballot-received \
  -H "Content-Type: application/json" \
  -d '{
    "electionId": "test-election-1",
    "trackingCode": "TRACK123456",
    "ballotHash": "abc123def456",
    "voterId": "voter123"
  }'

# Get election logs
curl http://localhost:3000/api/blockchain/logs/test-election-1
```

## 🛠️ Troubleshooting

### Issue: Containers not starting

**Solution:**
```bash
# Check logs
docker-compose logs

# Ensure artifacts are generated
cd fabric-network
ls -la channel-artifacts/
ls -la crypto-config/

# If missing, regenerate
./scripts/generate-artifacts.sh
```

### Issue: Chaincode not deploying

**Solution:**
```bash
# Check peer logs
docker logs peer0.amarvote.com

# Re-run setup
docker exec -it cli bash
cd scripts
./setup-network.sh
```

### Issue: Blockchain API cannot connect to Fabric

**Solution:**
```bash
# Check network connectivity
docker exec -it blockchain_api ping peer0.amarvote.com

# Verify crypto materials are mounted
docker exec -it blockchain_api ls -la /app/crypto-config

# Check connection profile
docker exec -it blockchain_api cat /app/connection-profile.json
```

### Issue: Frontend not showing logs

**Solution:**
1. Check browser console for errors
2. Verify backend is proxying requests correctly
3. Test backend endpoint: `http://localhost:8080/api/blockchain/logs/{electionId}`
4. Ensure CORS is configured properly

### Issue: "Admin identity not found" error

**Solution:**
```bash
# Enroll admin in blockchain-api
docker exec -it blockchain_api node enrollAdmin.js

# Verify wallet was created
docker exec -it blockchain_api ls -la wallet/
```

## 🔄 Reset Blockchain Network

To completely reset the blockchain:

```bash
# Stop all containers
docker-compose down

# Remove volumes (WARNING: Deletes all blockchain data)
docker volume rm amarvote_orderer_data amarvote_peer_data amarvote_couchdb_data

# Remove artifacts
cd fabric-network
rm -rf channel-artifacts crypto-config

# Regenerate and restart
./scripts/generate-artifacts.sh
cd ..
docker-compose up --build
```

## 🔐 Security Considerations

### Development vs Production

The current setup is for **DEVELOPMENT** purposes with:
- TLS disabled for simplicity
- Mock admin certificates
- Single organization network
- No authentication on blockchain API

### Production Recommendations

1. **Enable TLS**: Configure TLS for all Fabric communications
2. **Use Real CA**: Deploy Fabric CA for certificate management
3. **Multi-Organization**: Add multiple organizations for decentralization
4. **API Security**: Add authentication/authorization to blockchain API
5. **Backup Strategy**: Implement regular backup of blockchain data
6. **Monitoring**: Set up comprehensive monitoring and alerting
7. **Access Control**: Implement role-based access control for chaincode functions

## 📚 API Reference

### Blockchain Controller Endpoints (Backend)

```
POST   /api/blockchain/log/election-created
POST   /api/blockchain/log/election-started
POST   /api/blockchain/log/ballot-received
POST   /api/blockchain/log/ballot-audited
POST   /api/blockchain/log/election-ended
GET    /api/blockchain/logs/{electionId}
GET    /api/blockchain/logs/{electionId}/{logType}
GET    /api/blockchain/logs
```

### Blockchain API Endpoints (Direct)

```
GET    /health
POST   /api/blockchain/init
POST   /api/blockchain/log/election-created
POST   /api/blockchain/log/election-started
POST   /api/blockchain/log/ballot-received
POST   /api/blockchain/log/ballot-audited
POST   /api/blockchain/log/election-ended
GET    /api/blockchain/logs/:electionId
GET    /api/blockchain/logs/:electionId/:logType
GET    /api/blockchain/logs
```

## 📖 Additional Resources

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric SDK for Node.js](https://hyperledger.github.io/fabric-sdk-node/)
- [CouchDB Documentation](https://docs.couchdb.org/)

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs -f`
3. Verify all containers are running: `docker ps`
4. Ensure all ports are available and not in use

## 📝 License

This blockchain implementation is part of the AmarVote project and follows the same license terms.
