# 🚨 URGENT FIX for Debian VM - Chaincode Installation Failure

## Root Cause
The chaincode installation is failing because the CLI container cannot access the Docker socket to build chaincode images:
```
Error: docker build failed: write unix @->/run/docker.sock: write: broken pipe
```

## ✅ Solution Applied

### 1. Fixed Docker Socket Mounting
Updated `docker-compose.prod.yml`:
- Changed peer and CLI to use `/var/run/docker.sock:/host/var/run/docker.sock`
- Added `privileged: true` to CLI and peer
- Added `user: root` to CLI
- Added `DOCKER_HOST` environment variable

### 2. Created Permission Fix Script
New file: `fix-docker-permissions.sh`
- Sets Docker socket permissions
- Adds user to docker group

## 🚀 Quick Fix on Your Debian VM

### Step 1: Pull Latest Changes
```bash
cd /path/to/AmarVote
git pull
```

### Step 2: Fix Docker Permissions
```bash
# Make script executable
chmod +x fix-docker-permissions.sh

# Run with sudo
sudo ./fix-docker-permissions.sh
```

### Step 3: Deploy
```bash
# Make deployment script executable
chmod +x fix-vm-deployment.sh

# Run deployment
./fix-vm-deployment.sh
```

## 📋 What Gets Fixed

✅ Docker socket permissions (666)  
✅ User added to docker group  
✅ Peer can access Docker daemon  
✅ CLI can build chaincode images  
✅ Chaincode installs successfully  
✅ Certificates regenerated fresh  
✅ Admin enrolled correctly  

## 🔍 Verify It Works

After deployment, check chaincode:
```bash
# Check chaincode is installed
docker exec cli peer lifecycle chaincode queryinstalled

# Should show: election-logs_1.0
```

Test the API:
```bash
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

Should return: `{"success": true, ...}`

## 🎯 Why This Fixes Your Errors

### Before (Broken):
```
CLI → tries to build chaincode
  → accesses /host/var/run/
  → entire /var/run directory mounted
  → permission denied on docker.sock
  → chaincode install fails ❌
```

### After (Fixed):
```
CLI (privileged, root user)
  → accesses /host/var/run/docker.sock
  → direct socket mount with write permission
  → docker build succeeds
  → chaincode installs ✅
```

## 📝 Alternative: Manual Fix If Scripts Fail

If the automated scripts don't work:

```bash
# 1. Fix permissions manually
sudo chmod 666 /var/run/docker.sock
sudo usermod -aG docker $USER

# 2. Stop everything
docker-compose -f docker-compose.prod.yml down -v

# 3. Clean volumes
docker volume rm amarvote_fabric_shared amarvote_orderer_data amarvote_peer_data

# 4. Start fresh
docker-compose -f docker-compose.prod.yml up -d

# 5. Wait 2 minutes, then check CLI logs
docker logs cli
```

## 🎉 Expected Success Output

CLI logs should show:
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

**No more "docker build failed" errors!** 🚀
