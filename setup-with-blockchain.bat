@echo off
REM AmarVote Complete Setup Script with Blockchain

echo ==========================================
echo AmarVote Setup with Blockchain Support
echo ==========================================
echo.

REM Check if Docker is running
docker --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌ Docker is not running or not installed
  echo Please start Docker Desktop and try again
  pause
  exit /b 1
)

echo ✅ Docker is running
echo.

echo Step 1: Setting up blockchain network...
cd blockchain-network
call scripts\setup-blockchain.bat
if %errorlevel% neq 0 (
  echo ❌ Failed to setup blockchain network
  pause
  exit /b 1
)
cd ..
echo.

echo Step 2: Building and starting all services...
docker-compose down
docker-compose build --no-cache
docker-compose up -d

if %errorlevel% neq 0 (
  echo ❌ Failed to start services
  pause
  exit /b 1
)

echo.
echo ==========================================
echo ✅ AmarVote with Blockchain is ready!
echo ==========================================
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8080
echo ElectionGuard: http://localhost:8001
echo RAG Service: http://localhost:8000
echo.
echo Blockchain Services:
echo - Orderer: orderer.amarvote.com:7050
echo - Peer0: peer0.org1.amarvote.com:7051
echo - Peer1: peer1.org1.amarvote.com:8051
echo - Gateway: localhost:3001
echo.
echo Run 'docker ps' to see all running containers
echo.
pause
