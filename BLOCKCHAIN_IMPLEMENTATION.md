# AmarVote Blockchain Integration

This document describes the complete blockchain integration for AmarVote using Hyperledger Fabric.

## 🏗️ Architecture Overview

The blockchain integration provides cryptographic verification for all cast ballots using an industry-standard Hyperledger Fabric network.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Backend        │    │   Blockchain        │
│   (React)       │    │   (Spring Boot)  │    │   (Hyperledger)     │
├─────────────────┤    ├──────────────────┤    ├─────────────────────┤
│ • ElectionPage  │◄──►│ • BallotService  │◄──►│ • Fabric Network    │
│ • Blockchain    │    │ • Blockchain     │    │ • Node.js Gateway   │
│   Verification  │    │   Controller     │    │ • Chaincode         │
│ • UI Components │    │ • DTOs           │    │ • Smart Contracts   │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

## 🔧 Components

### 1. Backend Services (Java Spring Boot)

#### BlockchainService.java
- **Location**: `backend/src/main/java/com/amarvote/amarvote/service/BlockchainService.java`
- **Purpose**: Core service for blockchain operations
- **Key Methods**:
  - `recordBallotToBlockchain()`: Async ballot recording
  - `verifyBallotOnBlockchain()`: Ballot verification
  - `getBallotsByElection()`: Retrieve election ballots

#### BlockchainController.java
- **Location**: `backend/src/main/java/com/amarvote/amarvote/controller/BlockchainController.java`
- **Purpose**: REST API endpoints for blockchain operations
- **Endpoints**:
  - `POST /api/blockchain/verify-ballot`: Verify ballot integrity
  - `GET /api/blockchain/election/{id}/ballots`: Get election ballots
  - `GET /api/blockchain/health`: Health check

#### DTOs
- **BlockchainVerificationRequest.java**: Request structure for verification
- **BlockchainVerificationResponse.java**: Response structure with verification results
- **BlockchainRecordDto.java**: Data transfer object for blockchain records

### 2. Frontend Components (React)

#### BlockchainVerification.jsx
- **Location**: `frontend/src/components/BlockchainVerification.jsx`
- **Purpose**: UI component for ballot verification
- **Features**:
  - Professional verification interface
  - Real-time blockchain verification
  - Detailed verification results
  - Error handling and retry logic

#### ElectionPage Integration
- **Location**: `frontend/src/pages/ElectionPage.jsx`
- **Purpose**: Integrates blockchain verification into ballots-in-tally tab
- **Features**:
  - Verification button for each ballot
  - Modern UI with status indicators
  - Gold/green verification status

### 3. Blockchain Infrastructure

#### Hyperledger Fabric Network
- **Location**: `blockchain-network/`
- **Components**:
  - Orderer: `orderer.amarvote.com:7050`
  - Peer: `peer0.org1.amarvote.com:7051`
  - Certificate Authority: `ca.org1.amarvote.com:7054`

#### Node.js Gateway Service
- **Location**: `blockchain-gateway/`
- **Purpose**: Bridge between backend and Hyperledger Fabric
- **Port**: 3001
- **Features**:
  - Fabric Network SDK integration
  - RESTful API for blockchain operations
  - Connection management and error handling

#### Chaincode (Smart Contract)
- **Location**: `blockchain-network/chaincode/ballot-verification/`
- **Language**: Go
- **Functions**:
  - `RecordBallot`: Store ballot on blockchain
  - `VerifyBallot`: Verify ballot integrity
  - `GetBallotsByElection`: Retrieve election ballots

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 16+ 
- Java 11+
- Git Bash (for Windows)

### 1. Start Blockchain Network

**Linux/macOS:**
```bash
chmod +x start-blockchain.sh
./start-blockchain.sh
```

**Windows:**
```cmd
start-blockchain.bat
```

### 2. Verify Installation

Check if all services are running:
```bash
# Check containers
docker ps

# Check gateway health
curl http://localhost:3001/health

# Check network connectivity
docker exec peer0.org1.amarvote.com peer channel list
```

### 3. Start Application Services

```bash
# Start backend (Spring Boot)
cd backend
./mvnw spring-boot:run

# Start frontend (React)
cd frontend
npm start
```

## 🔄 Workflow

### 1. Ballot Casting
When a user casts a ballot:

1. **Frontend**: User selects candidate and submits vote
2. **Backend**: `BallotService.saveBallot()` saves to database
3. **Blockchain**: `BlockchainService.recordBallotToBlockchain()` records to blockchain
4. **Result**: Ballot is stored both in database and blockchain

```java
// In BallotService.java
Ballot savedBallot = ballotRepository.save(ballot);

// Record to blockchain asynchronously
blockchainService.recordBallotToBlockchain(
    savedBallot.getElection().getElectionId(),
    savedBallot.getTrackingCode(),
    savedBallot.getHashCode(),
    savedBallot.getCreatedAt()
);
```

### 2. Ballot Verification
When viewing ballots in tally:

1. **Frontend**: User clicks "Verify Using Blockchain" button
2. **API Call**: `electionApi.verifyBallotOnBlockchain()`
3. **Backend**: `BlockchainController.verifyBallot()` processes request
4. **Blockchain**: Node.js gateway queries Hyperledger Fabric
5. **Result**: Returns verification status with blockchain proof

```javascript
// In BlockchainVerification.jsx
const result = await electionApi.verifyBallotOnBlockchain(
  electionId,
  ballot.ballot_id,
  ballot.initial_hash || ballot.decrypted_hash
);
```

## 🎨 UI Features

### Ballots in Tally Tab
- **Professional Design**: Modern card-based layout
- **Verification Button**: "Verify Using Blockchain" button for each ballot
- **Status Indicators**: 
  - ✅ **Verified**: Green background, check icon
  - ❌ **Failed**: Red background, X icon  
  - ⏳ **Verifying**: Blue background, loading spinner
  - ⚠️ **Error**: Amber background, alert icon

### Verification Details
- **Blockchain Hash**: Truncated hash display
- **Block Number**: Reference to blockchain block
- **Timestamp**: When verification was performed
- **Error Details**: Comprehensive error information

## 🔒 Security Features

### Authentication & Authorization
- **Managed Identity**: Uses Azure managed identity where applicable
- **Session-based Auth**: Secure session management
- **CORS Protection**: Proper CORS configuration

### Data Protection
- **Encrypted Communications**: All API calls use HTTPS
- **Hash Verification**: Cryptographic hash validation
- **Immutable Records**: Blockchain provides tamper-proof storage

### Error Handling
- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Breakers**: Prevents cascade failures
- **Comprehensive Logging**: Detailed error tracking

## 📊 Monitoring & Health Checks

### Health Endpoints
- **Backend**: `GET /api/blockchain/health`
- **Gateway**: `GET http://localhost:3001/health`
- **Fabric Network**: Container health checks

### Logging
- **Backend**: Spring Boot logging with blockchain operation tracking
- **Gateway**: Express.js logging with Fabric SDK details
- **Frontend**: Console logging for verification operations

## 🛠️ Development

### Adding New Blockchain Operations

1. **Backend**: Add method to `BlockchainService.java`
2. **Controller**: Add endpoint to `BlockchainController.java`
3. **Gateway**: Add route to `blockchain-gateway/server.js`
4. **Frontend**: Add method to `electionApi.js`

### Testing

```bash
# Test blockchain connectivity
curl -X POST http://localhost:3001/record-ballot \
  -H "Content-Type: application/json" \
  -d '{"electionId":"test","trackingCode":"123","ballotHash":"abc","timestamp":"2024-01-01T00:00:00Z"}'

# Test verification
curl -X POST http://localhost:3001/verify-ballot \
  -H "Content-Type: application/json" \
  -d '{"trackingCode":"123","ballotHash":"abc"}'
```

### Debugging

```bash
# View container logs
docker-compose logs -f

# View gateway logs
cd blockchain-gateway && tail -f gateway.log

# View backend logs
cd backend && tail -f logs/application.log
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Containers Won't Start
```bash
# Clean up and restart
docker-compose down -v
docker system prune -f
./start-blockchain.sh
```

#### 2. Gateway Connection Issues
```bash
# Check if gateway is running
curl http://localhost:3001/health

# Restart gateway
cd blockchain-gateway
npm start
```

#### 3. Chaincode Deployment Failed
```bash
# Manually deploy chaincode
cd blockchain-network
docker exec peer0.org1.amarvote.com peer chaincode install -p /opt/gopath/src/ballot-verification -n ballot-verification -v 1.0
```

#### 4. Frontend Verification Errors
- Check browser console for detailed error messages
- Verify backend is running on correct port
- Ensure blockchain network is healthy

### Log Locations
- **Docker Containers**: `docker-compose logs [service-name]`
- **Gateway**: `blockchain-gateway/gateway.log`
- **Backend**: `backend/logs/application.log`
- **Frontend**: Browser developer console

## 📋 Maintenance

### Regular Tasks
1. **Monitor Docker containers**: `docker ps`
2. **Check disk space**: Blockchain data grows over time
3. **Update dependencies**: Keep SDKs and libraries current
4. **Backup wallet materials**: Store certificates securely

### Performance Optimization
- **Connection Pooling**: Gateway maintains persistent connections
- **Async Processing**: Ballot recording doesn't block user operations
- **Caching**: Verification results cached temporarily

## 🔮 Future Enhancements

1. **Multi-Organization Setup**: Add more organizations to network
2. **Advanced Analytics**: Blockchain transaction analysis
3. **Automated Deployment**: CI/CD pipeline integration
4. **Mobile Support**: React Native blockchain verification
5. **Advanced Cryptography**: Zero-knowledge proofs for privacy

## 📞 Support

For technical issues:
1. Check this README
2. Review logs for error details
3. Verify all services are running
4. Check Docker container status
5. Test individual components

---

**🗳️ AmarVote Blockchain Integration** - Providing cryptographic verification for democratic processes with industry-standard Hyperledger Fabric technology.
