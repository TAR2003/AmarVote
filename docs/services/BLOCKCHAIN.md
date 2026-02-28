# ⛓️ Blockchain Service

**Status:** Infrastructure complete — **commented out by default** in docker-compose files  
**Technology:** Ganache + Solidity 0.8.19 + Web3.py 6.11.1 + Flask  
**Blockchain API Port:** `5002`  
**Ganache (local chain) Port:** `8545`

---

## Overview

AmarVote includes a complete blockchain verification layer for immutable ballot audit trails. The infrastructure is fully implemented and can be enabled by uncommenting the relevant services in `docker-compose.yml`.

**Purpose:** Create an append-only, tamper-proof record of every ballot submission. Voters can independently verify their vote was recorded without trusting the central server.

**Blockchain stack:**
- **Ganache** — Local Ethereum development blockchain (deterministic, no real ETH required)
- **VotingContract.sol** — Solidity smart contract managing election and ballot records
- **Truffle** — Contract compilation and migration framework
- **blockchain-microservice** — Flask API wrapping Web3.py for backend integration

---

## Smart Contract: `VotingContract.sol`

**Location:** `blockchain/contracts/VotingContract.sol`  
**Solidity Version:** `^0.8.19`

### Data Structures

```solidity
struct Ballot {
    string electionId;
    string trackingCode;
    string ballotHash;      // SHA-256 of encrypted ciphertext
    uint256 timestamp;      // Unix timestamp of recording
    bool exists;
}

struct ElectionLog {
    string message;         // Human-readable event description
    uint256 timestamp;
}
```

### State Variables

```solidity
address public owner;       // Contract deployer (owner account from Ganache)

// ballots[electionId][trackingCode] = Ballot
mapping(string => mapping(string => Ballot)) private ballots;

// Unique tracking code enforcement
mapping(string => mapping(string => bool)) private electionTrackingCodeExists;

// Election registration
mapping(string => bool) private electionExists;

// Audit log per election
mapping(string => ElectionLog[]) private electionLogs;
```

### Events

```solidity
event BallotRecorded(string indexed electionId, string trackingCode, string ballotHash, uint256 timestamp);
event ElectionCreated(string indexed electionId, uint256 timestamp);
event LogAdded(string indexed electionId, string message, uint256 timestamp);
```

### Functions

| Function | Modifier | Description |
|---|---|---|
| `createElection(string _electionId)` | `onlyOwner` | Registers a new election. Emits `ElectionCreated`. Appends creation log entry. |
| `recordBallot(string _electionId, string _trackingCode, string _ballotHash)` | `onlyOwner` | Records ballot. Requires: election exists + tracking code unique. Emits `BallotRecorded`. |
| `verifyBallot(string _electionId, string _trackingCode, string _ballotHash)` | `view` | Returns `(bool exists, uint256 timestamp)`. Validates via `keccak256` hash comparison. |
| `getBallotByTrackingCode(string _electionId, string _trackingCode)` | `view` | Returns `(electionId, ballotHash, timestamp, exists)`. |
| `trackingCodeExistsForElection(string _electionId, string _trackingCode)` | `view` | Returns `bool`. |
| `getElectionLogs(string _electionId)` | `view` | Returns `(string[] messages, uint256[] timestamps)`. |
| `getElectionLogCount(string _electionId)` | `view` | Returns `uint256`. |
| `checkElectionExists(string _electionId)` | `view` | Returns `bool`. |

**`onlyOwner` modifier:** Only the deploying account (`accounts[0]` on Ganache) can write to the contract.

---

## Blockchain Microservice API

**Location:** `blockchain-microservice/`  
**Framework:** Flask 2.3.3  
**Port:** `5002`  
**Web3 library:** `web3==6.11.1`

### Startup

```python
init_blockchain():
    # 1. Connect Web3 with PoA middleware (Ganache uses Proof of Authority)
    web3 = Web3(Web3.HTTPProvider(GANACHE_URL))
    web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    
    # 2. Wait up to 60s for Ganache to be ready
    retry_connect(max_wait=60)
    
    # 3. Load VotingContract.json artifact (from Truffle build)
    with open(f"{CONTRACT_ARTIFACTS_PATH}/VotingContract.json") as f:
        artifact = json.load(f)
    
    # 4. Connect to deployed contract
    contract_address = artifact["networks"][NETWORK_ID]["address"]
    contract = web3.eth.contract(address=contract_address, abi=artifact["abi"])
    
    # 5. Use first account as owner (Ganache always has accounts[0] with ETH)
    owner_account = web3.eth.accounts[0]
```

### Configuration

| Variable | Default | Description |
|---|---|---|
| `GANACHE_URL` | `http://ganache:8545` | Ganache RPC endpoint |
| `NETWORK_ID` | `1337` | Ganache network ID |
| `CONTRACT_ARTIFACTS_PATH` | `/app/contracts` | Path to Truffle-compiled contract JSON |

### Endpoints

#### `GET /health`

```json
{
  "status": "healthy",
  "blockchain": true,
  "contract": true,
  "contract_address": "0x..."
}
```

#### `POST /create-election`

Creates an election record on-chain.

**Request:**
```json
{ "election_id": "42" }
```

**Response:**
```json
{
  "status": "success",
  "election_id": "42",
  "transaction_hash": "0xabc...",
  "block_number": 15,
  "timestamp": 1704067200
}
```

#### `POST /record-ballot`

Records a ballot hash on-chain. Called by `BlockchainService.java` after successful ballot casting.

**Request:**
```json
{
  "election_id": "42",
  "tracking_code": "ABC123XYZ",
  "ballot_hash": "sha256_of_ciphertext"
}
```

**Response:**
```json
{
  "status": "success",
  "transaction_hash": "0xdef...",
  "block_number": 28,
  "timestamp": 1704067215
}
```

#### `GET /verify-ballot?election_id=42&tracking_code=ABC123XYZ&ballot_hash=...`

Verifies a ballot's hash on-chain.

**Response:**
```json
{
  "exists": true,
  "timestamp": 1704067215
}
```

#### `GET /ballot/<election_id>/<tracking_code>`

Retrieves full ballot details. Used by frontend's "Blockchain Verification" section.  
**This endpoint is exposed publicly** via `GET /api/blockchain/ballot/{electionId}/{trackingCode}` in the backend (no auth required).

**Response:**
```json
{
  "exists": true,
  "election_id": "42",
  "ballot_hash": "abc123...",
  "timestamp": 1704067215,
  "tracking_code": "ABC123XYZ"
}
```

#### `GET /get-logs/<election_id>`

Returns all blockchain audit log entries for an election.  
Exposed publicly via `GET /api/blockchain/logs/{electionId}`.

**Response:**
```json
{
  "election_id": "42",
  "log_count": 3,
  "logs": [
    { "message": "Election 42 created", "timestamp": 1704067200, "formatted_time": "2024-01-01 ..." },
    { "message": "Ballot ABC123XYZ recorded", "timestamp": 1704067215, "formatted_time": "..." }
  ]
}
```

---

## Blockchain Integration in Backend

`BlockchainService.java` handles communication with the blockchain microservice:

```java
// Called during election creation
blockchainService.createElection(String.valueOf(electionId));

// Called after each successful ballot cast
blockchainService.recordBallot(electionId, trackingCode, sha256Hash(ciphertext));
```

If `BLOCKCHAIN_SERVICE_URL` is not set, `BlockchainService` operates in no-op mode (blockchain calls silently skipped).

---

## Truffle Configuration

**Location:** `blockchain/truffle-config.js`

```js
module.exports = {
  networks: {
    development: {
      host: "ganache",
      port: 8545,
      network_id: "1337"
    }
  },
  compilers: {
    solc: {
      version: "0.8.19"
    }
  }
}
```

**Migration scripts** in `blockchain/migrations/`:
- Deploy `VotingContract.sol` to local Ganache network
- Store deployed address in contract artifact JSON

---

## Enabling Blockchain Services

To enable blockchain in development, uncomment in `docker-compose.yml`:

```yaml
# ganache:
#   image: trufflesuite/ganache:latest
#   command: --networkId 1337 --deterministic --accounts 10
#   ...

# blockchain-deployer:
#   build: ./blockchain
#   # Runs truffle migrate

# voting-api:
#   build: ./blockchain-microservice
#   ports:
#     - "5002:5002"
```

Also uncomment `VOTING_API_URL` in backend environment and set `BLOCKCHAIN_SERVICE_URL`.

---

## Dependencies

```
Flask==2.3.3
web3==6.11.1        ← Ethereum interaction
python-dotenv==1.0.0
gunicorn==21.2.0
requests==2.31.0
```
