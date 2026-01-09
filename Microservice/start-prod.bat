@echo off
REM Production startup script for ElectionGuard Microservice using Gunicorn (Windows)
REM This prevents hanging issues with concurrent chunk processing

echo Starting ElectionGuard Microservice with Gunicorn...
echo Configuration: Multi-worker, threaded, with automatic worker recycling

REM Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Set environment variables
set PYTHONUNBUFFERED=1
if not defined MASTER_KEY_PQ (
    echo WARNING: MASTER_KEY_PQ not set. Using random key ^(data will be lost on restart^)
)

REM Start Gunicorn with production configuration
gunicorn -c gunicorn_config.py api:app
