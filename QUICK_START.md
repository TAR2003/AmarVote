# 🚀 Quick Start Guide - AmarVote with Blockchain

## Prerequisites Check
✅ Docker Desktop is running  
✅ Ports 5173, 8080, 5000, 3000, 5984, 7050, 7051 are available

## Step 1: Generate Blockchain Artifacts (First Time Only)

**Option A - Windows PowerShell (Recommended):**
```powershell
.\setup-blockchain.ps1
```

**Option B - Using Git Bash (Windows):**
```bash
cd fabric-network
./scripts/generate-artifacts.sh
cd ..
```

**Option C - Linux/Mac:**
```bash
cd fabric-network
chmod +x scripts/*.sh
./scripts/generate-artifacts.sh
cd ..
```

## Step 2: Start All Services

```bash
docker-compose up --build
```

**This will start:**
- ✅ Frontend (React) - http://localhost:5173
- ✅ Backend (Spring Boot) - http://localhost:8080
- ✅ ElectionGuard (Python) - http://localhost:5000
- ✅ Blockchain API (Node.js) - http://localhost:3000
- ✅ Fabric Orderer - Port 7050
- ✅ Fabric Peer - Port 7051
- ✅ CouchDB - http://localhost:5984/_utils

## Step 3: Setup Blockchain Network (First Time Only)

**Wait ~30 seconds for containers to start**, then in a new terminal:

```bash
docker exec -it cli bash
cd scripts
./setup-network.sh
exit
```

This deploys the smart contract to the blockchain.

## Step 4: Verify Everything Works

```bash
# Test blockchain API
curl http://localhost:3000/health

# Test backend
curl http://localhost:8080/api/blockchain/health

# Run comprehensive test
./test-blockchain.sh
```

## 🎯 Using the Blockchain Features

### 1. View Blockchain Logs (Frontend)

1. Go to http://localhost:5173
2. Navigate to any election
3. Click on **"Verification"** tab
4. Scroll down to see **"Blockchain Audit Trail"**

You'll see:
- Election creation logs
- Ballot submission logs
- Election end logs
- All with timestamps and transaction IDs

### 2. View Logs Directly (CouchDB)

1. Go to http://localhost:5984/_utils
2. Login: `admin` / `adminpw`
3. Open database: `electionchannel_election-logs`
4. Browse all blockchain records

### 3. Query via API

```bash
# Get all logs for an election
curl http://localhost:3000/api/blockchain/logs/ELECTION_ID

# Get only ballot logs
curl http://localhost:3000/api/blockchain/logs/ELECTION_ID/BALLOT_RECEIVED
```

## 🔄 Common Commands

### Restart Services
```bash
docker-compose restart blockchain-api
docker-compose restart peer0.amarvote.com
```

### View Logs
```bash
docker-compose logs -f blockchain-api
docker-compose logs -f peer0.amarvote.com
```

### Stop Everything
```bash
docker-compose down
```

### Full Reset (Deletes blockchain data)
```bash
docker-compose down
docker volume rm amarvote_orderer_data amarvote_peer_data amarvote_couchdb_data
# Then regenerate and restart
```

## ⚠️ Troubleshooting

### "npm ERR! notarget No matching version"
✅ **FIXED** - Updated package.json with correct fabric-network version

### Containers won't start
```bash
docker-compose down
docker-compose up --build --force-recreate
```

### Blockchain API not connecting
```bash
docker-compose restart blockchain-api
docker logs blockchain_api
```

### Can't see blockchain logs in frontend
1. Check backend is running: http://localhost:8080/api/blockchain/health
2. Check blockchain API: http://localhost:3000/health
3. Verify network setup was completed (Step 3)

## 📊 What Gets Logged

Every election event is automatically logged:

| Event | Description |
|-------|-------------|
| **ELECTION_CREATED** | When election is created |
| **ELECTION_STARTED** | When voting opens |
| **BALLOT_RECEIVED** | When each ballot is submitted |
| **BALLOT_AUDITED** | When ballot is audited (Benaloh) |
| **ELECTION_ENDED** | When voting closes |

## 📝 Notes

- First startup takes ~5-10 minutes to build all images
- Subsequent startups are much faster (~30 seconds)
- Blockchain artifacts only need to be generated once
- Network setup only needs to be run once (or after reset)

## ✅ Success Indicators

You'll know everything is working when:
- ✅ All 8 containers are running: `docker ps`
- ✅ Blockchain API health check responds: `curl http://localhost:3000/health`
- ✅ You can see "Blockchain Audit Trail" in frontend verification tab
- ✅ CouchDB shows the blockchain database

## 🎉 Ready to Use!

Your blockchain-enabled AmarVote system is now ready. All election events will be automatically logged to the immutable blockchain ledger!

---

**Need help?** Check `BLOCKCHAIN_SETUP_GUIDE.md` for detailed troubleshooting.
