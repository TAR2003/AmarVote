# 🗳️ Blockchain-Backed Ballot System

A secure, timestamp-enabled blockchain voting system with privacy-preserving ballot commitments and comprehensive audit trails.

## 🏗️ Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│                     │    │                     │    │                     │
│   Frontend App      │◄──►│  Blockchain API     │◄──►│   Hardhat Node      │
│  (React/Vue/etc)    │    │   (FastAPI)         │    │  (Ethereum Local)   │
│                     │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                     │
                                     ▼
                           ┌─────────────────────┐
                           │                     │
                           │  Smart Contract     │
                           │ (BallotContract.sol)│
                           │                     │
                           └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- No other setup required!

### Launch the System

```bash
# Clone the repository
git clone <repository-url>
cd AmarVote

# Start all services
docker-compose up -d

# Wait for services to be ready (about 60 seconds)
# Check health status
curl http://localhost:5002/health

# Run comprehensive tests
python test_blockchain_api.py
```

That's it! The entire blockchain-backed ballot system is now running.

## 📋 API Endpoints

### Health & Status
- `GET /health` - Service health check
- `GET /election/{election_id}` - Get election details

### Admin Operations
- `POST /admin/create-election` - Create new election
- `POST /admin/register-voter` - Register voter for election

### Voting Operations
- `POST /record-ballot` - Record a ballot on blockchain
- `POST /verify-ballot` - Verify ballot existence and integrity

## 🔐 Security Features

### Privacy Protection
- **Ballot Commitments**: Uses cryptographic commitments instead of plain ballot data
- **Zero-Knowledge Proofs**: Voters can prove ballot existence without revealing content
- **Address Privacy**: Voter addresses are protected through signature verification

### Authentication & Authorization
- **Voter Registration**: Only registered voters can participate
- **Digital Signatures**: All ballot submissions require valid signatures
- **Time-Bounded Elections**: Elections have defined start/end times
- **Duplicate Prevention**: Tracking codes ensure one vote per voter

### Audit & Transparency
- **Immutable Records**: All ballots stored permanently on blockchain
- **Timestamp Verification**: Block timestamps provide audit trail
- **Event Logging**: Comprehensive logging for all operations
- **Smart Contract Events**: On-chain events for transparency

## 📊 Example Usage

### 1. Record a Ballot

```bash
curl -X POST "http://localhost:5002/record-ballot" \
     -H "Content-Type: application/json" \
     -d '{
       "election_id": "test_election_2024",
       "tracking_code": "VOTE_001",
       "ballot_data": "Candidate A: YES, Candidate B: NO",
       "voter_signature": "demo_signature"
     }'
```

**Response:**
```json
{
  "success": true,
  "transaction_hash": "0x1234...",
  "timestamp": 1642678800,
  "ballot_commitment": "0xabcd...",
  "message": "Ballot recorded successfully"
}
```

### 2. Verify a Ballot

```bash
curl -X POST "http://localhost:5002/verify-ballot" \
     -H "Content-Type: application/json" \
     -d '{
       "election_id": "test_election_2024",
       "tracking_code": "VOTE_001",
       "ballot_data": "Candidate A: YES, Candidate B: NO"
     }'
```

**Response:**
```json
{
  "exists": true,
  "timestamp": 1642678800,
  "voter_address": "0x1234...",
  "message": "Ballot verification successful"
}
```

## 🏛️ Smart Contract Features

### BallotContract.sol
- **Ballot Storage**: Secure mapping of tracking codes to ballot commitments
- **Election Management**: Time-bounded elections with voter registration
- **Access Control**: Owner-only administrative functions
- **Event Emission**: Transparent audit trail through events
- **Gas Optimization**: Efficient storage and retrieval patterns

### Key Functions
- `createElection(id, startTime, endTime)` - Admin creates election
- `registerVoter(electionId, voterAddress)` - Admin registers voters
- `recordBallot(id, code, commitment, signature)` - Voter records ballot
- `verifyBallot(id, code, commitment)` - Anyone verifies ballot

## 🐳 Docker Configuration

### Services

#### Hardhat Node (`hardhat`)
- **Port**: 8545
- **Chain ID**: 1337
- **Persistence**: Volume-backed chain data
- **Accounts**: Pre-funded test accounts
- **Auto-deployment**: Contracts deployed on startup

#### Blockchain API (`blockchain-microservice`)
- **Port**: 5002
- **Framework**: FastAPI
- **Features**: Enhanced validation, logging, error handling
- **Dependencies**: Waits for Hardhat to be healthy

### Volumes
- `hardhat_chaindata`: Persistent blockchain data

### Networks
- `election_net`: Private network for service communication

## 🧪 Testing

### Automated Test Suite

```bash
# Run comprehensive tests
python test_blockchain_api.py
```

**Test Coverage:**
- ✅ Health check verification
- ✅ Election details retrieval
- ✅ Ballot recording functionality
- ✅ Ballot verification accuracy
- ✅ Non-existent ballot handling
- ✅ Error condition testing

### Manual Testing

```bash
# Check service health
curl http://localhost:5002/health

# View election details
curl http://localhost:5002/election/test_election_2024

# Test ballot recording and verification
# (See Example Usage section above)
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HARDHAT_URL` | Blockchain node URL | `http://hardhat:8545` |
| `DEPLOYER_PRIVATE_KEY` | Contract deployer key | Pre-configured |
| `VOTER1_PRIVATE_KEY` | Test voter 1 key | Pre-configured |
| `VOTER2_PRIVATE_KEY` | Test voter 2 key | Pre-configured |
| `TEST_ELECTION_ID` | Default election ID | `test_election_2024` |

### Smart Contract Configuration
- **Solidity Version**: 0.8.19
- **OpenZeppelin**: Security and access control
- **Gas Optimization**: Enabled with 200 runs

## 📈 Production Considerations

### Security Enhancements
- [ ] Multi-signature wallet for admin operations
- [ ] Hardware security module (HSM) integration
- [ ] Zero-knowledge proof implementation
- [ ] Formal verification of smart contracts

### Scalability Improvements
- [ ] Layer 2 scaling solution integration
- [ ] IPFS for large ballot data storage
- [ ] Database indexing for fast queries
- [ ] Load balancing for API endpoints

### Monitoring & Observability
- [ ] Prometheus metrics collection
- [ ] Grafana dashboards
- [ ] ELK stack for log aggregation
- [ ] Smart contract event monitoring

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues

**Service not starting?**
- Check Docker daemon is running
- Verify port 5002 and 8545 are available
- Check container logs: `docker-compose logs`

**Blockchain connection issues?**
- Wait 60 seconds for full startup
- Check Hardhat health: `curl http://localhost:8545`
- Restart services: `docker-compose restart`

**API errors?**
- Verify request format matches examples
- Check election exists and is active
- Ensure voter is registered for election

### Getting Help
- 📧 Email: support@amarvote.com
- 💬 Discord: [Join our community]
- 📖 Docs: [Full documentation]
- 🐛 Issues: [GitHub Issues]

---

**Built with ❤️ for transparent, secure, and verifiable elections**
