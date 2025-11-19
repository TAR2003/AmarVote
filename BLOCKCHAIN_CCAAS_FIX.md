# Blockchain External Chaincode (CCAAS) Configuration Fix

## Problem
The blockchain was failing with Docker socket errors and chaincode registration failures because:
1. The peer container couldn't access Docker socket for building chaincode
2. Chaincode was packaged with incorrect type ("external" instead of "ccaas")
3. External builder configuration wasn't properly set up

## Solution

### 1. Docker Socket Access
Added Docker socket mount to peer container in `docker-compose.prod.yml`:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

### 2. External Builder Configuration
Added environment variables for ccaas (Chaincode as a Service) builder:
```yaml
environment:
  - CORE_PEER_EXTERNALBUILDERS_0_NAME=ccaas_builder
  - CORE_PEER_EXTERNALBUILDERS_0_PATH=/opt/hyperledger/ccaas_builder
  - CORE_PEER_EXTERNALBUILDERS_0_PROPAGATEENVIRONMENT_0=CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG
  - CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG={"peername":"peer0AmarVoteOrg"}
```

### 3. Chaincode Package Type
Changed chaincode metadata from:
```json
{
  "type": "external",
  "label": "election-logs_1.2"
}
```

To:
```json
{
  "type": "ccaas",
  "label": "election-logs_1.3"
}
```

### 4. Updated Auto-Setup Script
Modified `fabric-network/scripts/auto-setup.sh`:
- Changed chaincode type to "ccaas"
- Updated version to 1.3
- Updated sequence to 4
- Fixed package ID grep pattern

### 5. Chaincode Container Configuration
Updated `docker-compose.prod.yml` to use correct package ID:
```yaml
environment:
  - CHAINCODE_ID_NAME=election-logs_1.3:777efdcfb971f745f683b153a612ba96332abb21414c85c382a6648717c21f19
```

## Deployment Steps

### For Fresh Deployment (Debian/Cloud Server):

1. **Pull latest code**:
   ```bash
   git pull origin main
   ```

2. **Stop existing containers**:
   ```bash
   docker-compose -f docker-compose.prod.yml down -v
   ```

3. **Clean Docker system** (optional but recommended):
   ```bash
   docker system prune -af
   docker volume prune -f
   ```

4. **Start services**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

5. **Monitor logs** to ensure chaincode installs correctly:
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f cli peer0.amarvote.com election-logs-chaincode
   ```

6. **Verify chaincode**:
   ```bash
   docker exec cli peer lifecycle chaincode querycommitted -C electionchannel
   ```
   
   Should show:
   ```
   Name: election-logs, Version: 1.3, Sequence: 4
   ```

### For Existing Deployment (Upgrade):

If you already have blockchain running with an older version:

1. **Update code**:
   ```bash
   git pull origin main
   ```

2. **Restart affected services**:
   ```bash
   docker-compose -f docker-compose.prod.yml restart peer0.amarvote.com election-logs-chaincode cli
   ```

3. The CLI container will automatically upgrade to version 1.3 if needed

## Verification

Test the blockchain API:
```bash
curl -X GET "http://localhost:8080/api/blockchain/logs/158" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": []
}
```

## Key Differences: Windows vs Linux

### Windows
- Docker Desktop provides automatic Docker socket access
- Works with both `dev` mode and external chaincode

### Linux/Debian
- Requires explicit Docker socket mount: `/var/run/docker.sock:/var/run/docker.sock`
- Must use `ccaas` type (not `external` or `dev` mode)
- External builder configuration is mandatory

## Troubleshooting

### Error: "chaincode type not supported: external"
- Ensure metadata.json uses `"type": "ccaas"` not `"type": "external"`
- Verify external builder environment variables are set

### Error: "dial unix /var/run/docker.sock: connect: no such file or directory"
- Add Docker socket volume mount to peer container
- Ensure Docker daemon is running on host

### Error: "chaincode election-logs not found"
- Check chaincode is installed: `docker exec cli peer lifecycle chaincode queryinstalled`
- Verify chaincode is committed: `docker exec cli peer lifecycle chaincode querycommitted -C electionchannel`
- Check chaincode container is running: `docker ps | grep election-logs`

### Chaincode container exits immediately
- Verify `CHAINCODE_ID_NAME` matches the installed package ID
- Check chaincode logs: `docker logs election-logs-chaincode`

## Architecture

```
┌─────────────────────┐
│   Backend (Java)    │
│   Port: 8080        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Blockchain API     │
│  (Node.js)          │
│  Port: 3000         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐       ┌──────────────────────┐
│  Peer0.amarvote.com │◄─────►│  Election-Logs-CC    │
│  (Fabric Peer)      │ gRPC  │  (External Service)  │
│  Port: 7051         │ 9999  │  Port: 9999          │
└──────────┬──────────┘       └──────────────────────┘
           │
           ▼
┌─────────────────────┐
│  CouchDB (State DB) │
│  Port: 5984         │
└─────────────────────┘
```

## Version History
- **v1.0**: Initial Node.js chaincode
- **v1.1**: Bug fixes
- **v1.2**: Attempted external chaincode (failed)
- **v1.3**: Successful CCAAS implementation with proper external builder config
