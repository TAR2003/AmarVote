#!/bin/bash

# Blockchain-Backed Ballot System Startup Script
# This script ensures all services start correctly and in the right order

set -e  # Exit on any error

echo "🗳️  Starting Blockchain-Backed Ballot System"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a service is healthy
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=$3
    local attempt=1

    print_status "Checking health of $service_name..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            print_success "$service_name is healthy!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to wait for blockchain deployment
wait_for_blockchain_deployment() {
    print_status "Waiting for blockchain deployment..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if [ -f "./blockchain-microservice/BallotContract.json" ]; then
            print_success "Smart contract deployed successfully!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - Waiting for contract deployment..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    print_error "Smart contract deployment failed after $max_attempts attempts"
    return 1
}

# Function to run tests
run_tests() {
    print_status "Running comprehensive API tests..."
    
    if command -v python3 &> /dev/null; then
        PYTHON=python3
    elif command -v python &> /dev/null; then
        PYTHON=python
    else
        print_warning "Python not found. Skipping automated tests."
        return 0
    fi

    # Install requests if not available
    $PYTHON -c "import requests" 2>/dev/null || {
        print_status "Installing requests module..."
        $PYTHON -m pip install requests --quiet
    }
    
    if $PYTHON test_blockchain_api.py; then
        print_success "All tests passed! 🎉"
        return 0
    else
        print_warning "Some tests failed. Check the output above."
        return 1
    fi
}

# Function to display service URLs
display_service_info() {
    echo ""
    echo "🌐 Service Information"
    echo "====================="
    echo "📡 Blockchain Node (Hardhat):     http://localhost:8545"
    echo "🔗 Blockchain API:                http://localhost:5002"
    echo "🏥 Health Check:                  http://localhost:5002/health"
    echo "📚 API Documentation:             http://localhost:5002/docs"
    echo ""
    echo "💡 Quick Commands:"
    echo "   Check API health:              curl http://localhost:5002/health"
    echo "   View election details:         curl http://localhost:5002/election/test_election_2024"
    echo "   Run tests:                     python test_blockchain_api.py"
    echo "   View logs:                     docker-compose logs -f"
    echo "   Stop services:                 docker-compose down"
    echo ""
}

# Function to show example API calls
show_examples() {
    echo "📋 Example API Calls"
    echo "===================="
    echo ""
    echo "1. Record a ballot:"
    echo 'curl -X POST "http://localhost:5002/record-ballot" \'
    echo '     -H "Content-Type: application/json" \'
    echo '     -d '"'"'{
       "election_id": "test_election_2024",
       "tracking_code": "VOTE_001",
       "ballot_data": "Candidate A: YES, Candidate B: NO",
       "voter_signature": "demo_signature"
     }'"'"''
    echo ""
    echo "2. Verify a ballot:"
    echo 'curl -X POST "http://localhost:5002/verify-ballot" \'
    echo '     -H "Content-Type: application/json" \'
    echo '     -d '"'"'{
       "election_id": "test_election_2024",
       "tracking_code": "VOTE_001",
       "ballot_data": "Candidate A: YES, Candidate B: NO"
     }'"'"''
    echo ""
}

# Main execution flow
main() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
        print_error "Docker Compose is not available. Please install it and try again."
        exit 1
    fi
    
    print_success "Prerequisites check passed!"
    
    # Stop any existing services
    print_status "Stopping any existing services..."
    docker-compose down --remove-orphans > /dev/null 2>&1 || true
    
    # Start the services
    print_status "Starting blockchain services..."
    if docker-compose up -d hardhat blockchain-microservice; then
        print_success "Services started successfully!"
    else
        print_error "Failed to start services."
        exit 1
    fi
    
    # Wait for Hardhat to be healthy
    if ! check_service_health "Hardhat Node" "http://localhost:8545" 12; then
        print_error "Hardhat node failed to start properly."
        docker-compose logs hardhat
        exit 1
    fi
    
    # Wait for contract deployment
    if ! wait_for_blockchain_deployment; then
        print_error "Smart contract deployment failed."
        docker-compose logs hardhat
        exit 1
    fi
    
    # Wait for API to be healthy
    if ! check_service_health "Blockchain API" "http://localhost:5002/health" 12; then
        print_error "Blockchain API failed to start properly."
        docker-compose logs blockchain-microservice
        exit 1
    fi
    
    print_success "All services are healthy and ready!"
    
    # Run tests
    run_tests
    
    # Display service information
    display_service_info
    
    # Show examples
    show_examples
    
    print_success "🎉 Blockchain-Backed Ballot System is fully operational!"
    print_status "System is ready for ballot recording and verification."
    print_status "Press Ctrl+C to stop all services."
    
    # Keep the script running and show logs
    echo ""
    print_status "Showing live logs (Ctrl+C to stop)..."
    docker-compose logs -f
}

# Trap Ctrl+C to gracefully shutdown
trap 'echo -e "\n${YELLOW}[INFO]${NC} Shutting down services..."; docker-compose down; exit 0' INT

# Run main function
main "$@"
