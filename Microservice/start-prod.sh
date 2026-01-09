#!/bin/bash
# Production startup script for ElectionGuard Microservice using Gunicorn
# This prevents hanging issues with concurrent chunk processing

echo "Starting ElectionGuard Microservice with Gunicorn..."
echo "Configuration: Multi-worker, threaded, with automatic worker recycling"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Set environment variables
export PYTHONUNBUFFERED=1
export MASTER_KEY_PQ="${MASTER_KEY_PQ:-$(openssl rand -base64 32)}"

# Start Gunicorn with production configuration
gunicorn -c gunicorn_config.py api:app
