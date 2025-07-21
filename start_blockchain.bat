@echo off
setlocal enabledelayedexpansion

echo 🗳️  Starting Blockchain-Backed Ballot System
echo ==============================================

REM Function to print status messages
:print_status
echo [INFO] %~1
goto :eof

:print_success
echo [SUCCESS] %~1
goto :eof

:print_error
echo [ERROR] %~1
goto :eof

:print_warning
echo [WARNING] %~1
goto :eof

REM Check if Docker is running
call :print_status "Checking prerequisites..."
docker info >nul 2>&1
if errorlevel 1 (
    call :print_error "Docker is not running. Please start Docker and try again."
    pause
    exit /b 1
)

REM Check if docker-compose is available
docker-compose version >nul 2>&1
if errorlevel 1 (
    call :print_error "Docker Compose is not available. Please install it and try again."
    pause
    exit /b 1
)

call :print_success "Prerequisites check passed!"

REM Stop any existing services
call :print_status "Stopping any existing services..."
docker-compose down --remove-orphans >nul 2>&1

REM Start the services
call :print_status "Starting blockchain services..."
docker-compose up -d hardhat blockchain-microservice
if errorlevel 1 (
    call :print_error "Failed to start services."
    pause
    exit /b 1
)

call :print_success "Services started successfully!"

REM Wait for services to be ready
call :print_status "Waiting for services to be ready (this may take up to 2 minutes)..."

REM Wait for Hardhat
set /a attempts=0
set /a max_attempts=24
:wait_hardhat
set /a attempts+=1
curl -f -s http://localhost:8545 >nul 2>&1
if not errorlevel 1 (
    call :print_success "Hardhat Node is healthy!"
    goto :hardhat_ready
)
if !attempts! geq !max_attempts! (
    call :print_error "Hardhat node failed to start properly."
    docker-compose logs hardhat
    pause
    exit /b 1
)
call :print_status "Attempt !attempts!/!max_attempts! - Hardhat not ready yet..."
timeout /t 10 /nobreak >nul
goto :wait_hardhat

:hardhat_ready
REM Wait for contract deployment
call :print_status "Waiting for smart contract deployment..."
set /a attempts=0
set /a max_attempts=30
:wait_contract
set /a attempts+=1
if exist "blockchain-microservice\BallotContract.json" (
    call :print_success "Smart contract deployed successfully!"
    goto :contract_ready
)
if !attempts! geq !max_attempts! (
    call :print_error "Smart contract deployment failed."
    docker-compose logs hardhat
    pause
    exit /b 1
)
call :print_status "Attempt !attempts!/!max_attempts! - Waiting for contract deployment..."
timeout /t 10 /nobreak >nul
goto :wait_contract

:contract_ready
REM Wait for API
call :print_status "Waiting for Blockchain API..."
set /a attempts=0
set /a max_attempts=12
:wait_api
set /a attempts+=1
curl -f -s http://localhost:5002/health >nul 2>&1
if not errorlevel 1 (
    call :print_success "Blockchain API is healthy!"
    goto :api_ready
)
if !attempts! geq !max_attempts! (
    call :print_error "Blockchain API failed to start properly."
    docker-compose logs blockchain-microservice
    pause
    exit /b 1
)
call :print_status "Attempt !attempts!/!max_attempts! - API not ready yet..."
timeout /t 10 /nobreak >nul
goto :wait_api

:api_ready
call :print_success "All services are healthy and ready!"

REM Run tests if Python is available
call :print_status "Checking for Python to run tests..."
python --version >nul 2>&1
if not errorlevel 1 (
    call :print_status "Running comprehensive API tests..."
    python test_blockchain_api.py
    if not errorlevel 1 (
        call :print_success "All tests passed! 🎉"
    ) else (
        call :print_warning "Some tests failed. Check the output above."
    )
) else (
    call :print_warning "Python not found. Skipping automated tests."
)

REM Display service information
echo.
echo 🌐 Service Information
echo =====================
echo 📡 Blockchain Node (Hardhat):     http://localhost:8545
echo 🔗 Blockchain API:                http://localhost:5002
echo 🏥 Health Check:                  http://localhost:5002/health
echo 📚 API Documentation:             http://localhost:5002/docs
echo.
echo 💡 Quick Commands:
echo    Check API health:              curl http://localhost:5002/health
echo    View election details:         curl http://localhost:5002/election/test_election_2024
echo    Run tests:                     python test_blockchain_api.py
echo    View logs:                     docker-compose logs -f
echo    Stop services:                 docker-compose down
echo.

REM Show example API calls
echo 📋 Example API Calls
echo ====================
echo.
echo 1. Record a ballot:
echo curl -X POST "http://localhost:5002/record-ballot" ^
echo      -H "Content-Type: application/json" ^
echo      -d "{\"election_id\":\"test_election_2024\",\"tracking_code\":\"VOTE_001\",\"ballot_data\":\"Candidate A: YES, Candidate B: NO\",\"voter_signature\":\"demo_signature\"}"
echo.
echo 2. Verify a ballot:
echo curl -X POST "http://localhost:5002/verify-ballot" ^
echo      -H "Content-Type: application/json" ^
echo      -d "{\"election_id\":\"test_election_2024\",\"tracking_code\":\"VOTE_001\",\"ballot_data\":\"Candidate A: YES, Candidate B: NO\"}"
echo.

call :print_success "🎉 Blockchain-Backed Ballot System is fully operational!"
call :print_status "System is ready for ballot recording and verification."
call :print_status "Press any key to stop all services..."

pause >nul

REM Cleanup
call :print_status "Shutting down services..."
docker-compose down
call :print_success "Services stopped."
pause
