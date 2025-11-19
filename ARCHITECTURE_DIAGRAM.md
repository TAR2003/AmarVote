# AmarVote VM Deployment Architecture

## 🏗️ Service Startup Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. FABRIC-TOOLS (runs once)                                │
│  Generates crypto materials and channel artifacts           │
│  Output: /shared/crypto-config & /shared/channel-artifacts  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  2. ORDERER (orderer.amarvote.com:7050)                     │
│  Orders and sequences transactions                           │
│  Uses: /shared/crypto-config/ordererOrganizations           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  3. PEER (peer0.amarvote.com:7051)                          │
│  Validates, executes, and stores blockchain data            │
│  Uses: /shared/crypto-config/peerOrganizations              │
│  Connected to: CouchDB for state database                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  4. CLI (Fabric Tools Container)                            │
│  Creates channel "electionchannel"                          │
│  Installs & commits chaincode "election-logs"               │
│  Initializes the ledger                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  5. BLOCKCHAIN-API (Node.js Express - port 3000)            │
│  Enrolls admin using certificates from /shared              │
│  Provides REST API for blockchain operations                │
│  Connects to: peer0.amarvote.com:7051                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  6. APPLICATION SERVICES                                     │
│  Backend (Spring Boot:8080) → calls blockchain-api:3000     │
│  Frontend (Nginx:80) → displays results                     │
│  ElectionGuard (Flask:5000) → encryption                    │
│  RAG Service (Flask:5001) → chatbot                         │
└─────────────────────────────────────────────────────────────┘
```

## 🔑 Certificate Flow

```
fabric-tools generates:
├── crypto-config/
    ├── ordererOrganizations/amarvote.com/
    │   └── orderers/orderer.amarvote.com/
    │       └── msp/ (orderer certificates)
    │
    └── peerOrganizations/amarvote.com/
        ├── peers/peer0.amarvote.com/
        │   └── msp/ (peer certificates)
        │
        └── users/Admin@amarvote.com/
            └── msp/ (admin certificates)
                ├── signcerts/Admin@amarvote.com-cert.pem
                └── keystore/priv_sk

blockchain-api uses:
└── Admin@amarvote.com certificates
    └── Creates wallet/admin.id
        └── Used for all blockchain transactions
```

## 🌐 Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Network: amarvote_election_net (172.20.0.0/24)      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Orderer    │◄───┤     Peer     │◄───┤  Blockchain  │  │
│  │   :7050      │    │   :7051      │    │     API      │  │
│  └──────────────┘    └──┬───────────┘    │   :3000      │  │
│                          │                └──────▲───────┘  │
│                          │                       │          │
│                     ┌────▼──────┐                │          │
│                     │  CouchDB  │                │          │
│                     │   :5984   │                │          │
│                     └───────────┘                │          │
│                                                  │          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────┴───────┐  │
│  │   Frontend   │───►│   Backend    │───►│ ElectionGuard│  │
│  │   :80        │    │   :8080      │    │    :5000     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow for Election Logging

```
1. Frontend: User creates election
   └─► POST /api/elections (backend:8080)

2. Backend: Saves to PostgreSQL, then logs to blockchain
   └─► POST /api/blockchain/log/election-created (blockchain-api:3000)

3. Blockchain API: Creates transaction
   ├─► Uses admin identity from wallet
   ├─► Submits to peer0.amarvote.com:7051
   └─► Transaction contains: electionId, name, organizer, dates

4. Peer: Validates & executes chaincode
   ├─► Checks admin signature (MSP validation)
   ├─► Executes chaincode function "logElectionCreated"
   └─► Sends to orderer for ordering

5. Orderer: Orders transaction
   └─► Creates block with transaction
       └─► Broadcasts to peer

6. Peer: Commits block
   ├─► Stores in ledger
   ├─► Updates world state in CouchDB
   └─► Returns transaction ID

7. Blockchain API: Returns success
   └─► Backend receives confirmation
       └─► Frontend shows success
```

## 🔄 What Happens During Deployment

```
./fix-vm-deployment.sh executes:

1. docker-compose down -v
   └─► Stops all containers, removes volumes

2. Fresh volumes created:
   └─► amarvote_fabric_shared (for crypto materials)
   └─► amarvote_orderer_data (orderer ledger)
   └─► amarvote_peer_data (peer ledger)
   └─► amarvote_couchdb_data (state database)

3. fabric-tools starts:
   └─► Runs generate-artifacts-docker.sh
       ├─► cryptogen generate (creates certificates)
       ├─► configtxgen genesis.block
       ├─► configtxgen electionchannel.tx
       └─► configtxgen anchors.tx
   └─► All saved to /shared volume

4. orderer & peer start:
   └─► Mount /shared volume (read-only)
   └─► Load their respective certificates
   └─► Start gossip protocol

5. cli starts:
   └─► Runs auto-setup.sh
       ├─► peer channel create
       ├─► peer channel join
       ├─► peer lifecycle chaincode package
       ├─► peer lifecycle chaincode install
       ├─► peer lifecycle chaincode approve
       ├─► peer lifecycle chaincode commit
       └─► peer chaincode invoke (initLedger)

6. blockchain-api starts:
   └─► Runs start.sh
       ├─► Waits for peer & orderer
       ├─► Runs enrollAdmin.js
       │   └─► Reads Admin@amarvote.com certificates
       │   └─► Creates wallet/admin.id
       └─► Starts Express server

7. Application services start:
   └─► backend, frontend, electionguard, rag-service
```

## ❌ Why It Failed Before

```
OLD FLOW (Windows → VM):
┌────────────────────────────────────────────────┐
│ Windows Machine                                │
│ ├─► Generated crypto materials                │
│ ├─► Committed to Git (❌ BAD!)                 │
│ └─► Blockchain API wallet created locally     │
└────────────────────────────────────────────────┘
            │
            │ git push / git pull
            ▼
┌────────────────────────────────────────────────┐
│ Debian VM                                      │
│ ├─► Used Windows certificates (❌ MISMATCH!)   │
│ ├─► Peer: "unknown authority" error           │
│ ├─► Blockchain API: signature validation fail │
│ └─► Chaincode: version mismatch (❌ ERROR!)    │
└────────────────────────────────────────────────┘

Result: FAILED ❌
- Certificate authority mismatch
- Chaincode version inconsistency
- Wallet identity invalid
```

## ✅ Why It Works Now

```
NEW FLOW (VM-Generated):
┌────────────────────────────────────────────────┐
│ Debian VM                                      │
│ ├─► fabric-tools: Generate fresh crypto       │
│ │   └─► Certificates specific to this VM      │
│ ├─► peer: Load VM-generated certificates      │
│ ├─► blockchain-api: Enroll from VM certs      │
│ │   └─► Wallet identity matches peer CA       │
│ └─► cli: Install chaincode with correct ver   │
└────────────────────────────────────────────────┘

Result: SUCCESS ✅
- All certificates from same CA
- Peer trusts admin identity
- Chaincode version consistent
- All signatures validate
```

## 🔐 MSP (Membership Service Provider) Validation

```
When blockchain-api sends a transaction:

1. Transaction signed with: wallet/admin.id private key
                           │
2. Peer receives transaction ◄─┘
   │
3. Peer validates signature:
   ├─► Extracts certificate from transaction
   ├─► Checks certificate is signed by known CA
   │   └─► CA cert: /shared/crypto-config/.../msp/cacerts/
   ├─► Verifies MSP ID: "AmarVoteOrgMSP"
   └─► Validates signature using public key
       │
       ├─► ✅ If valid: Process transaction
       └─► ❌ If invalid: "creator org unknown" error

The fix ensures:
- Admin certificate signed by same CA as peer
- MSP ID matches exactly
- Certificate chain is valid
```

## 📝 Key Takeaways

1. **Certificates are environment-specific**
   - Generate on target deployment machine
   - Never commit crypto materials to Git

2. **Service startup order matters**
   - fabric-tools → orderer → peer → cli → blockchain-api

3. **Shared volume is critical**
   - All services access /shared for crypto materials
   - Must be read-only for orderer and peer (security)

4. **Admin enrollment must succeed**
   - Blockchain API cannot work without valid admin identity
   - Wallet must be created from VM-generated certificates

5. **Chaincode version consistency**
   - Label, version, and sequence must match
   - Package ID generated from label

This architecture ensures secure, validated, and consistent blockchain operations!
