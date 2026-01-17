#!/bin/bash

# This script starts the development environment with hot reloading

echo "Starting AmarVote development environment with hot reloading..."

# Build and start the Docker containers
echo "Building and starting containers..."
docker compose up -d

echo ""
echo "Development environment is up and running!"
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:8080"
echo ""
echo "Your code changes will be automatically reflected without rebuilding."
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
