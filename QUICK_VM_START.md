# Quick Start Commands for VM Deployment

## Transfer Files to VM
```bash
# From your Windows machine (PowerShell or WSL)
scp -r blockchain-api fabric-network fix-vm-deployment.sh vm-commands.sh VM_DEPLOYMENT_FIX.md DEPLOYMENT_SUMMARY.md user@your-vm-ip:/path/to/AmarVote/

# OR if using Git
git add .
git commit -m "Fix VM deployment issues"
git push
# Then on VM: git pull
```

## On Your Debian VM - Run These Commands

```bash
# 1. Navigate to project
cd /path/to/AmarVote

# 2. Make scripts executable
chmod +x fix-vm-deployment.sh vm-commands.sh blockchain-api/start.sh fabric-network/scripts/*.sh

# 3. Run the deployment fix
./fix-vm-deployment.sh

# This will take about 3-5 minutes
# It will automatically:
# - Stop all containers
# - Clean old certificates
# - Generate fresh crypto materials
# - Start all services in correct order
# - Verify the deployment
```

## Verify Deployment

```bash
# Quick health check
curl http://localhost:3000/api/blockchain/health

# Check all services
docker-compose -f docker-compose.prod.yml ps

# View blockchain API logs
docker logs blockchain_api | tail -30

# Test full functionality
curl -X POST http://localhost:3000/api/blockchain/log/election-created \
  -H "Content-Type: application/json" \
  -d '{
    "electionId": "154",
    "electionName": "Test Election",
    "organizerName": "Admin",
    "startDate": "2025-11-20",
    "endDate": "2025-11-25"
  }'
```

## Interactive Management

```bash
# Launch interactive menu
./vm-commands.sh

# This gives you easy access to:
# - Status checking
# - Log viewing
# - Service restarts
# - Testing
# - Troubleshooting
```

## If Something Goes Wrong

```bash
# Full clean restart
./fix-vm-deployment.sh

# OR manually clean and restart
docker-compose -f docker-compose.prod.yml down -v
docker volume rm amarvote_fabric_shared amarvote_orderer_data amarvote_peer_data amarvote_couchdb_data
./fix-vm-deployment.sh
```

## Expected Success Output

When blockchain_api starts successfully, you should see:
```
✓ Peer is ready
✓ Orderer is ready
✓ Crypto materials found
🔑 Enrolling admin identity...
✓ Successfully enrolled admin and imported to wallet
✓ MSP ID: AmarVoteOrgMSP
🌐 Starting blockchain API server...
Blockchain API server listening on port 3000
```

## Common Issues

### Issue 1: Certificate errors
```bash
# Solution: Re-enroll admin
docker exec blockchain_api rm -rf wallet/*
docker restart blockchain_api
```

### Issue 2: Chaincode not found
```bash
# Solution: Re-run channel setup
docker restart cli
sleep 60
docker logs cli
```

### Issue 3: Services not starting
```bash
# Solution: Full reset
./fix-vm-deployment.sh
```

## Port Mapping

Make sure these ports are accessible on your VM:
- 80: Frontend (Nginx)
- 3000: Blockchain API
- 5000: ElectionGuard Microservice
- 5001: RAG Service
- 8080: Backend (Spring Boot)

## Monitoring

```bash
# Watch all logs
docker-compose -f docker-compose.prod.yml logs -f

# Watch specific service
docker logs -f blockchain_api

# Check resource usage
docker stats
```

## That's It!

Your AmarVote blockchain should now be running correctly on your Debian VM.

For detailed troubleshooting, see: VM_DEPLOYMENT_FIX.md
For complete summary, see: DEPLOYMENT_SUMMARY.md
