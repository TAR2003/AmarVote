#!/usr/bin/env pwsh
# Emergency fix script for 500 error on /api/all-elections
# This creates the missing worker log tables and restarts the backend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚨 EMERGENCY FIX FOR 500 ERROR" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create tables
Write-Host "Step 1: Creating missing worker log tables..." -ForegroundColor Yellow
Write-Host "Running SQL script..." -ForegroundColor Gray

# Prompt for database details
$dbName = Read-Host "Enter database name (default: amarvote)"
if ([string]::IsNullOrWhiteSpace($dbName)) {
    $dbName = "amarvote"
}

$dbUser = Read-Host "Enter database user (default: postgres)"
if ([string]::IsNullOrWhiteSpace($dbUser)) {
    $dbUser = "postgres"
}

Write-Host "Connecting to database: $dbName as user: $dbUser" -ForegroundColor Gray

# Run the SQL script
$scriptPath = Join-Path $PSScriptRoot "create_worker_tables_NOW.sql"

try {
    psql -U $dbUser -d $dbName -f $scriptPath
    Write-Host "✅ Tables created successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create tables: $_" -ForegroundColor Red
    Write-Host "Try running manually: psql -U $dbUser -d $dbName -f $scriptPath" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Restart backend..." -ForegroundColor Yellow

# Navigate to backend directory
$backendPath = Join-Path (Split-Path $PSScriptRoot -Parent) "backend"

if (Test-Path $backendPath) {
    Push-Location $backendPath
    
    Write-Host "Stopping backend..." -ForegroundColor Gray
    # Kill any running backend processes
    Get-Process -Name "java" -ErrorAction SilentlyContinue | 
        Where-Object { $_.Path -like "*maven*" -or $_.CommandLine -like "*spring-boot*" } | 
        Stop-Process -Force
    
    Start-Sleep -Seconds 2
    
    Write-Host "Starting backend..." -ForegroundColor Gray
    Start-Process -FilePath "mvnw.cmd" -ArgumentList "spring-boot:run" -NoNewWindow
    
    Pop-Location
    Write-Host "✅ Backend restarting..." -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend directory not found at: $backendPath" -ForegroundColor Yellow
    Write-Host "Please restart backend manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ FIX COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Wait 30-60 seconds for backend to start, then:" -ForegroundColor Yellow
Write-Host "1. Refresh your frontend" -ForegroundColor White
Write-Host "2. Check if /api/all-elections works" -ForegroundColor White
Write-Host "3. Worker Proceedings feature is now ready" -ForegroundColor White
Write-Host ""
