#!/bin/bash
# Quick commands for managing AmarVote blockchain on Debian VM

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}AmarVote Blockchain Quick Commands${NC}"
echo -e "${BLUE}==================================${NC}"
echo ""

# Function to display menu
show_menu() {
    echo -e "${GREEN}Available Commands:${NC}"
    echo "1. Full Reset & Deploy"
    echo "2. Check Status"
    echo "3. View Logs"
    echo "4. Test Blockchain API"
    echo "5. Restart Services"
    echo "6. Clean Volumes"
    echo "7. Re-enroll Admin"
    echo "8. Check Chaincode"
    echo "9. Manual Channel Setup"
    echo "0. Exit"
    echo ""
}

# Function for full reset
full_reset() {
    echo -e "${YELLOW}Performing full reset and deployment...${NC}"
    ./fix-vm-deployment.sh
}

# Function to check status
check_status() {
    echo -e "${GREEN}Checking container status...${NC}"
    docker-compose -f docker-compose.prod.yml ps
    echo ""
    echo -e "${GREEN}Checking volumes...${NC}"
    docker volume ls | grep amarvote
    echo ""
    echo -e "${GREEN}Checking network...${NC}"
    docker network inspect amarvote_election_net --format '{{.Name}}: {{len .Containers}} containers'
}

# Function to view logs
view_logs() {
    echo -e "${GREEN}Select service to view logs:${NC}"
    echo "1. Blockchain API"
    echo "2. Peer"
    echo "3. Orderer"
    echo "4. CLI"
    echo "5. All Fabric Services"
    echo "6. Backend"
    echo "7. All Services"
    read -p "Enter choice: " log_choice
    
    case $log_choice in
        1) docker logs -f blockchain_api ;;
        2) docker logs -f peer0.amarvote.com ;;
        3) docker logs -f orderer.amarvote.com ;;
        4) docker logs -f cli ;;
        5) docker-compose -f docker-compose.prod.yml logs -f blockchain-api peer0.amarvote.com orderer.amarvote.com cli ;;
        6) docker logs -f amarvote_backend ;;
        7) docker-compose -f docker-compose.prod.yml logs -f ;;
        *) echo -e "${RED}Invalid choice${NC}" ;;
    esac
}

# Function to test blockchain API
test_api() {
    echo -e "${GREEN}Testing Blockchain API...${NC}"
    
    echo -e "${BLUE}1. Health Check:${NC}"
    curl -s http://localhost:3000/api/blockchain/health | jq '.' || echo "Failed"
    echo ""
    
    echo -e "${BLUE}2. Test Log Creation:${NC}"
    curl -s -X POST http://localhost:3000/api/blockchain/log/election-created \
      -H "Content-Type: application/json" \
      -d '{
        "electionId": "test-'$(date +%s)'",
        "electionName": "Test Election",
        "organizerName": "Test Organizer",
        "startDate": "2025-11-20",
        "endDate": "2025-11-25"
      }' | jq '.' || echo "Failed"
    echo ""
}

# Function to restart services
restart_services() {
    echo -e "${GREEN}Select restart option:${NC}"
    echo "1. All services (soft restart)"
    echo "2. Blockchain services only"
    echo "3. Application services only"
    echo "4. Full restart (with rebuild)"
    read -p "Enter choice: " restart_choice
    
    case $restart_choice in
        1) docker-compose -f docker-compose.prod.yml restart ;;
        2) docker-compose -f docker-compose.prod.yml restart blockchain-api peer0.amarvote.com orderer.amarvote.com cli ;;
        3) docker-compose -f docker-compose.prod.yml restart backend frontend electionguard rag-service ;;
        4) docker-compose -f docker-compose.prod.yml down && docker-compose -f docker-compose.prod.yml up -d --build ;;
        *) echo -e "${RED}Invalid choice${NC}" ;;
    esac
}

# Function to clean volumes
clean_volumes() {
    echo -e "${YELLOW}⚠️  This will delete all blockchain data!${NC}"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        docker-compose -f docker-compose.prod.yml down -v
        docker volume rm amarvote_fabric_shared amarvote_orderer_data amarvote_peer_data amarvote_couchdb_data 2>/dev/null || true
        echo -e "${GREEN}Volumes cleaned. Run 'Full Reset & Deploy' to restart.${NC}"
    else
        echo -e "${RED}Cancelled${NC}"
    fi
}

# Function to re-enroll admin
reenroll_admin() {
    echo -e "${GREEN}Re-enrolling admin...${NC}"
    docker exec blockchain_api rm -rf wallet/*
    docker exec blockchain_api node enrollAdmin.js
    echo -e "${GREEN}Admin re-enrollment complete${NC}"
}

# Function to check chaincode
check_chaincode() {
    echo -e "${GREEN}Checking chaincode status...${NC}"
    
    echo -e "${BLUE}Installed Chaincode:${NC}"
    docker exec cli peer lifecycle chaincode queryinstalled
    echo ""
    
    echo -e "${BLUE}Committed Chaincode:${NC}"
    docker exec cli peer lifecycle chaincode querycommitted -C electionchannel
    echo ""
    
    echo -e "${BLUE}Test Query:${NC}"
    docker exec cli peer chaincode query -C electionchannel -n election-logs -c '{"function":"queryAllLogs","Args":[]}' | jq '.' || echo "Failed"
}

# Function for manual channel setup
manual_channel_setup() {
    echo -e "${YELLOW}Running manual channel setup...${NC}"
    docker exec cli bash -c "cd /opt/gopath/src/github.com/hyperledger/fabric/peer/scripts && ./auto-setup.sh"
    echo -e "${GREEN}Setup complete. Check logs above for any errors.${NC}"
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter your choice: " choice
    echo ""
    
    case $choice in
        1) full_reset ;;
        2) check_status ;;
        3) view_logs ;;
        4) test_api ;;
        5) restart_services ;;
        6) clean_volumes ;;
        7) reenroll_admin ;;
        8) check_chaincode ;;
        9) manual_channel_setup ;;
        0) echo -e "${GREEN}Goodbye!${NC}"; exit 0 ;;
        *) echo -e "${RED}Invalid choice. Please try again.${NC}" ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
done
