@echo off
REM AmarVote Production Deployment with Blockchain for Windows
REM This script deploys the complete AmarVote stack including Hyperledger Fabric blockchain

setlocal enabledelayedexpansion

echo 🚀 Starting AmarVote Production Deployment with Blockchain...

REM Check prerequisites
echo [INFO] Checking prerequisites...

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

REM Check if environment file exists
if not exist ".env" (
    echo [WARNING] .env file not found. Creating template...
    (
        echo # Database Configuration ^(Required^)
        echo NEON_HOST=your-neon-host
        echo NEON_PORT=5432
        echo NEON_DATABASE=your-database
        echo NEON_USERNAME=your-username
        echo NEON_PASSWORD=your-password
        echo.
        echo # Security Configuration
        echo MASTER_KEY_PQ=your-master-key
        echo.
        echo # Optional: SSL Configuration
        echo SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
        echo SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
    ) > .env
    echo [ERROR] Please configure the .env file with your database credentials and run again.
    pause
    exit /b 1
)

echo [SUCCESS] Environment validated successfully

REM Clean up any existing containers
echo [INFO] Cleaning up existing containers...
docker-compose -f docker-compose.prod.yml down -v --remove-orphans >nul 2>&1

REM Remove orphaned containers and networks
docker container prune -f >nul 2>&1
docker network prune -f >nul 2>&1

echo [INFO] Building and starting services...

REM Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

echo [INFO] Waiting for services to be ready...

REM Wait for services to start
timeout /t 30 >nul

REM Check service health
echo [INFO] Checking service health...

set CONTAINERS=orderer.amarvote.com peer0.org1.amarvote.com peer1.org1.amarvote.com blockchain_gateway amarvote_backend amarvote_frontend electionguard_service rag_service

set ALL_HEALTHY=true

for %%c in (%CONTAINERS%) do (
    docker ps --format "table {{.Names}}" | findstr "%%c" >nul
    if errorlevel 1 (
        echo [ERROR] %%c is not running
        set ALL_HEALTHY=false
    ) else (
        echo [SUCCESS] %%c is running
    )
)

REM Test blockchain connectivity
echo [INFO] Testing blockchain connectivity...

REM Wait a bit more for blockchain to be ready
timeout /t 20 >nul

REM Test blockchain gateway health
curl -s --max-time 10 http://localhost:3001/health | findstr "healthy" >nul
if errorlevel 1 (
    echo [WARNING] Blockchain gateway health check failed - may still be starting
) else (
    echo [SUCCESS] Blockchain gateway is healthy
)

REM Test chaincode (if available)
docker exec peer0.org1.amarvote.com peer chaincode query -C mychannel -n ballot-verification -c "{\"Args\":[\"GetAllBallots\"]}" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Chaincode not ready - will be deployed automatically on first use
) else (
    echo [SUCCESS] Chaincode is responding
)

REM Test application endpoints
echo [INFO] Testing application endpoints...

REM Test backend health
curl -s --max-time 10 http://localhost:8080/actuator/health | findstr "UP" >nul
if errorlevel 1 (
    echo [WARNING] Backend health check failed - may still be starting
) else (
    echo [SUCCESS] Backend is healthy
)

REM Test frontend
curl -s --max-time 10 http://localhost:80 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Frontend not yet responding - may still be starting
) else (
    echo [SUCCESS] Frontend is responding
)

if "%ALL_HEALTHY%"=="true" (
    echo [SUCCESS] 🎉 AmarVote Production Deployment Complete!
) else (
    echo [WARNING] ⚠️ Some services may still be starting. Check logs if issues persist.
)

echo.
echo 📊 Production Deployment Status:
echo   🌐 Frontend: http://localhost (HTTP) / https://localhost (HTTPS)
echo   🔧 Backend API: http://localhost:8080
echo   🛡️ ElectionGuard: http://localhost:5000
echo   🤖 RAG Service: http://localhost:5001
echo   ⛓️ Blockchain Gateway: http://localhost:3001
echo   📦 Fabric Orderer: localhost:7050
echo   🔗 Fabric Peer0: localhost:7051
echo   🔗 Fabric Peer1: localhost:8051
echo.
echo 🔧 Management Commands:
echo   View logs: docker-compose -f docker-compose.prod.yml logs -f [service]
echo   Stop all: docker-compose -f docker-compose.prod.yml down
echo   Restart: docker-compose -f docker-compose.prod.yml restart [service]
echo   Scale: docker-compose -f docker-compose.prod.yml up -d --scale [service]=[number]
echo.
echo 🔍 Health Checks:
echo   Backend: curl http://localhost:8080/actuator/health
echo   Blockchain: curl http://localhost:3001/health
echo   Containers: docker ps
echo.
echo 📝 Logs:
echo   All services: docker-compose -f docker-compose.prod.yml logs -f
echo   Blockchain: docker-compose -f docker-compose.prod.yml logs -f blockchain-gateway
echo   Backend: docker-compose -f docker-compose.prod.yml logs -f backend
echo.
echo [INFO] 🗳️ AmarVote with Blockchain is ready for production! ⛓️

echo.
echo 🚀 Next Steps:
echo   1. Configure your domain DNS to point to this server
echo   2. Set up SSL certificates (Let's Encrypt recommended)
echo   3. Configure reverse proxy (IIS/Nginx recommended)
echo   4. Set up monitoring and backup procedures
echo   5. Configure Windows Firewall rules for production
echo.
echo 📚 Documentation:
echo   - Blockchain: .\BLOCKCHAIN_IMPLEMENTATION.md
echo   - Complete Guide: .\BLOCKCHAIN_COMPLETE.md
echo   - Testing: .\test-blockchain.sh
echo.
pause
