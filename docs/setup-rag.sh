#!/bin/bash

# Setup and run AmarVote with RAG service

echo "🚀 Setting up AmarVote with RAG Service..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if the ElectionGuard PDF exists
PDF_PATH="./backend/src/main/resources/pdf/EG_Spec_2_1.pdf"
if [ ! -f "$PDF_PATH" ]; then
    echo "❌ ElectionGuard PDF not found at $PDF_PATH"
    echo "Please ensure the PDF is in the correct location."
    exit 1
fi

echo "✅ ElectionGuard PDF found"

# Build and start all services
echo "🔨 Building and starting services..."
docker-compose up --build -d

echo "⏳ Waiting for services to start..."
sleep 30

# Test RAG service
echo "🧪 Testing RAG service..."
if command -v python3 &> /dev/null; then
    cd rag-service && python3 test_rag.py
    cd ..
else
    echo "⚠️  Python3 not found. Skipping RAG service tests."
fi

# Show service status
echo "📋 Service Status:"
docker-compose ps

echo ""
echo "🌐 Services are running:"
echo "  • Frontend: http://localhost:5173"
echo "  • Backend: http://localhost:8080"
echo "  • ElectionGuard: http://localhost:5000"
echo "  • RAG Service: http://localhost:5001"
echo ""
echo "🤖 Chat endpoints:"
echo "  • ElectionGuard Chat: POST http://localhost:8080/api/chat/electionguard"
echo "  • General Chat: POST http://localhost:8080/api/chat/general"
echo "  • RAG Health: GET http://localhost:8080/api/rag/health"
echo ""
echo "✅ Setup complete!"
