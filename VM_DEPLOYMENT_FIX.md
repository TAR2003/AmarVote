# VM Deployment Fix Guide for AmarVote

This guide fixes the certificate and blockchain issues on your Debian VM.

## 🔍 Root Cause Analysis

### Problem 1: Certificate Authority Mismatch
- **Error**: `x509: certificate signed by unknown authority`
- **Cause**: Blockchain API is using certificates that don't match the peer's CA
- **Solution**: Regenerate certificates on VM and re-enroll admin

### Problem 2: Chaincode Container Not Found
- **Error**: `lookup election-logs-chaincode: no such host`
- **Cause**: Chaincode version mismatch and container naming issues
- **Solution**: Fixed chaincode labeling in auto-setup.sh

## 🛠️ Deployment Steps

### Step 1: Transfer Files to VM

On your **Windows machine**, transfer the updated code to your VM:

```bash
# Using SCP (replace with your VM details)
scp -r ./blockchain-api your-user@your-vm-ip:/path/to/AmarVote/
scp -r ./fabric-network/scripts your-user@your-vm-ip:/path/to/AmarVote/fabric-network/
scp ./fix-vm-deployment.sh your-user@your-vm-ip:/path/to/AmarVote/
```

### Step 2: Run on Debian VM

SSH into your VM and run:

```bash
cd /path/to/AmarVote

# Make scripts executable
chmod +x fix-vm-deployment.sh
chmod +x blockchain-api/start.sh
chmod +x fabric-network/scripts/*.sh

# Run the fix script
./fix-vm-deployment.sh
```

### Step 3: Verify Deployment

Check the logs:

```bash
# Check blockchain API
docker logs blockchain_api

# Check peer
docker logs peer0.amarvote.com

# Check CLI (channel and chaincode setup)
docker logs cli

# Check all services
docker-compose -f docker-compose.prod.yml ps
```

## 🧪 Testing

### Test 1: Health Check
```bash
curl http://localhost:3000/api/blockchain/health
```

Expected response:
```json
{"status": "healthy", "service": "blockchain-api"}
```

### Test 2: Query Chaincode
```bash
docker exec cli peer chaincode query -C electionchannel -n election-logs -c '{"function":"queryAllLogs","Args":[]}'
```

### Test 3: Full API Test
```bash
curl -X POST http://localhost:3000/api/blockchain/log/election-created \
  -H "Content-Type: application/json" \
  -d '{
    "electionId": "test-001",
    "electionName": "Test Election",
    "organizerName": "Test Organizer",
    "startDate": "2025-11-20",
    "endDate": "2025-11-25"
  }'
```

## 🔧 Manual Troubleshooting (if needed)

### If crypto materials are missing:

```bash
# Stop all containers
docker-compose -f docker-compose.prod.yml down -v

# Remove old volumes
docker volume rm amarvote_fabric_shared

# Restart only fabric-tools to regenerate
docker-compose -f docker-compose.prod.yml up -d fabric-tools

# Wait and check
sleep 30
docker exec fabric-tools ls -la /shared/crypto-config
```

### If admin enrollment fails:

```bash
# Remove old wallet
docker exec blockchain_api rm -rf wallet/*

# Check crypto materials are mounted
docker exec blockchain_api ls -la /shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/

# Re-run enrollment
docker exec blockchain_api node enrollAdmin.js
```

### If chaincode fails:

```bash
# Check chaincode installation
docker exec cli peer lifecycle chaincode queryinstalled

# Check chaincode on channel
docker exec cli peer lifecycle chaincode querycommitted -C electionchannel

# Reinstall if needed
docker exec cli bash -c "cd /opt/gopath/src/github.com/hyperledger/fabric/peer/scripts && ./auto-setup.sh"
```

## 📊 Verification Checklist

- [ ] All containers are running (`docker-compose ps`)
- [ ] Fabric-tools completed successfully (check logs)
- [ ] Orderer is running without errors
- [ ] Peer is running without errors
- [ ] CLI completed channel and chaincode setup
- [ ] Blockchain API enrolled admin successfully
- [ ] Health endpoint returns 200
- [ ] Can query chaincode through CLI
- [ ] Can call blockchain API endpoints

## 🚨 Common Errors and Solutions

### Error: "creator org unknown"
**Solution**: Admin certificate not signed by correct CA
```bash
# Delete wallet and re-enroll
docker exec blockchain_api rm -rf wallet/*
docker restart blockchain_api
```

### Error: "chaincode container not found"
**Solution**: Chaincode not installed or wrong version
```bash
# Restart CLI to re-run setup
docker restart cli
# Wait 60 seconds for setup to complete
sleep 60
docker logs cli
```

### Error: "channel not found"
**Solution**: Channel not created
```bash
# Check if channel exists
docker exec cli peer channel list
# If not, restart CLI to recreate
docker restart cli
```

## 📝 Environment Differences

### Windows (Development) vs Debian (Production)

| Aspect | Windows | Debian VM |
|--------|---------|-----------|
| Docker | Docker Desktop | Docker Engine |
| Paths | Windows paths | Unix paths |
| Certificates | Generated locally | Generated in container |
| Network | Host network | Bridge network |
| Volumes | Named volumes | Named volumes |

**Key Point**: Always regenerate certificates on the target environment!

## 🔄 Quick Restart Command

If you need to restart everything:

```bash
# Quick restart preserving data
docker-compose -f docker-compose.prod.yml restart

# Full restart with fresh certificates
./fix-vm-deployment.sh
```

## 📞 Getting More Info

```bash
# Full system status
docker-compose -f docker-compose.prod.yml ps
docker stats --no-stream

# Network inspection
docker network inspect amarvote_election_net

# Volume inspection
docker volume ls
docker volume inspect amarvote_fabric_shared

# Live logs
docker-compose -f docker-compose.prod.yml logs -f blockchain-api peer0.amarvote.com
```

## ✅ Success Indicators

When everything is working, you should see:

1. **Blockchain API logs**:
   ```
   ✓ Successfully enrolled admin and imported to wallet
   ✓ MSP ID: AmarVoteOrgMSP
   Blockchain API server listening on port 3000
   ```

2. **Peer logs**:
   ```
   Elected as a leader
   Committed block [X] with Y transaction(s)
   ```

3. **CLI logs**:
   ```
   ✓ Channel created
   ✓ Peer joined channel
   ✓ Chaincode installed
   ✓ Chaincode committed
   ✓ Blockchain network setup complete!
   ```

## 🎯 Final Notes

- The fix script handles everything automatically
- All certificates are regenerated fresh on the VM
- Chaincode version is now consistent
- Admin enrollment is more robust with retries
- Better error messages and logging throughout

If you still encounter issues, check the specific logs mentioned above and verify that all volumes are mounted correctly.
