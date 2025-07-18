#!/usr/bin/env python3

import requests
import json
import time

# RAG Service URL
RAG_URL = "http://localhost:5001"

def test_health():
    """Test RAG service health endpoint"""
    try:
        response = requests.get(f"{RAG_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_context():
    """Test getting context for a sample query"""
    try:
        query = "What is ElectionGuard?"
        payload = {"query": query, "max_length": 1000}
        
        response = requests.post(f"{RAG_URL}/context", json=payload)
        if response.status_code == 200:
            result = response.json()
            print("✅ Context retrieval passed")
            print(f"Query: {result.get('query')}")
            print(f"Context length: {len(result.get('context', ''))}")
            print(f"Context preview: {result.get('context', '')[:200]}...")
            return True
        else:
            print(f"❌ Context retrieval failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Context retrieval error: {e}")
        return False

def test_search():
    """Test document search"""
    try:
        query = "ballot encryption"
        payload = {"query": query, "k": 3}
        
        response = requests.post(f"{RAG_URL}/search", json=payload)
        if response.status_code == 200:
            result = response.json()
            print("✅ Document search passed")
            print(f"Query: {result.get('query')}")
            print(f"Results count: {result.get('count')}")
            return True
        else:
            print(f"❌ Document search failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Document search error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing RAG Service...")
    print("=" * 50)
    
    # Wait a bit for service to start
    print("⏳ Waiting for service to start...")
    time.sleep(5)
    
    tests = [
        ("Health Check", test_health),
        ("Context Retrieval", test_context),
        ("Document Search", test_search)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔍 Running {test_name}...")
        if test_func():
            passed += 1
        time.sleep(1)
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    exit(main())
