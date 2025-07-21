@echo off
REM Generate cryptographic material for the network using Docker

echo Generating cryptographic material...

REM Remove existing crypto material
if exist "artifacts\channel\crypto-config" rmdir /s /q "artifacts\channel\crypto-config"
if not exist "artifacts\channel" mkdir "artifacts\channel"

REM Generate crypto material using cryptogen in Docker
docker run --rm ^
  -v "%cd%\crypto-config.yaml":/crypto-config.yaml ^
  -v "%cd%\artifacts":/artifacts ^
  hyperledger/fabric-tools:2.4.7 ^
  cryptogen generate --config=/crypto-config.yaml --output="/artifacts/channel/crypto-config"

if %errorlevel% neq 0 (
  echo Failed to generate crypto material...
  exit /b 1
)

echo ✅ Crypto material generated successfully
