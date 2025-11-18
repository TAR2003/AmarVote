# Automated AmarVote Setup

## Single Command Deployment 🚀

Everything is automated! Just run:

```bash
docker-compose up --build
```

That's it! This single command will:

1. ✅ Build all Docker images (frontend, backend, blockchain-api, electionguard)
2. ✅ Generate Hyperledger Fabric crypto materials automatically
3. ✅ Create genesis block and channel artifacts
4. ✅ Start all services (databases, orderer, peer, couchdb)
5. ✅ Deploy chaincode automatically to the network
6. ✅ Initialize blockchain channel and chaincode
7. ✅ Enroll admin identity for blockchain API
8. ✅ Start all application services

## What Happens Automatically

### Phase 1: Artifact Generation (fabric-tools container)
- Generates cryptographic certificates for all network entities
- Creates genesis block for the orderer
- Generates channel configuration transaction
- Creates anchor peer updates
- All artifacts saved to shared Docker volume

### Phase 2: Network Startup
- **CouchDB**: State database starts first
- **Orderer**: Starts after artifacts are ready (10s delay)
- **Peer**: Starts after orderer and CouchDB (15s delay)

### Phase 3: Automated Setup (cli container)
- Creates `electionchannel` channel
- Peer joins the channel
- Packages election-logs chaincode
- Installs chaincode on peer
- Approves chaincode for organization
- Commits chaincode to channel
- Initializes ledger with contract
- **All happens automatically in 30s after peer startup**

### Phase 4: API Initialization (blockchain-api)
- Waits for crypto materials (up to 5 minutes)
- Waits for network setup to complete (20s additional)
- Enrolls admin identity with Fabric CA
- Starts REST API server on port 3000

### Phase 5: Backend & Frontend
- Backend connects to blockchain-api
- Frontend serves on port 5173
- BlockchainLogs component ready in Verification tab

## Access Points

After `docker-compose up --build` completes:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React application with blockchain logs |
| Backend API | http://localhost:8080 | Spring Boot REST API |
| Blockchain API | http://localhost:3000 | Hyperledger Fabric gateway |
| CouchDB | http://localhost:5984 | State database (admin/adminpw) |

## Verification

1. Wait for all containers to show "ready" status
2. Open http://localhost:5173
3. Navigate to any election's Verification tab
4. You should see blockchain logs automatically!

## View Blockchain Logs

### From Frontend
- Go to Election Page → Verification Tab
- See real-time blockchain audit trail

### From CLI (optional, for debugging)
```bash
# View blockchain API logs
docker logs blockchain_api

# View CLI setup logs
docker logs cli

# View peer logs
docker logs peer0.amarvote.com
```

## Troubleshooting

### If blockchain logs don't appear:
1. Check if all containers are running: `docker ps`
2. Check blockchain-api logs: `docker logs blockchain_api`
3. Check CLI setup logs: `docker logs cli`

### Reset Everything:
```bash
docker-compose down -v
docker-compose up --build
```

The `-v` flag removes all volumes, ensuring a completely fresh start.

## Technical Details

### Service Dependencies
```
fabric-tools (generates artifacts)
    ↓
orderer + peer + couchdb (start network)
    ↓
cli (deploys chaincode automatically)
    ↓
blockchain-api (enrolls admin, starts API)
    ↓
backend + frontend (application ready)
```

### Shared Volume
All blockchain artifacts are stored in `fabric_shared` Docker volume:
- `/shared/crypto-config/` - Certificates and keys
- `/shared/channel-artifacts/` - Genesis block, channel config

### Automatic Scripts
1. `fabric-network/scripts/generate-artifacts-docker.sh` - Crypto generation
2. `fabric-network/scripts/auto-setup.sh` - Channel & chaincode deployment
3. `blockchain-api/start.sh` - Admin enrollment and server start

## Why This Works

The docker-compose.yml is configured with:
- **Smart dependencies**: Services wait for prerequisites
- **Startup delays**: Commands use `sleep` to ensure prior services are ready
- **Shared volumes**: Crypto materials accessible to all containers
- **Automated scripts**: Run on container startup without manual intervention
- **Error handling**: Scripts check for existing artifacts to avoid duplication

## No Manual Steps Required!

Unlike traditional Hyperledger Fabric setups that require:
- ❌ Running `cryptogen` manually
- ❌ Running `configtxgen` manually
- ❌ `docker exec -it cli bash`
- ❌ `./setup-network.sh`
- ❌ Enrolling admin manually

**AmarVote does it all automatically!** 🎉

---

*Built with ❤️ for secure, transparent, and auditable elections*
