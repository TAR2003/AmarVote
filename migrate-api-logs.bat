@echo off
REM Batch script to apply api_logs table migration to the database
REM Usage: migrate-api-logs.bat

echo ========================================
echo AmarVote API Logs Migration Script
echo ========================================
echo.

REM Load environment variables from .env file if it exists
if exist .env (
    echo Loading environment variables from .env file...
    for /f "tokens=1,* delims==" %%a in ('type .env ^| findstr /v "^#"') do (
        set "%%a=%%b"
    )
)

REM Database connection details from .env or use defaults
set "DB_HOST=%NEON_HOST%"
set "DB_PORT=%NEON_PORT%"
set "DB_NAME=%NEON_DATABASE%"
set "DB_USER=%NEON_USERNAME%"
set "DB_PASSWORD=%NEON_PASSWORD%"

echo Connecting to database: %DB_NAME% on %DB_HOST%:%DB_PORT%
echo.

REM Run the migration
psql "postgresql://%DB_USER%:%DB_PASSWORD%@%DB_HOST%:%DB_PORT%/%DB_NAME%?sslmode=require" -f Database/migrate-api-logs.sql

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Migration completed successfully!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Migration failed! Please check the errors above.
    echo ========================================
)

pause
