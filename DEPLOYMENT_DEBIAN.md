# AmarVote Deployment Guide for Debian Server

## Prerequisites

1. **Debian Linux Server** with:
   - Docker Engine 20.10+
   - Docker Compose 1.29+
   - Minimum 4GB RAM, 20GB disk space
   - Ports 80, 3000, 5000, 5001, 5984, 7050, 7051, 8080, 9999 available

2. **Environment Variables**
   - Create `.env` file in project root with all required variables

## Quick Deployment

### Option 1: Using Deployment Script (Recommended)

```bash
# SSH into your Debian server
ssh your-user@your-server-ip

# Navigate to project directory
cd ~/projects/AmarVote

# Make deployment script executable
chmod +x deploy-debian.sh

# Run deployment (requires sudo)
sudo bash deploy-debian.sh
```

### Option 2: Manual Deployment

```bash
# Stop existing containers
sudo docker-compose -f docker-compose.prod.yml down

# Clean volumes (only if you want fresh start)
sudo docker-compose -f docker-compose.prod.yml down -v

# Build and start all services
sudo docker-compose -f docker-compose.prod.yml up -d --build

# Check status
sudo docker-compose -f docker-compose.prod.yml ps
```

## Monitoring and Troubleshooting

### View All Logs
```bash
sudo docker-compose -f docker-compose.prod.yml logs -f
```

### View Specific Service Logs
```bash
# Blockchain setup logs
sudo docker-compose -f docker-compose.prod.yml logs -f cli

# Chaincode logs
sudo docker-compose -f docker-compose.prod.yml logs -f election-logs-chaincode

# Blockchain API logs
sudo docker-compose -f docker-compose.prod.yml logs -f blockchain_api

# Backend logs
sudo docker-compose -f docker-compose.prod.yml logs -f amarvote_backend

# Frontend logs
sudo docker-compose -f docker-compose.prod.yml logs -f amarvote_frontend
```

### Check Service Health
```bash
# Check all services status
sudo docker-compose -f docker-compose.prod.yml ps

# Check specific container
sudo docker inspect election-logs-chaincode

# Check blockchain peer
sudo docker exec cli peer channel list
sudo docker exec cli peer lifecycle chaincode querycommitted -C electionchannel
```

### Common Issues and Fixes

#### 1. Chaincode Not Found Error
```bash
# Check if chaincode is committed
sudo docker exec cli peer lifecycle chaincode querycommitted -C electionchannel

# If not found, restart CLI to re-run setup
sudo docker-compose -f docker-compose.prod.yml restart cli

# Monitor CLI logs
sudo docker-compose -f docker-compose.prod.yml logs -f cli
```

#### 2. Certificate Authority Errors
```bash
# Clean volumes and restart
sudo docker-compose -f docker-compose.prod.yml down -v
sudo docker-compose -f docker-compose.prod.yml up -d

# Wait for setup to complete (check CLI logs)
sudo docker-compose -f docker-compose.prod.yml logs -f cli
```

#### 3. Chaincode Container Restarting
```bash
# Check chaincode logs
sudo docker-compose -f docker-compose.prod.yml logs election-logs-chaincode

# Usually caused by missing npm packages - rebuild
sudo docker-compose -f docker-compose.prod.yml up -d --build election-logs-chaincode
```

#### 4. Blockchain API Connection Issues
```bash
# Ensure blockchain setup is complete first
sudo docker-compose -f docker-compose.prod.yml logs cli | grep "setup complete"

# Restart blockchain-api after CLI completes
sudo docker-compose -f docker-compose.prod.yml restart blockchain_api
```

## Service Restart Order (If Needed)

If you need to restart services, follow this order:

```bash
# 1. Stop all
sudo docker-compose -f docker-compose.prod.yml down

# 2. Start infrastructure first
sudo docker-compose -f docker-compose.prod.yml up -d couchdb

# 3. Start blockchain components
sudo docker-compose -f docker-compose.prod.yml up -d fabric-tools orderer.amarvote.com peer0.amarvote.com

# 4. Start chaincode
sudo docker-compose -f docker-compose.prod.yml up -d election-logs-chaincode

# 5. Wait 15 seconds, then start CLI
sleep 15
sudo docker-compose -f docker-compose.prod.yml up -d cli

# 6. Wait for CLI to complete (check logs), then start blockchain API
sudo docker-compose -f docker-compose.prod.yml logs cli | grep "setup complete"
sudo docker-compose -f docker-compose.prod.yml up -d blockchain_api

# 7. Start application services
sudo docker-compose -f docker-compose.prod.yml up -d backend frontend electionguard rag-service
```

## Verification Steps

### 1. Check Blockchain Network
```bash
# Should show electionchannel
sudo docker exec cli peer channel list

# Should show election-logs chaincode
sudo docker exec cli peer lifecycle chaincode querycommitted -C electionchannel
```

### 2. Test Blockchain API
```bash
# Health check
curl http://localhost:3000/health

# This should return service info
```

### 3. Test Backend API
```bash
# Health check
curl http://localhost:8080/actuator/health
```

### 4. Access Frontend
```bash
# Open in browser
http://YOUR_SERVER_IP
```

## Backup and Recovery

### Backup Volumes
```bash
# Stop containers
sudo docker-compose -f docker-compose.prod.yml down

# Backup volumes
sudo tar -czf amarvote-backup-$(date +%Y%m%d).tar.gz \
  /var/lib/docker/volumes/amarvote_fabric_shared \
  /var/lib/docker/volumes/amarvote_orderer_data \
  /var/lib/docker/volumes/amarvote_peer_data \
  /var/lib/docker/volumes/amarvote_couchdb_data

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d
```

### Restore from Backup
```bash
# Stop containers
sudo docker-compose -f docker-compose.prod.yml down -v

# Restore volumes
sudo tar -xzf amarvote-backup-YYYYMMDD.tar.gz -C /

# Start containers
sudo docker-compose -f docker-compose.prod.yml up -d
```

## Security Recommendations

1. **Firewall Configuration**
```bash
# Allow only necessary ports
sudo ufw allow 80/tcp   # Frontend
sudo ufw allow 8080/tcp # Backend API
sudo ufw allow 22/tcp   # SSH
sudo ufw enable
```

2. **Update .env Secrets**
   - Change all default passwords
   - Use strong JWT secrets
   - Secure API keys

3. **Regular Updates**
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

## Performance Tuning

### For Production Servers
```bash
# Increase file descriptors
sudo sysctl -w fs.file-max=100000

# Increase network buffers
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
```

## Support

If issues persist:
1. Check all service logs
2. Verify .env file has all required variables
3. Ensure sufficient disk space and memory
4. Check Docker daemon logs: `sudo journalctl -u docker.service`
