# 🚀 AmarVote Blockchain - Quick Reference

## Quick Commands

### Start Everything
```bash
# Windows
.\setup-blockchain.ps1

# Linux/Mac
cd fabric-network && ./scripts/generate-artifacts.sh && cd .. && docker-compose up --build
```

### Stop Everything
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f blockchain-api
docker-compose logs -f peer0.amarvote.com
```

### Test Integration
```bash
./test-blockchain.sh
```

## API Quick Reference

### Log Events (Backend)

```java
// Inject service
@Autowired
private BlockchainService blockchainService;

// Log election created
blockchainService.logElectionCreated(
    electionId, name, organizer, startDate, endDate
);

// Log ballot received
blockchainService.logBallotReceived(
    electionId, trackingCode, ballotHash, voterId
);

// Log election ended
blockchainService.logElectionEnded(
    electionId, totalVotes, endedBy
);
```

### Display Logs (Frontend)

```jsx
import BlockchainLogs from './components/BlockchainLogs';

<BlockchainLogs electionId={electionId} />
```

## REST Endpoints

### Via Backend (Port 8080)
```
POST /api/blockchain/log/election-created
POST /api/blockchain/log/ballot-received
POST /api/blockchain/log/election-ended
GET  /api/blockchain/logs/{electionId}
```

### Direct API (Port 3000)
```
GET  /health
POST /api/blockchain/log/election-created
GET  /api/blockchain/logs/:electionId
```

## Common Tasks

### View Blockchain Data
- **CouchDB**: http://localhost:5984/_utils (admin/adminpw)
- **API**: http://localhost:3000/api/blockchain/logs/ELECTION_ID
- **Frontend**: Navigate to Election → Verification Tab

### Restart Blockchain
```bash
docker-compose restart blockchain-api peer0.amarvote.com orderer.amarvote.com
```

### Reset Blockchain (WARNING: Deletes all data)
```bash
docker-compose down
docker volume rm amarvote_orderer_data amarvote_peer_data amarvote_couchdb_data
# Then regenerate and restart
```

### Check Service Health
```bash
curl http://localhost:3000/health
curl http://localhost:8080/api/blockchain/health
```

## Port Reference

| Port | Service | URL |
|------|---------|-----|
| 5173 | Frontend | http://localhost:5173 |
| 8080 | Backend | http://localhost:8080 |
| 3000 | Blockchain API | http://localhost:3000 |
| 5000 | ElectionGuard | http://localhost:5000 |
| 5984 | CouchDB | http://localhost:5984/_utils |
| 7050 | Orderer | - |
| 7051 | Peer | - |

## Event Types

- `ELECTION_CREATED` - Election was created
- `ELECTION_STARTED` - Election voting opened
- `BALLOT_RECEIVED` - Ballot was submitted
- `BALLOT_AUDITED` - Ballot was audited (Benaloh)
- `ELECTION_ENDED` - Election was closed

## Troubleshooting Quick Fixes

### "Container not found"
```bash
docker-compose up -d
```

### "Cannot connect to blockchain"
```bash
docker-compose restart blockchain-api
```

### "Chaincode error"
```bash
docker exec -it cli bash
cd scripts
./setup-network.sh
```

### "Admin not found"
```bash
docker exec -it blockchain_api node enrollAdmin.js
```

## Files to Check

- **Backend Config**: `backend/src/main/resources/application.properties`
- **Frontend API**: `frontend/src/components/BlockchainLogs.jsx`
- **Blockchain API**: `blockchain-api/server.js`
- **Chaincode**: `fabric-network/chaincode/election-logs/lib/electionLogContract.js`

## Development Workflow

1. Make changes to code
2. Rebuild affected service: `docker-compose up --build -d SERVICE_NAME`
3. Test with: `./test-blockchain.sh`
4. Check logs: `docker-compose logs -f SERVICE_NAME`
5. Verify in CouchDB: http://localhost:5984/_utils

## Data Format Example

```json
{
  "docType": "electionLog",
  "logType": "BALLOT_RECEIVED",
  "electionId": "123",
  "trackingCode": "TRACK-ABC-001",
  "ballotHash": "abc123def456",
  "voterId": "voter789",
  "timestamp": "2025-11-18T10:30:00.000Z",
  "txId": "a1b2c3d4..."
}
```

## Need Help?

1. Check `BLOCKCHAIN_SETUP_GUIDE.md` for detailed instructions
2. Check `BLOCKCHAIN_README.md` for overview
3. Run test script: `./test-blockchain.sh`
4. Check container logs: `docker-compose logs`

---

**Remember**: Changes to chaincode require redeploying the network!
