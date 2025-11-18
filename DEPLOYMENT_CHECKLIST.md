# 🚀 Deployment Checklist - Automated Blockchain Setup

## Pre-Deployment

### System Requirements
- [ ] Docker installed and running (version 20.10+)
- [ ] Docker Compose installed (version 2.0+)
- [ ] At least 8GB RAM available
- [ ] Ports available: 3000, 5000, 5173, 5984, 7050, 7051, 7052, 8080

### Configuration Files
- [ ] `.env` file exists in project root
- [ ] Database credentials configured (NEON_HOST, NEON_PORT, etc.)
- [ ] Security keys configured (MASTER_KEY_PQ, JWT_SECRET)
- [ ] Email credentials set (MAIL_PASSWORD)

### Check Files Exist
- [ ] `docker-compose.yml` in project root
- [ ] `fabric-network/scripts/generate-artifacts-docker.sh` exists
- [ ] `fabric-network/scripts/auto-setup.sh` exists
- [ ] `blockchain-api/start.sh` exists
- [ ] `fabric-network/config/configtx.yaml` exists
- [ ] `fabric-network/config/crypto-config.yaml` exists
- [ ] `fabric-network/chaincode/election-logs/` directory exists

## Deployment Steps

### 1. Clean Start (Recommended for First Run)
```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove any dangling images
docker system prune -f
```

### 2. Deploy Everything
```bash
# One command - builds and starts everything!
docker-compose up --build
```

### 3. Monitor Progress (In separate terminals)

**Terminal 1 - Artifact Generation:**
```bash
docker logs -f fabric-tools
```
Expected output:
```
Generating Fabric network artifacts...
Generating cryptographic materials...
✓ Crypto materials generated
Generating genesis block...
✓ Genesis block created
Generating channel configuration transaction...
✓ Channel transaction created
✓ All artifacts generated successfully!
```

**Terminal 2 - Chaincode Deployment:**
```bash
docker logs -f cli
```
Expected output:
```
Creating channel...
✓ Channel created
Joining peer to channel...
✓ Peer joined
Packaging chaincode...
✓ Chaincode packaged
Installing chaincode...
✓ Chaincode installed
Approving chaincode...
✓ Chaincode approved
Committing chaincode...
✓ Chaincode committed
Initializing chaincode...
✓ Chaincode initialized
=================================
✓ Network setup complete!
```

**Terminal 3 - Blockchain API:**
```bash
docker logs -f blockchain_api
```
Expected output:
```
Waiting for Fabric network to be ready...
Waiting for crypto materials... (1/60)
✓ Crypto materials found
Waiting for network setup to complete...
Enrolling admin user...
✓ Admin enrolled successfully
Starting Blockchain API server...
Blockchain API listening on port 3000
```

## Verification Checklist

### Container Health
```bash
# All containers should be running
docker ps
```
Expected containers:
- [ ] `frontend`
- [ ] `backend`
- [ ] `electionguard`
- [ ] `blockchain_api`
- [ ] `orderer.amarvote.com`
- [ ] `peer0.amarvote.com`
- [ ] `couchdb`
- [ ] `cli` (should be up even after setup completes)
- [ ] `fabric-tools` (may exit after generating artifacts - this is normal)

### Service Health Checks
```bash
# Test ElectionGuard
curl http://localhost:5000/health

# Test Backend
curl http://localhost:8080/actuator/health

# Test Blockchain API
curl http://localhost:3000/api/health

# Test CouchDB
curl http://admin:adminpw@localhost:5984/
```

All should return successful responses.

### Blockchain Verification
```bash
# Query blockchain for election logs (should return empty array if no elections yet)
curl http://localhost:3000/api/election/1/logs

# Check if channel exists
docker exec cli peer channel list
# Should show: electionchannel

# Check installed chaincode
docker exec cli peer lifecycle chaincode queryinstalled
# Should show: electionlogs
```

### Frontend Verification
1. Open browser: http://localhost:5173
2. Log in (create account if needed)
3. Create or open an election
4. Navigate to "Verification" tab
5. Check "Blockchain Logs" section
   - [ ] Section is visible
   - [ ] Timeline component renders
   - [ ] Filters are available (All, Created, Ballot, Ended, Tally)
   - [ ] Refresh button works

## Expected Timeline

| Phase | Duration | Status Indicator |
|-------|----------|------------------|
| Image Building | 2-5 min | `docker-compose up --build` output |
| Crypto Generation | 10-20 sec | `fabric-tools` logs |
| Network Startup | 15-30 sec | `orderer` and `peer` logs |
| Chaincode Deploy | 30-60 sec | `cli` logs |
| API Initialization | 20-40 sec | `blockchain_api` logs |
| **Total** | **3-7 min** | All services running |

## Troubleshooting

### Issue: fabric-tools exits with error
**Check:**
```bash
docker logs fabric-tools
```
**Common causes:**
- Config files missing/invalid
- Permission issues with volumes

**Fix:**
```bash
# Ensure scripts are executable
chmod +x fabric-network/scripts/*.sh

# Restart
docker-compose down -v
docker-compose up --build
```

### Issue: cli shows "Channel creation failed"
**Check:**
```bash
docker logs cli
docker logs orderer.amarvote.com
```
**Common causes:**
- Orderer not ready yet
- Genesis block missing
- Network connectivity issues

**Fix:**
```bash
# Check if genesis block exists
docker exec cli ls -la /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/

# Restart from clean state
docker-compose down -v
docker-compose up --build
```

### Issue: blockchain-api shows "Crypto materials not found"
**Check:**
```bash
docker logs blockchain_api
```
**Common causes:**
- Crypto generation failed
- Volume mount issue

**Fix:**
```bash
# Check if crypto materials exist
docker exec blockchain_api ls -la /app/crypto-config/

# If empty, regenerate:
docker-compose down -v
docker-compose up --build
```

### Issue: Frontend shows "Unable to load blockchain logs"
**Check:**
```bash
# Test blockchain API directly
curl http://localhost:3000/api/election/1/logs

# Check backend connectivity
docker logs backend | grep blockchain
```
**Common causes:**
- Chaincode not deployed
- Backend can't reach blockchain-api
- No elections created yet (expected for new deployment)

**Fix:**
```bash
# Verify chaincode is running
docker exec cli peer lifecycle chaincode querycommitted -C electionchannel

# Check network connectivity
docker exec backend ping -c 3 blockchain-api
```

### Nuclear Option: Complete Reset
```bash
# Stop everything
docker-compose down -v

# Remove all Docker volumes
docker volume prune -f

# Remove all unused images
docker image prune -a -f

# Fresh start
docker-compose up --build
```

## Post-Deployment Testing

### 1. Create Election
- [ ] Log in to frontend
- [ ] Create new election
- [ ] Add candidates
- [ ] Set election dates
- [ ] Save election

### 2. Check Blockchain Log
```bash
# Should show "Election Created" log
curl http://localhost:3000/api/election/<ELECTION_ID>/logs
```

### 3. Cast Ballot (if election is active)
- [ ] Cast a test ballot
- [ ] Check tracking code provided
- [ ] Verify in Verification tab

### 4. Check Ballot Log
```bash
# Should show "Ballot Received" log
curl http://localhost:3000/api/election/<ELECTION_ID>/logs
```

### 5. End Election
- [ ] End the election
- [ ] Verify tally process completes

### 6. Check End Log
```bash
# Should show "Election Ended" and "Tally Completed" logs
curl http://localhost:3000/api/election/<ELECTION_ID>/logs
```

## Success Indicators ✅

Your deployment is successful when:
- ✅ All 8+ containers are running (`docker ps`)
- ✅ Health checks pass for all services
- ✅ `curl http://localhost:3000/api/health` returns success
- ✅ Frontend loads at http://localhost:5173
- ✅ Blockchain Logs section visible in Verification tab
- ✅ Creating election generates blockchain log
- ✅ Casting ballot generates blockchain log
- ✅ Ending election generates blockchain log

## Monitoring Commands

```bash
# View all container statuses
docker-compose ps

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker logs -f <container_name>

# Check blockchain network status
docker exec cli peer channel list
docker exec cli peer lifecycle chaincode queryinstalled

# Check blockchain data in CouchDB
curl http://admin:adminpw@localhost:5984/_utils
# Open in browser to see web UI

# Monitor resource usage
docker stats
```

## Maintenance

### Regular Operations
```bash
# Stop services (preserves data)
docker-compose down

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart <service_name>
```

### Update Deployment
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up --build
```

### Backup Blockchain Data
```bash
# Backup volumes
docker run --rm -v amarvote_fabric_shared:/data -v $(pwd)/backup:/backup alpine tar czf /backup/fabric-backup-$(date +%Y%m%d).tar.gz /data

# Backup CouchDB
docker exec couchdb curl -X POST http://admin:adminpw@localhost:5984/_replicate -H "Content-Type: application/json" -d '{"source":"electionchannel_electionlogs","target":"http://admin:adminpw@backup-server:5984/electionchannel_electionlogs"}'
```

## Documentation References

- **AUTOMATED_SETUP.md** - Complete automation guide
- **README.md** - Main project documentation
- **BLOCKCHAIN_IMPLEMENTATION_SUMMARY.md** - Technical architecture
- **BLOCKCHAIN_QUICK_REFERENCE.md** - API reference
- **BLOCKCHAIN_AUTOMATION_COMPLETE.md** - Automation details

---

**Last Updated**: January 2025  
**Version**: 1.0 (Fully Automated)  
**Support**: Check logs with `docker logs <container>` or open GitHub issue
