@echo off
REM Tally Creation Table Migration Script for Windows
REM This script creates the tally_creation_status table in the AmarVote database

echo ===========================================
echo AmarVote - Tally Creation Table Migration
echo ===========================================
echo.

REM Database configuration
set DB_NAME=amarvote
set DB_USER=root
set DB_HOST=localhost
set DB_PORT=3306

echo This will create the 'tally_creation_status' table in the %DB_NAME% database.
echo.
set /p confirm=Do you want to continue? (y/n): 

if /i not "%confirm%"=="y" (
    echo Migration cancelled.
    exit /b 0
)

echo.
echo Creating table...
echo.

REM Execute SQL using mysql command
mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p %DB_NAME% < "%~dp0Database\tally_creation_status_table.sql"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Table created successfully!
    echo.
    echo You can now:
    echo 1. Restart your backend application
    echo 2. Test the tally creation feature
    echo.
) else (
    echo.
    echo ❌ Error creating table. Please check the error messages above.
    echo.
    exit /b 1
)

pause
