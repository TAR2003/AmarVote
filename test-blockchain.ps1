# Test Blockchain Integration
Write-Host "`n=== Testing AmarVote Blockchain Integration ===" -ForegroundColor Cyan

# Wait for initialization
Write-Host "`nWaiting 60 seconds for blockchain network to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 60

# Test 1: Check if peer joined channel
Write-Host "`n[Test 1] Checking if peer joined channel..." -ForegroundColor Cyan
$channelList = docker exec cli peer channel list 2>&1 | Select-String "electionchannel"
if ($channelList) {
    Write-Host "✓ Peer successfully joined electionchannel" -ForegroundColor Green
} else {
    Write-Host "✗ Peer did not join channel" -ForegroundColor Red
    Write-Host "CLI Logs:" -ForegroundColor Yellow
    docker logs cli --tail 50
}

# Test 2: Check if chaincode is installed
Write-Host "`n[Test 2] Checking chaincode installation..." -ForegroundColor Cyan
$chaincode = docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | Select-String "electionlogs"
if ($chaincode) {
    Write-Host "✓ Chaincode installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Chaincode not installed" -ForegroundColor Red
}

# Test 3: Check if chaincode is committed
Write-Host "`n[Test 3] Checking chaincode commitment..." -ForegroundColor Cyan
$committed = docker exec cli peer lifecycle chaincode querycommitted -C electionchannel 2>&1 | Select-String "electionlogs"
if ($committed) {
    Write-Host "✓ Chaincode committed to channel" -ForegroundColor Green
} else {
    Write-Host "✗ Chaincode not committed" -ForegroundColor Red
}

# Test 4: Test blockchain-api health
Write-Host "`n[Test 4] Testing blockchain-api health..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
    Write-Host "✓ Blockchain API is healthy" -ForegroundColor Green
} catch {
    Write-Host "✗ Blockchain API not responding" -ForegroundColor Red
}

# Test 5: Test backend blockchain controller
Write-Host "`n[Test 5] Testing backend blockchain controller..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/blockchain/health" -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    if ($content.status -eq "healthy") {
        Write-Host "✓ Backend blockchain controller is healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Backend blockchain controller not responding" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Yellow
}

# Test 6: Test fetching blockchain logs
Write-Host "`n[Test 6] Testing blockchain logs endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/blockchain/logs/153" -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    if ($content.success -eq $true) {
        Write-Host "✓ Blockchain logs endpoint working (Success: true)" -ForegroundColor Green
        Write-Host "  Logs returned: $($content.data.Count) entries" -ForegroundColor Cyan
    } elseif ($content.success -eq $false -and $content.error -like "*DiscoveryService*") {
        Write-Host "⚠ Blockchain API responding but no data yet (chaincode initializing)" -ForegroundColor Yellow
        Write-Host "  This is normal on first startup" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Unexpected response" -ForegroundColor Red
        Write-Host $response.Content
    }
} catch {
    Write-Host "✗ Failed to fetch blockchain logs" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 7: Check container statuses
Write-Host "`n[Test 7] Container Status Summary" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "blockchain|peer0|orderer|cli"

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "`nIf all tests passed, the blockchain is fully functional!" -ForegroundColor Green
Write-Host "Frontend should now display blockchain logs in the Verification tab." -ForegroundColor Green
