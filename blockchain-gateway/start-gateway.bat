@echo off
echo 🚀 Starting AmarVote Blockchain Gateway Service...

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 14.0.0 or higher.
    pause
    exit /b 1
)

:: Check Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo 📦 Node.js version: %NODE_VERSION%

:: Navigate to gateway directory
cd /d "%~dp0"

:: Check if package.json exists
if not exist "package.json" (
    echo ❌ package.json not found. Please run this script from the blockchain-gateway directory.
    pause
    exit /b 1
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📥 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Check if Hyperledger Fabric network is running
echo 🔍 Checking Hyperledger Fabric network...
set FABRIC_NETWORK_PATH=..\blockchain-network

if not exist "%FABRIC_NETWORK_PATH%" (
    echo ⚠️  Fabric network directory not found at %FABRIC_NETWORK_PATH%
    echo    Please ensure the blockchain network is set up properly.
)

:: Check for wallet
set WALLET_PATH=..\blockchain-network\wallet
if not exist "%WALLET_PATH%" (
    echo ⚠️  Wallet directory not found at %WALLET_PATH%
    echo    Please ensure the Fabric wallet is properly configured.
)

:: Check for connection profile
set CONNECTION_PROFILE=..\blockchain-network\artifacts\channel\connection-profile.json
if not exist "%CONNECTION_PROFILE%" (
    echo ⚠️  Connection profile not found at %CONNECTION_PROFILE%
    echo    Please ensure the Fabric network configuration is complete.
)

:: Set environment variables
if "%NODE_ENV%"=="" set NODE_ENV=production
if "%PORT%"=="" set PORT=3001

echo 🌐 Environment: %NODE_ENV%
echo 🔌 Port: %PORT%

:: Start the gateway service
echo 🚀 Starting Blockchain Gateway Service...
echo    - Health check will be available at: http://localhost:%PORT%/health
echo    - API endpoints available at: http://localhost:%PORT%
echo.
echo Press Ctrl+C to stop the service
echo ==================================================

:: Start the server
npm start

pause
