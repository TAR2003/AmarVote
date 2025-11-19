#!/bin/bash
# Quick Commands for AmarVote Debian Deployment
# Copy-paste these commands in your SSH session

# ==================================================
# INITIAL DEPLOYMENT
# ==================================================

# Full deployment with build
sudo docker-compose -f docker-compose.prod.yml up -d --build

# ==================================================
# MONITORING COMMANDS
# ==================================================

# View all service status
sudo docker-compose -f docker-compose.prod.yml ps

# View blockchain setup progress
sudo docker-compose -f docker-compose.prod.yml logs -f cli

# View chaincode logs
sudo docker-compose -f docker-compose.prod.yml logs -f election-logs-chaincode

# View blockchain API logs
sudo docker-compose -f docker-compose.prod.yml logs -f blockchain_api

# View all logs
sudo docker-compose -f docker-compose.prod.yml logs -f

# ==================================================
# VERIFICATION COMMANDS
# ==================================================

# Check if channel exists
sudo docker exec cli peer channel list

# Check if chaincode is committed
sudo docker exec cli peer lifecycle chaincode querycommitted -C electionchannel

# Check blockchain API health
curl http://localhost:3000/health

# Check backend health
curl http://localhost:8080/actuator/health

# ==================================================
# RESTART COMMANDS (if needed)
# ==================================================

# Restart specific service
sudo docker-compose -f docker-compose.prod.yml restart cli
sudo docker-compose -f docker-compose.prod.yml restart blockchain_api
sudo docker-compose -f docker-compose.prod.yml restart election-logs-chaincode

# Restart blockchain components only
sudo docker-compose -f docker-compose.prod.yml restart orderer.amarvote.com peer0.amarvote.com cli blockchain_api

# Full restart (keeps volumes)
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml up -d

# ==================================================
# CLEAN RESTART (resets blockchain)
# ==================================================

# Stop and remove volumes
sudo docker-compose -f docker-compose.prod.yml down -v

# Start fresh
sudo docker-compose -f docker-compose.prod.yml up -d --build

# ==================================================
# TROUBLESHOOTING
# ==================================================

# If chaincode not found:
sudo docker-compose -f docker-compose.prod.yml restart cli
sudo docker-compose -f docker-compose.prod.yml logs -f cli

# If certificate errors:
sudo docker-compose -f docker-compose.prod.yml down -v
sudo docker-compose -f docker-compose.prod.yml up -d

# Check container resource usage
sudo docker stats

# Check disk space
df -h

# Clean Docker system (careful - removes unused images)
sudo docker system prune -a

# ==================================================
# USEFUL DEBUGGING
# ==================================================

# Enter CLI container
sudo docker exec -it cli bash

# Inside CLI, run commands:
# peer channel list
# peer lifecycle chaincode queryinstalled
# peer lifecycle chaincode querycommitted -C electionchannel

# Check chaincode container
sudo docker exec -it election-logs-chaincode sh

# Check logs of crashed container
sudo docker logs election-logs-chaincode
sudo docker logs blockchain_api
sudo docker logs cli
