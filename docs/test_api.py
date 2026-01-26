#!/usr/bin/env python3
"""
Test script for the Blockchain Voting API
Run this script to test the API functionality after starting the system.
"""

import requests
import json
import time
import sys
import hashlib
from datetime import datetime

API_BASE_URL = "http://localhost:5000"

def test_health():
    """Test the health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{API_BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {str(e)}")
        return False

def test_record_ballot():
    """Test recording a ballot"""
    print("📝 Testing ballot recording...")
    
    # Generate test data
    election_id = "test-election-2024"
    tracking_code = f"TRK{int(time.time())}"
    ballot_data = f"vote-{datetime.now().isoformat()}-{tracking_code}"
    ballot_hash = hashlib.sha256(ballot_data.encode()).hexdigest()
    
    payload = {
        "election_id": election_id,
        "tracking_code": tracking_code,
        "ballot_hash": ballot_hash
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/record-ballot",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        if response.status_code == 201:
            data = response.json()
            print(f"✅ Ballot recorded successfully: {data}")
            return payload, True
        else:
            print(f"❌ Failed to record ballot: {response.status_code} - {response.text}")
            return payload, False
            
    except Exception as e:
        print(f"❌ Record ballot error: {str(e)}")
        return payload, False

def test_verify_ballot(ballot_data):
    """Test ballot verification"""
    print("🔍 Testing ballot verification...")
    
    params = {
        "election_id": ballot_data["election_id"],
        "tracking_code": ballot_data["tracking_code"],
        "ballot_hash": ballot_data["ballot_hash"]
    }
    
    try:
        response = requests.get(f"{API_BASE_URL}/verify-ballot", params=params)
        
        if response.status_code == 200:
            data = response.json()
            result = data.get("result", {})
            if result.get("exists"):
                print(f"✅ Ballot verification successful: {data}")
                return True
            else:
                print(f"❌ Ballot not found during verification: {data}")
                return False
        else:
            print(f"❌ Failed to verify ballot: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Verify ballot error: {str(e)}")
        return False

def test_get_ballot_info(tracking_code):
    """Test getting ballot info by tracking code"""
    print("📋 Testing ballot info retrieval...")
    
    try:
        response = requests.get(f"{API_BASE_URL}/ballot/{tracking_code}")
        
        if response.status_code == 200:
            data = response.json()
            result = data.get("result", {})
            if result.get("exists"):
                print(f"✅ Ballot info retrieved successfully: {data}")
                return True
            else:
                print(f"❌ Ballot info not found: {data}")
                return False
        else:
            print(f"❌ Failed to get ballot info: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Get ballot info error: {str(e)}")
        return False

def test_invalid_verification():
    """Test verification with invalid data"""
    print("🚫 Testing invalid ballot verification...")
    
    params = {
        "election_id": "non-existent-election",
        "tracking_code": "INVALID123",
        "ballot_hash": "invalidhash"
    }
    
    try:
        response = requests.get(f"{API_BASE_URL}/verify-ballot", params=params)
        
        if response.status_code == 200:
            data = response.json()
            result = data.get("result", {})
            if not result.get("exists"):
                print(f"✅ Invalid ballot correctly returned as not found: {data}")
                return True
            else:
                print(f"❌ Invalid ballot incorrectly found: {data}")
                return False
        else:
            print(f"❌ Unexpected error for invalid verification: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Invalid verification error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Blockchain Voting API Tests")
    print("=" * 50)
    
    # Wait for system to be ready
    print("⏳ Waiting for system to be ready...")
    time.sleep(2)
    
    tests_passed = 0
    total_tests = 5
    
    # Test 1: Health check
    if test_health():
        tests_passed += 1
    print()
    
    # Test 2: Record ballot
    ballot_data, success = test_record_ballot()
    if success:
        tests_passed += 1
    print()
    
    # Test 3: Verify ballot
    if success and test_verify_ballot(ballot_data):
        tests_passed += 1
    print()
    
    # Test 4: Get ballot info
    if success and test_get_ballot_info(ballot_data["tracking_code"]):
        tests_passed += 1
    print()
    
    # Test 5: Invalid verification
    if test_invalid_verification():
        tests_passed += 1
    print()
    
    # Summary
    print("=" * 50)
    print(f"📊 Test Results: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed! The Blockchain Voting API is working correctly.")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Please check the system logs.")
        sys.exit(1)

if __name__ == "__main__":
    main()
