# Cloud VM Deployment Guide - AmarVote

## Critical Fix for "creator org unknown" Error

The blockchain error you're experiencing is caused by a **mismatch between crypto materials and the existing channel**. When the channel was created with one set of certificates, but the blockchain-api is trying to use different certificates, Fabric rejects the access.

## Quick Fix (Recommended)

### Step 1: Copy Files to Cloud VM

From your Windows machine:

```bash
# Copy updated files
scp -r blockchain-api/ user@your-cloud-ip:~/AmarVote/
scp -r frontend/ user@your-cloud-ip:~/AmarVote/
scp reset-blockchain.sh user@your-cloud-ip:~/AmarVote/
scp deploy-full.sh user@your-cloud-ip:~/AmarVote/
```

### Step 2: SSH to Cloud VM and Reset Blockchain

```bash
ssh user@your-cloud-ip
cd ~/AmarVote

# Make scripts executable
chmod +x reset-blockchain.sh deploy-full.sh

# Reset blockchain completely (IMPORTANT!)
./reset-blockchain.sh
```

### Step 3: Deploy with Fresh Blockchain

```bash
# Start everything fresh
docker-compose -f docker-compose.prod.yml up -d

# Wait 2-3 minutes for initialization
sleep 180

# Check blockchain-api logs
docker logs blockchain_api -f
```

You should see:
```
✓ Crypto materials found!
✓ Successfully enrolled admin and imported to wallet
✓ Verified admin identity in wallet
```

### Step 4: Check CLI Logs

```bash
docker logs cli -f
```

You should see:
```
✓ Channel created
✓ Peer joined channel
✓ Chaincode packaged
✓ Chaincode installed
✓ Chaincode approved
✓ Chaincode committed
✓ Chaincode initialized
✓ Blockchain network setup complete!
```

## Files Changed to Fix Issues

1. **frontend/nginx.conf** - Fixed JWT token forwarding (Authorization header)
2. **frontend/src/components/BlockchainLogs.jsx** - Changed to relative URLs
3. **blockchain-api/enrollAdmin.js** - Enhanced validation and error handling
4. **blockchain-api/start.sh** - Improved startup checks
5. **blockchain-api/fabricNetwork.js** - Better error logging
6. **fabric-network/scripts/auto-setup.sh** - Better checking for existing setup
7. **reset-blockchain.sh** - NEW script for complete blockchain reset
8. **deploy-full.sh** - NEW automated deployment script

## Manual Deployment (If Scripts Don't Work)

### 1. Stop Everything

```bash
docker logs blockchain_api -f
```

**Expected Success Output:**
```
========================================
  Blockchain API Initialization
========================================
Waiting for crypto materials...
  Waiting... (attempt 1/60)
  Waiting... (attempt 2/60)
  ...
✓ Crypto materials found!
  Certificate: /shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem
  Private Key: /shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/keystore/priv_sk

Waiting for Fabric network to be ready...

Enrolling admin identity...
Wallet path: /app/wallet
✓ Crypto materials found
  Certificate: /shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/signcerts/Admin@amarvote.com-cert.pem
  Private Key: /shared/crypto-config/peerOrganizations/amarvote.com/users/Admin@amarvote.com/msp/keystore/priv_sk
✓ Successfully read crypto materials
  Certificate length: 768
  Private key length: 1704
✓ Successfully enrolled admin and imported to wallet
  MSP ID: AmarVoteOrgMSP
  Type: X.509
✓ Verified admin identity in wallet

========================================
  Starting Blockchain API Server
========================================

Blockchain API server listening on port 3000
```

### Step 6: Test Blockchain API

```bash
# Test blockchain API health
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","service":"blockchain-api"}
```

### Step 7: Check All Services

```bash
docker ps
```

You should see these containers running:
- amarvote_frontend
- amarvote_backend
- blockchain_api
- orderer.amarvote.com
- peer0.amarvote.com
- couchdb
- cli
- electionguard_service
- rag_service

### Step 8: Test From Browser

1. Open browser: `http://YOUR-CLOUD-IP`
2. Login to your account
3. Go to an election's Verification tab
4. You should now see blockchain logs without errors

## Troubleshooting

### If blockchain-api fails to start:

```bash
# Check logs
docker logs blockchain_api

# Common issues:
# 1. Crypto materials not found - fabric-tools might have failed
docker logs fabric-tools

# 2. Peer not ready - check peer logs
docker logs peer0.amarvote.com

# 3. Permission issues - check volume permissions
docker exec -it blockchain_api ls -la /shared/crypto-config/
```

### If JWT token errors persist:

```bash
# Check nginx logs
docker exec -it amarvote_frontend cat /var/log/nginx/api_error.log

# Rebuild frontend if needed
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

### Clean Restart (Nuclear Option)

If things are really broken:

```bash
# Stop everything
docker-compose -f docker-compose.prod.yml down -v

# Remove all containers
docker rm -f $(docker ps -aq)

# Remove all volumes
docker volume prune -f

# Start fresh
docker-compose -f docker-compose.prod.yml up -d
```

## What Was Fixed

### 1. JWT Token Corruption
**Problem:** nginx was not properly forwarding the Authorization header, causing JWT tokens to be corrupted.

**Solution:** Added `proxy_set_header Authorization $http_authorization;` to nginx.conf

### 2. Blockchain API Enrollment Failure
**Problem:** The admin identity was not being properly enrolled with the Fabric network, causing "creator org unknown" errors.

**Solution:** 
- Enhanced enrollAdmin.js with better error handling and validation
- Improved start.sh to fail fast if enrollment fails
- Added detailed logging to track the enrollment process

### 3. Frontend localhost URLs
**Problem:** BlockchainLogs component was using absolute URLs (http://localhost:8080/api/...) which don't work in cloud environments.

**Solution:** Changed to relative URLs (/api/...) so nginx can properly proxy the requests.

## Environment Variables

Make sure your `.env` file on the cloud VM has all required variables:

```bash
# Check .env file
cat .env

# Should include:
# - NEON_HOST, NEON_PORT, NEON_DATABASE, NEON_USERNAME, NEON_PASSWORD
# - MASTER_KEY_PQ
# - DEEPSEEK_API_KEY
# - JWT_SECRET
# - MAIL_PASSWORD
# - CLOUDINARY_NAME, CLOUDINARY_KEY, CLOUDINARY_SECRET
```

## Success Indicators

✅ All containers running
✅ blockchain_api logs show successful enrollment
✅ Frontend loads without errors
✅ Blockchain logs appear in Verification tab
✅ No JWT token errors in backend logs
✅ Elections can be created and votes cast

If you see all these, your deployment is successful!
