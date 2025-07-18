#!/bin/bash

# Startup script for RAG service

echo "Starting RAG Service initialization..."

# Check if documents exist
if [ -f "/app/data/EG_Spec_2_1.pdf" ]; then
    echo "✅ ElectionGuard PDF found at /app/data/EG_Spec_2_1.pdf"
else
    echo "❌ ElectionGuard PDF not found at /app/data/EG_Spec_2_1.pdf"
    echo "Please ensure the PDF is mounted correctly"
fi

if [ -f "/app/data/AmarVote_User_Guide.md" ]; then
    echo "✅ AmarVote User Guide found at /app/data/AmarVote_User_Guide.md"
else
    echo "❌ AmarVote User Guide not found at /app/data/AmarVote_User_Guide.md"
    echo "Please ensure the Markdown file is mounted correctly"
fi

# Create necessary directories
mkdir -p /app/vectorstore
mkdir -p /app/data

echo "📁 Directories created"

# Start the application
echo "🚀 Starting RAG Service..."
python app.py
