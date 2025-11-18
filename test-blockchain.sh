#!/bin/bash

# Blockchain Integration Test Script
# Tests the complete blockchain logging flow

echo "=========================================="
echo "AmarVote Blockchain Integration Test"
echo "=========================================="
echo ""

API_URL="http://localhost:3000"
BACKEND_URL="http://localhost:8080"
ELECTION_ID="test-election-$(date +%s)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local description=$1
    local method=$2
    local url=$3
    local data=$4
    
    echo -n "Testing: $description ... "
    
    if [ "$method" == "POST" ]; then
        response=$(curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s "$url")
    fi
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Response: $response"
        ((FAILED++))
        return 1
    fi
}

# Check if services are running
echo "Checking services..."
echo ""

echo -n "Blockchain API ... "
if curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Please start the blockchain API service first"
    exit 1
fi

echo -n "Backend API ... "
if curl -s "$BACKEND_URL/api/blockchain/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${YELLOW}⚠ Not running (optional)${NC}"
fi

echo ""
echo "Running tests with Election ID: $ELECTION_ID"
echo ""

# Test 1: Log election created
test_endpoint \
    "Log election created" \
    "POST" \
    "$API_URL/api/blockchain/log/election-created" \
    '{
        "electionId": "'"$ELECTION_ID"'",
        "electionName": "Test Election 2025",
        "organizerName": "Test Organizer",
        "startDate": "2025-01-01T00:00:00Z",
        "endDate": "2025-01-31T23:59:59Z"
    }'

sleep 1

# Test 2: Log election started
test_endpoint \
    "Log election started" \
    "POST" \
    "$API_URL/api/blockchain/log/election-started" \
    '{
        "electionId": "'"$ELECTION_ID"'",
        "startedBy": "admin@amarvote.com"
    }'

sleep 1

# Test 3: Log ballot received
test_endpoint \
    "Log ballot received" \
    "POST" \
    "$API_URL/api/blockchain/log/ballot-received" \
    '{
        "electionId": "'"$ELECTION_ID"'",
        "trackingCode": "TRACK-TEST-001",
        "ballotHash": "abc123def456789",
        "voterId": "voter123"
    }'

sleep 1

# Test 4: Log another ballot
test_endpoint \
    "Log second ballot" \
    "POST" \
    "$API_URL/api/blockchain/log/ballot-received" \
    '{
        "electionId": "'"$ELECTION_ID"'",
        "trackingCode": "TRACK-TEST-002",
        "ballotHash": "xyz789abc456123",
        "voterId": "voter456"
    }'

sleep 1

# Test 5: Log ballot audited
test_endpoint \
    "Log ballot audited" \
    "POST" \
    "$API_URL/api/blockchain/log/ballot-audited" \
    '{
        "electionId": "'"$ELECTION_ID"'",
        "trackingCode": "TRACK-TEST-001",
        "ballotHash": "abc123def456789"
    }'

sleep 1

# Test 6: Log election ended
test_endpoint \
    "Log election ended" \
    "POST" \
    "$API_URL/api/blockchain/log/election-ended" \
    '{
        "electionId": "'"$ELECTION_ID"'",
        "totalVotes": 2,
        "endedBy": "admin@amarvote.com"
    }'

sleep 2

# Test 7: Get all logs for election
echo -n "Testing: Get all election logs ... "
response=$(curl -s "$API_URL/api/blockchain/logs/$ELECTION_ID")
log_count=$(echo "$response" | grep -o '"logType"' | wc -l)

if [ "$log_count" -ge 6 ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Found $log_count logs)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Expected at least 6 logs, found $log_count)"
    ((FAILED++))
fi

# Test 8: Query logs by type
echo -n "Testing: Query logs by type ... "
response=$(curl -s "$API_URL/api/blockchain/logs/$ELECTION_ID/BALLOT_RECEIVED")
ballot_count=$(echo "$response" | grep -o '"logType":"BALLOT_RECEIVED"' | wc -l)

if [ "$ballot_count" -eq 2 ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Found $ballot_count ballot logs)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Expected 2 ballot logs, found $ballot_count)"
    ((FAILED++))
fi

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total Tests: $(($PASSED + $FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "View the logs in:"
    echo "  - CouchDB: http://localhost:5984/_utils"
    echo "  - API: $API_URL/api/blockchain/logs/$ELECTION_ID"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Check the logs with:"
    echo "  docker-compose logs blockchain-api"
    echo "  docker-compose logs peer0.amarvote.com"
    echo ""
    exit 1
fi
