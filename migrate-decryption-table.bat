@echo off
REM Migration script for decryption_status table - Windows version
REM This script creates the decryption_status table for tracking guardian decryption progress

echo ========================================
echo Decryption Status Table Migration
echo ========================================
echo.
echo This script will create the decryption_status table in your MySQL database.
echo.

REM Prompt for database credentials
set /p DB_USER="Enter MySQL username (default: root): "
if "%DB_USER%"=="" set DB_USER=root

set /p DB_NAME="Enter database name (default: amarvote): "
if "%DB_NAME%"=="" set DB_NAME=amarvote

echo.
echo Connecting to database: %DB_NAME% as user: %DB_USER%
echo.
echo You will be prompted for your MySQL password...
echo.

REM Execute the SQL script
mysql -u %DB_USER% -p %DB_NAME% < Database\decryption_status_table.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Migration completed successfully!
    echo ========================================
    echo.
    echo The decryption_status table has been created.
    echo You can now restart your backend application.
    echo.
) else (
    echo.
    echo ========================================
    echo Migration failed!
    echo ========================================
    echo.
    echo Please check the error messages above.
    echo Make sure:
    echo   1. MySQL is running
    echo   2. Database credentials are correct
    echo   3. Database '%DB_NAME%' exists
    echo   4. You have proper permissions
    echo.
)

pause
