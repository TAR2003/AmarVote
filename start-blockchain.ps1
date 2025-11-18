# Start AmarVote with Blockchain
Write-Host "Starting AmarVote services..." -ForegroundColor Green

# Start all services
docker-compose up -d

Write-Host "`nWaiting for fabric-tools to generate artifacts..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check fabric-tools
Write-Host "`n=== Fabric Tools Logs ===" -ForegroundColor Cyan
docker logs fabric-tools

# Check if artifacts were generated successfully
$fabricToolsExit = docker inspect fabric-tools --format='{{.State.ExitCode}}'
if ($fabricToolsExit -eq "0") {
    Write-Host "`n✓ Crypto artifacts generated successfully!" -ForegroundColor Green
} else {
    Write-Host "`n✗ Fabric tools failed with exit code: $fabricToolsExit" -ForegroundColor Red
    Write-Host "Check logs above for details" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nWaiting for blockchain network to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Check orderer
Write-Host "`n=== Orderer Status ===" -ForegroundColor Cyan
docker logs orderer.amarvote.com --tail 20

# Check peer
Write-Host "`n=== Peer Status ===" -ForegroundColor Cyan
docker logs peer0.amarvote.com --tail 20

# Check CLI
Write-Host "`n=== CLI Status (Chaincode Deployment) ===" -ForegroundColor Cyan
docker logs cli --tail 30

# Check blockchain-api
Write-Host "`n=== Blockchain API Status ===" -ForegroundColor Cyan
docker logs blockchain_api --tail 20

# Show all running containers
Write-Host "`n=== Running Containers ===" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`n✓ Services started! Check above for any errors." -ForegroundColor Green
Write-Host "`nFrontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend: http://localhost:8080" -ForegroundColor Yellow
Write-Host "Blockchain API: http://localhost:3000" -ForegroundColor Yellow
Write-Host "CouchDB: http://localhost:5984 (admin/adminpw)" -ForegroundColor Yellow
