@echo off
REM Generate genesis block and channel configuration using Docker

echo Generating genesis block and channel configuration...

REM Remove existing artifacts
if exist "artifacts\channel\genesis.block" del "artifacts\channel\genesis.block"
if exist "artifacts\channel\*.tx" del "artifacts\channel\*.tx"

REM Set FABRIC_CFG_PATH for configtxgen
set FABRIC_CFG_PATH=/config

REM Generate genesis block
docker run --rm ^
  -v "%cd%\configtx.yaml":/config/configtx.yaml ^
  -v "%cd%\artifacts":/artifacts ^
  -e FABRIC_CFG_PATH=%FABRIC_CFG_PATH% ^
  hyperledger/fabric-tools:2.4.7 ^
  configtxgen -profile OrdererGenesis -channelID system-channel -outputBlock /artifacts/channel/genesis.block

if %errorlevel% neq 0 (
  echo Failed to generate genesis block...
  exit /b 1
)

REM Generate channel configuration transaction
docker run --rm ^
  -v "%cd%\configtx.yaml":/config/configtx.yaml ^
  -v "%cd%\artifacts":/artifacts ^
  -e FABRIC_CFG_PATH=%FABRIC_CFG_PATH% ^
  hyperledger/fabric-tools:2.4.7 ^
  configtxgen -profile Channel -outputCreateChannelTx /artifacts/channel/amarvote-channel.tx -channelID amarvote-channel

if %errorlevel% neq 0 (
  echo Failed to generate channel configuration transaction...
  exit /b 1
)

REM Generate anchor peer transaction for Org1
docker run --rm ^
  -v "%cd%\configtx.yaml":/config/configtx.yaml ^
  -v "%cd%\artifacts":/artifacts ^
  -e FABRIC_CFG_PATH=%FABRIC_CFG_PATH% ^
  hyperledger/fabric-tools:2.4.7 ^
  configtxgen -profile Channel -outputAnchorPeersUpdate /artifacts/channel/Org1MSPanchors.tx -channelID amarvote-channel -asOrg Org1MSP

if %errorlevel% neq 0 (
  echo Failed to generate anchor peer update for Org1MSP...
  exit /b 1
)

echo ✅ Genesis block and channel configuration generated successfully
