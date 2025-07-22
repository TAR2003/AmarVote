# Blockchain Voting API

A complete blockchain-based voting system using Ethereum (Ganache), Solidity smart contracts, and Python Flask API.

## Architecture

The system consists of three main components:

1. **Ganache** - Local Ethereum blockchain
2. **Smart Contract** - Solidity contract for storing ballot data
3. **Python API** - Flask microservice for interacting with the blockchain

## Features

- Secure ballot recording on blockchain (backend only)
- Public ballot verification
- Automatic private key management
- Docker containerization
- Complete API endpoints for voting operations

## Quick Start

✅ **TESTED AND WORKING** - Simply run the following command to start the entire system:

```bash
docker-compose up -d
```

The system will:

1. Start Ganache blockchain on port 8545
2. Deploy smart contracts automatically (no manual intervention needed)
3. Start the Flask API service on port 5000
4. Be ready for API calls within 30 seconds

**Test the system:**

```bash
python test_api.py
```

Expected output: ✅ All 5 tests should pass

## API Endpoints

### 1. Health Check

```
GET /health
```

Returns the system status and blockchain connection information.

### 2. Record Ballot (Backend Only)

```
POST /record-ballot
Content-Type: application/json

{
  "election_id": "election-2024-001",
  "tracking_code": "TRK123456789",
  "ballot_hash": "a1b2c3d4e5f6..."
}
```

Records a ballot on the blockchain. Only callable by the backend system.

### 3. Verify Ballot (Public)

```
GET /verify-ballot?election_id=election-2024-001&tracking_code=TRK123456789&ballot_hash=a1b2c3d4e5f6...
```

Verifies if a ballot exists on the blockchain and returns timestamp information.

### 4. Get Ballot Info (Public)

```
GET /ballot/TRK123456789
```

Retrieves ballot information by tracking code.

## Example Usage

### Record a Ballot

```bash
curl -X POST http://localhost:5000/record-ballot \
  -H "Content-Type: application/json" \
  -d '{
    "election_id": "election-2024-001",
    "tracking_code": "TRK123456789",
    "ballot_hash": "a1b2c3d4e5f67890abcdef1234567890"
  }'
```

### Verify a Ballot

```bash
curl "http://localhost:5000/verify-ballot?election_id=election-2024-001&tracking_code=TRK123456789&ballot_hash=a1b2c3d4e5f67890abcdef1234567890"
```

### Get Ballot Information

```bash
curl "http://localhost:5000/ballot/TRK123456789"
```

## Security Features

- Private keys are automatically generated and managed by Ganache
- No private keys are exposed in configuration or code
- Smart contract enforces owner-only access for ballot recording
- Public verification ensures transparency
- Docker isolation provides additional security

## System Requirements

- Docker
- Docker Compose

## Ports

- **8545** - Ganache blockchain
- **5000** - Flask API service

## Development

### Project Structure

```
├── docker-compose.yml          # Main orchestration
├── blockchain/                 # Blockchain components
│   ├── contracts/              # Solidity contracts
│   ├── migrations/             # Deployment scripts  
│   ├── scripts/                # Helper scripts
│   └── Dockerfile              # Blockchain container
├── microservice/               # Flask API
│   ├── app/                    # Application code
│   ├── Dockerfile              # API container
│   └── requirements.txt        # Python dependencies
└── README.md                   # This file
```

### Contract Details

The `VotingContract.sol` smart contract provides:

- Secure ballot storage with election ID, tracking code, and ballot hash
- Timestamp recording for all ballots
- Owner-only ballot recording
- Public ballot verification
- Prevention of duplicate ballots

### Environment Variables

All configuration is handled through Docker Compose environment variables:

- `GANACHE_URL` - Blockchain RPC endpoint
- `NETWORK_ID` - Blockchain network ID
- `CONTRACT_ARTIFACTS_PATH` - Contract deployment artifacts path

## Troubleshooting

### Check System Health

```bash
curl http://localhost:5000/health
```

### View Logs

```bash
docker-compose logs ganache
docker-compose logs voting-api
docker-compose logs blockchain-deployer
```

### Restart System

```bash
docker-compose down
docker-compose up
```

## Production Considerations

For production deployment:

1. Use a secure Ethereum network (not Ganache)
2. Implement proper authentication for the record-ballot endpoint
3. Add rate limiting
4. Configure HTTPS
5. Set up monitoring and logging
6. Use environment-specific configuration
