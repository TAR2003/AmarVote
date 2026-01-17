#!/bin/bash
# Shell script to apply api_logs table migration to the database
# Usage: ./migrate-api-logs.sh

echo "========================================"
echo "AmarVote API Logs Migration Script"
echo "========================================"
echo ""

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Database connection details from .env or use defaults
DB_HOST="${NEON_HOST}"
DB_PORT="${NEON_PORT}"
DB_NAME="${NEON_DATABASE}"
DB_USER="${NEON_USERNAME}"
DB_PASSWORD="${NEON_PASSWORD}"

echo "Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT"
echo ""

# Run the migration
PGPASSWORD="$DB_PASSWORD" psql "postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=require" -f Database/migrate-api-logs.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "Migration completed successfully!"
    echo "========================================"
else
    echo ""
    echo "========================================"
    echo "Migration failed! Please check the errors above."
    echo "========================================"
    exit 1
fi
