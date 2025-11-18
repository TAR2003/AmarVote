# AmarVote Blockchain Network Setup Script (Windows PowerShell)
# This script automates the setup of the Hyperledger Fabric blockchain network

Write-Host "=========================================="  -ForegroundColor Cyan
Write-Host "AmarVote Blockchain Network Setup"  -ForegroundColor Cyan
Write-Host "=========================================="  -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    docker version | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Navigate to fabric-network directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$fabricNetworkPath = Join-Path $scriptPath "fabric-network"

if (-not (Test-Path $fabricNetworkPath)) {
    Write-Host "✗ fabric-network directory not found" -ForegroundColor Red
    exit 1
}

Set-Location $fabricNetworkPath
Write-Host "✓ Changed directory to fabric-network" -ForegroundColor Green

# Check for Fabric binaries
Write-Host ""
Write-Host "Checking for Fabric binaries..." -ForegroundColor Yellow

$binPath = Join-Path $fabricNetworkPath "bin"
$cryptogenPath = Join-Path $binPath "cryptogen.exe"
$configtxgenPath = Join-Path $binPath "configtxgen.exe"

if (-not (Test-Path $cryptogenPath) -or -not (Test-Path $configtxgenPath)) {
    Write-Host "Fabric binaries not found. Please download them manually from:" -ForegroundColor Yellow
    Write-Host "https://github.com/hyperledger/fabric/releases/download/v2.5.0/hyperledger-fabric-windows-amd64-2.5.0.tar.gz" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Extract to: $binPath" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Do you have the binaries ready? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

# Add bin to PATH for current session
$env:PATH = "$binPath;$env:PATH"

# Generate crypto materials
Write-Host ""
Write-Host "Generating cryptographic materials..." -ForegroundColor Yellow

if (Test-Path "crypto-config") {
    Write-Host "✓ Crypto materials already exist" -ForegroundColor Green
} else {
    try {
        & $cryptogenPath generate --config=.\config\crypto-config.yaml --output=crypto-config
        Write-Host "✓ Crypto materials generated" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to generate crypto materials" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
}

# Create channel-artifacts directory
Write-Host ""
Write-Host "Creating channel artifacts directory..." -ForegroundColor Yellow
if (-not (Test-Path "channel-artifacts")) {
    New-Item -ItemType Directory -Path "channel-artifacts" | Out-Null
    Write-Host "✓ Directory created" -ForegroundColor Green
} else {
    Write-Host "✓ Directory already exists" -ForegroundColor Green
}

# Generate genesis block
Write-Host ""
Write-Host "Generating genesis block..." -ForegroundColor Yellow
try {
    & $configtxgenPath -profile AmarVoteOrdererGenesis `
        -channelID system-channel `
        -outputBlock .\channel-artifacts\genesis.block `
        -configPath .\config

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Genesis block generated" -ForegroundColor Green
    } else {
        throw "configtxgen failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "✗ Failed to generate genesis block" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Generate channel configuration transaction
Write-Host ""
Write-Host "Generating channel configuration transaction..." -ForegroundColor Yellow
try {
    & $configtxgenPath -profile ElectionChannel `
        -outputCreateChannelTx .\channel-artifacts\electionchannel.tx `
        -channelID electionchannel `
        -configPath .\config

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Channel configuration transaction generated" -ForegroundColor Green
    } else {
        throw "configtxgen failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "✗ Failed to generate channel configuration transaction" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Generate anchor peer update
Write-Host ""
Write-Host "Generating anchor peer update..." -ForegroundColor Yellow
try {
    & $configtxgenPath -profile ElectionChannel `
        -outputAnchorPeersUpdate .\channel-artifacts\AmarVoteOrgMSPanchors.tx `
        -channelID electionchannel `
        -asOrg AmarVoteOrgMSP `
        -configPath .\config

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Anchor peer update generated" -ForegroundColor Green
    } else {
        throw "configtxgen failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "✗ Failed to generate anchor peer update" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================="  -ForegroundColor Cyan
Write-Host "Network artifacts generated successfully!"  -ForegroundColor Green
Write-Host "=========================================="  -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start the network: docker-compose up --build" -ForegroundColor White
Write-Host "2. In another terminal, run:" -ForegroundColor White
Write-Host "   docker exec -it cli bash" -ForegroundColor White
Write-Host "   cd scripts" -ForegroundColor White
Write-Host "   ./setup-network.sh" -ForegroundColor White
Write-Host ""

# Ask if user wants to start docker-compose
$startDocker = Read-Host "Do you want to start the Docker containers now? (y/n)"
if ($startDocker -eq "y") {
    Write-Host ""
    Write-Host "Starting Docker containers..." -ForegroundColor Yellow
    Set-Location ..
    docker-compose up --build -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Containers started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Waiting 15 seconds for containers to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
        
        Write-Host ""
        Write-Host "Setting up blockchain network..." -ForegroundColor Yellow
        docker exec cli bash -c "cd /opt/gopath/src/github.com/hyperledger/fabric/peer/scripts && ./setup-network.sh"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "=========================================="  -ForegroundColor Cyan
            Write-Host "✓ Blockchain network is ready!" -ForegroundColor Green
            Write-Host "=========================================="  -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Access points:" -ForegroundColor Yellow
            Write-Host "  Frontend:        http://localhost:5173" -ForegroundColor White
            Write-Host "  Backend:         http://localhost:8080" -ForegroundColor White
            Write-Host "  Blockchain API:  http://localhost:3000" -ForegroundColor White
            Write-Host "  CouchDB:         http://localhost:5984/_utils" -ForegroundColor White
            Write-Host "                   (admin/adminpw)" -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "✗ Failed to setup blockchain network" -ForegroundColor Red
            Write-Host "You can try running the setup manually:" -ForegroundColor Yellow
            Write-Host "  docker exec -it cli bash" -ForegroundColor White
            Write-Host "  cd scripts" -ForegroundColor White
            Write-Host "  ./setup-network.sh" -ForegroundColor White
        }
    } else {
        Write-Host "✗ Failed to start containers" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Setup script completed!" -ForegroundColor Cyan
