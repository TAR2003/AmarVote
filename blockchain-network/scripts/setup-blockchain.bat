@echo off
REM Complete blockchain network setup script

echo Setting up AmarVote Blockchain Network...
echo.

REM Navigate to blockchain-network directory
cd /d "%~dp0\.."

echo Step 1: Generating cryptographic material...
call scripts\generate-crypto.bat
if %errorlevel% neq 0 (
  echo Failed to generate crypto material
  exit /b 1
)
echo.

echo Step 2: Generating genesis block and channel artifacts...
call scripts\generate-artifacts.bat
if %errorlevel% neq 0 (
  echo Failed to generate artifacts
  exit /b 1
)
echo.

echo Step 3: Starting blockchain network...
docker-compose up -d
if %errorlevel% neq 0 (
  echo Failed to start blockchain network
  exit /b 1
)
echo.

echo ✅ Blockchain network setup complete!
echo.
echo You can now start the main application with blockchain support.
echo.
pause
