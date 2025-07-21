#!/usr/bin/env python3
"""
Test script for the Blockchain Ballot API
Tests all endpoints and functionality
"""

import requests
import json
import time
from datetime import datetime, timedelta
import hashlib

# Configuration
BASE_URL = "http://localhost:5002"
ELECTION_ID = "test_election_2024"
TRACKING_CODE = "VOTE_001"
BALLOT_DATA = "Candidate A: YES, Candidate B: NO, Proposition 1: YES"


def test_health_check():
    """Test the health check endpoint"""
    print("Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Health Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Service Status: {data.get('status')}")
            print(f"Blockchain Connected: {data.get('blockchain_connected')}")
            return True
        return False
    except Exception as e:
        print(f"Health check failed: {e}")
        return False


def test_election_details():
    """Test getting election details"""
    print(f"\nTesting election details for {ELECTION_ID}...")
    try:
        response = requests.get(f"{BASE_URL}/election/{ELECTION_ID}")
        print(f"Election Details Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Election: {data}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Election details test failed: {e}")
        return False


def test_record_ballot():
    """Test recording a ballot"""
    print(f"\nTesting ballot recording...")
    try:
        payload = {
            "election_id": ELECTION_ID,
            "tracking_code": TRACKING_CODE,
            "ballot_data": BALLOT_DATA,
            "voter_signature": "dummy_signature"  # In demo mode
        }

        response = requests.post(f"{BASE_URL}/record-ballot", json=payload)
        print(f"Record Ballot Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Transaction Hash: {data.get('transaction_hash')}")
            print(f"Timestamp: {data.get('timestamp')}")
            print(f"Ballot Commitment: {data.get('ballot_commitment')}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Record ballot test failed: {e}")
        return False


def test_verify_ballot():
    """Test verifying a ballot"""
    print(f"\nTesting ballot verification...")
    try:
        payload = {
            "election_id": ELECTION_ID,
            "tracking_code": TRACKING_CODE,
            "ballot_data": BALLOT_DATA
        }

        response = requests.post(f"{BASE_URL}/verify-ballot", json=payload)
        print(f"Verify Ballot Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Ballot Exists: {data.get('exists')}")
            if data.get('exists'):
                print(f"Timestamp: {data.get('timestamp')}")
                print(f"Voter Address: {data.get('voter_address')}")
            print(f"Message: {data.get('message')}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Verify ballot test failed: {e}")
        return False


def test_verify_nonexistent_ballot():
    """Test verifying a ballot that doesn't exist"""
    print(f"\nTesting verification of non-existent ballot...")
    try:
        payload = {
            "election_id": ELECTION_ID,
            "tracking_code": "NONEXISTENT_001",
            "ballot_data": "Different ballot data"
        }

        response = requests.post(f"{BASE_URL}/verify-ballot", json=payload)
        print(f"Verify Non-existent Ballot Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Ballot Exists: {data.get('exists')}")
            print(f"Message: {data.get('message')}")
            return data.get('exists') == False  # Should be False
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Verify non-existent ballot test failed: {e}")
        return False


def run_comprehensive_test():
    """Run all tests"""
    print("=" * 60)
    print("BLOCKCHAIN BALLOT API COMPREHENSIVE TEST")
    print("=" * 60)

    tests = [
        ("Health Check", test_health_check),
        ("Election Details", test_election_details),
        ("Record Ballot", test_record_ballot),
        ("Verify Ballot", test_verify_ballot),
        ("Verify Non-existent Ballot", test_verify_nonexistent_ballot),
    ]

    results = []

    for test_name, test_func in tests:
        print(f"\n{'='*40}")
        print(f"RUNNING: {test_name}")
        print(f"{'='*40}")

        try:
            result = test_func()
            results.append((test_name, result))
            status = "PASSED" if result else "FAILED"
            print(f"\n{test_name}: {status}")
        except Exception as e:
            print(f"\n{test_name}: FAILED - {e}")
            results.append((test_name, False))

        # Wait between tests
        time.sleep(2)

    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{test_name:30} {status}")

    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED! 🎉")
    else:
        print(f"\n⚠️  {total - passed} TESTS FAILED")

    return passed == total


if __name__ == "__main__":
    print("Waiting for services to be ready...")

    # Wait for service to be available
    max_retries = 30
    for i in range(max_retries):
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=5)
            if response.status_code == 200:
                print("Service is ready!")
                break
        except:
            pass
        print(f"Waiting for service... ({i+1}/{max_retries})")
        time.sleep(2)
    else:
        print("Service not available after waiting. Exiting.")
        exit(1)

    # Run tests
    success = run_comprehensive_test()
    exit(0 if success else 1)
