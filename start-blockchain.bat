@echo off
REM AmarVote Blockchain Network Startup Script for Windows
REM This script starts the complete Hyperledger Fabric network for AmarVote

setlocal enabledelayedexpansion

echo 🚀 Starting AmarVote Blockchain Network...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not installed. Please install Docker Compose and try again.
    pause
    exit /b 1
)

REM Navigate to blockchain network directory
set SCRIPT_DIR=%~dp0
set BLOCKCHAIN_DIR=%SCRIPT_DIR%blockchain-network

if not exist "%BLOCKCHAIN_DIR%" (
    echo [ERROR] Blockchain network directory not found: %BLOCKCHAIN_DIR%
    pause
    exit /b 1
)

cd /d "%BLOCKCHAIN_DIR%"

echo [INFO] Cleaning up any existing containers and networks...

REM Stop and remove existing containers
docker-compose down -v --remove-orphans >nul 2>&1

REM Remove any orphaned containers
docker container prune -f >nul 2>&1

REM Remove any unused networks
docker network prune -f >nul 2>&1

echo [INFO] Starting Hyperledger Fabric network...

REM Start the network
docker-compose up -d

REM Wait for containers to be ready
echo [INFO] Waiting for containers to be ready...
timeout /t 10 >nul

REM Check if containers are running
set CONTAINERS=peer0.org1.amarvote.com orderer.amarvote.com ca.org1.amarvote.com

for %%c in (%CONTAINERS%) do (
    docker ps --format "table {{.Names}}" | findstr "%%c" >nul
    if errorlevel 1 (
        echo [ERROR] %%c is not running
        docker logs %%c 2>nul
        pause
        exit /b 1
    ) else (
        echo [SUCCESS] %%c is running
    )
)

echo [INFO] Deploying ballot verification chaincode...

REM Deploy chaincode
if exist ".\scripts\deploy-chaincode.sh" (
    REM Use Git Bash if available for shell script
    if exist "C:\Program Files\Git\bin\bash.exe" (
        "C:\Program Files\Git\bin\bash.exe" -c "./scripts/deploy-chaincode.sh"
        if errorlevel 1 (
            echo [ERROR] Failed to deploy chaincode
            pause
            exit /b 1
        ) else (
            echo [SUCCESS] Chaincode deployed successfully
        )
    ) else (
        echo [WARNING] Git Bash not found. Please deploy chaincode manually.
    )
) else (
    echo [WARNING] Chaincode deployment script not found. Skipping chaincode deployment.
)

echo [INFO] Starting Node.js blockchain gateway...

REM Start the blockchain gateway
set GATEWAY_DIR=%SCRIPT_DIR%blockchain-gateway
if exist "%GATEWAY_DIR%" (
    cd /d "%GATEWAY_DIR%"
    
    REM Install dependencies if node_modules doesn't exist
    if not exist "node_modules" (
        echo [INFO] Installing Node.js dependencies...
        call npm install
    )
    
    REM Start the gateway
    echo [INFO] Starting blockchain gateway on port 3001...
    start /b npm start > gateway.log 2>&1
    
    REM Wait a bit for startup
    timeout /t 5 >nul
    
    REM Check if port 3001 is listening
    netstat -an | findstr ":3001" >nul
    if errorlevel 1 (
        echo [WARNING] Gateway may not have started properly - check gateway.log
    ) else (
        echo [SUCCESS] Blockchain gateway started on port 3001
    )
) else (
    echo [WARNING] Blockchain gateway directory not found: %GATEWAY_DIR%
)

REM Check network health
echo [INFO] Checking network health...

REM Test orderer connection
docker exec peer0.org1.amarvote.com peer channel list >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Peer cannot connect to orderer - check network configuration
) else (
    echo [SUCCESS] Peer can connect to orderer
)

REM Test chaincode if deployed
docker exec peer0.org1.amarvote.com peer chaincode query -C mychannel -n ballot-verification -c "{\"Args\":[\"GetAllBallots\"]}" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Chaincode is not responding - may need manual deployment
) else (
    echo [SUCCESS] Chaincode is responding
)

echo.
echo [SUCCESS] 🎉 AmarVote Blockchain Network is ready!
echo.
echo 📊 Network Status:
echo   - Fabric Network: Running on docker network
echo   - Orderer: orderer.amarvote.com:7050
echo   - Peer: peer0.org1.amarvote.com:7051
echo   - CA: ca.org1.amarvote.com:7054
echo   - Gateway API: http://localhost:3001
echo.
echo 🔧 Management Commands:
echo   - View logs: docker-compose logs -f
echo   - Stop network: docker-compose down
echo   - Restart: docker-compose restart
echo   - Stop all: taskkill /f /im node.exe (stops gateway)
echo.
echo 🔍 Health Check:
echo   - Network: curl http://localhost:3001/health
echo   - Containers: docker ps
echo.
echo [INFO] Ready for blockchain ballot verification! 🗳️
echo.
pause
