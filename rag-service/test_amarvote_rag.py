#!/usr/bin/env python3
"""
Test script for AmarVote RAG system with both ElectionGuard and AmarVote documents
"""

import requests
import json
import time

# RAG service configuration
RAG_SERVICE_URL = "http://localhost:5001"

def test_rag_health():
    """Test RAG service health"""
    try:
        response = requests.get(f"{RAG_SERVICE_URL}/health")
        print(f"Health check: {response.status_code} - {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_document_list():
    """Test listing available documents"""
    try:
        response = requests.get(f"{RAG_SERVICE_URL}/documents")
        if response.status_code == 200:
            docs = response.json()
            print("Available documents:")
            for doc in docs.get('available_documents', []):
                print(f"  - {doc['type']}: {doc['description']}")
                print(f"    Topics: {', '.join(doc['topics'])}")
        else:
            print(f"Document list failed: {response.status_code}")
    except Exception as e:
        print(f"Document list failed: {e}")

def test_query(query, document_type=None):
    """Test a specific query"""
    print(f"\n🔍 Testing query: '{query}'")
    if document_type:
        print(f"   Document type filter: {document_type}")
    
    try:
        payload = {
            "query": query,
            "max_length": 1000
        }
        if document_type:
            payload["document_type"] = document_type
            
        response = requests.post(f"{RAG_SERVICE_URL}/context", json=payload)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success! Context length: {len(result['context'])} characters")
            print(f"Context preview: {result['context'][:200]}...")
        else:
            print(f"❌ Query failed: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Query failed: {e}")

def run_tests():
    """Run comprehensive RAG tests"""
    print("🚀 Starting AmarVote RAG System Tests")
    print("=" * 50)
    
    # Test 1: Health check
    print("\n1. Health Check")
    if not test_rag_health():
        print("❌ RAG service is not available. Exiting.")
        return
    
    # Test 2: Document listing
    print("\n2. Document List")
    test_document_list()
    
    # Wait a moment for initialization
    print("\n⏳ Waiting for system initialization...")
    time.sleep(2)
    
    # Test 3: ElectionGuard queries
    print("\n3. ElectionGuard Technical Queries")
    electionguard_queries = [
        "What is homomorphic encryption in ElectionGuard?",
        "How do guardians work in ElectionGuard?",
        "What are zero knowledge proofs?",
        "How does ballot encryption work?"
    ]
    
    for query in electionguard_queries:
        test_query(query, "ElectionGuard_Specification")
    
    # Test 4: AmarVote platform queries
    print("\n4. AmarVote Platform Usage Queries")
    amarvote_queries = [
        "How do I create an election in AmarVote?",
        "How do I vote in an election?",
        "How do I verify my vote?",
        "How do I see election results?",
        "How do I register for an account?"
    ]
    
    for query in amarvote_queries:
        test_query(query, "AmarVote_User_Guide")
    
    # Test 5: General queries (no filter)
    print("\n5. General Queries (No Filter)")
    general_queries = [
        "What is end-to-end verifiable voting?",
        "How secure is the voting process?",
        "What are the steps to participate in an election?"
    ]
    
    for query in general_queries:
        test_query(query)
    
    print("\n🎉 Test suite completed!")
    print("Check the results above to verify both document types are working correctly.")

if __name__ == "__main__":
    run_tests()
