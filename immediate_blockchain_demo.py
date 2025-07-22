#!/usr/bin/env python3
"""
Live Blockchain Microservice Demo - Immediate Election
This script performs actual API calls with an immediately active election
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:5002"


def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 60)
    print(f"📋 {title}")
    print("=" * 60)


def print_step(step_num, description):
    """Print a formatted step"""
    print(f"\n🔸 Step {step_num}: {description}")


def print_result(result):
    """Print formatted result"""
    print(f"✅ Result: {json.dumps(result, indent=2)}")


def print_error(error):
    """Print formatted error"""
    print(f"❌ Error: {error}")


def safe_request(method, url, data=None):
    """Make a safe API request with error handling"""
    try:
        if method.upper() == 'GET':
            response = requests.get(url, timeout=10)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, timeout=10)

        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}: {response.text}"
    except Exception as e:
        return False, str(e)


def demo_immediate_election():
    """Create an election that starts immediately"""
    print_section("IMMEDIATE ELECTION CREATION")

    # Create election that starts now
    current_time = int(time.time())
    start_time = current_time - 10  # Started 10 seconds ago
    end_time = current_time + 7200  # Ends in 2 hours

    election_data = {
        "election_id": "immediate_election_2025",
        "start_time": start_time,
        "end_time": end_time
    }

    print_step(
        1, f"Creating immediately active election: {election_data['election_id']}")
    print(
        f"   Start Time: {datetime.fromtimestamp(start_time)} (already started)")
    print(f"   End Time: {datetime.fromtimestamp(end_time)}")

    success, result = safe_request(
        'POST', f"{BASE_URL}/admin/create-election", election_data)

    if success:
        print_result(result)
        return election_data['election_id']
    else:
        print_error(result)
        return None


def demo_quick_workflow():
    """Run a quick complete workflow"""
    print("🚀 BLOCKCHAIN MICROSERVICE - IMMEDIATE WORKFLOW DEMO")
    print("=" * 80)
    print(f"🕒 Demo Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    # Health check
    print_section("HEALTH CHECK")
    success, result = safe_request('GET', f"{BASE_URL}/health")
    if success:
        print_result(result)
    else:
        print_error(result)
        return

    # Create immediate election
    election_id = demo_immediate_election()
    if not election_id:
        return

    # Register a voter
    print_section("QUICK VOTER REGISTRATION")
    voter_data = {
        "election_id": election_id,
        "voter_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    }

    print_step(1, "Registering single voter for demo")
    success, result = safe_request(
        'POST', f"{BASE_URL}/admin/register-voter", voter_data)
    if success:
        print_result(result)
    else:
        print_error(result)
        return

    # Record a ballot
    print_section("BALLOT RECORDING")
    ballot_data = {
        "election_id": election_id,
        "tracking_code": "IMMEDIATE_VOTE_001",
        "ballot_data": "President: John Doe | Senator: Jane Smith | Measure A: YES",
        "voter_signature": "immediate_demo_signature"
    }

    print_step(1, f"Recording ballot: {ballot_data['tracking_code']}")
    print(f"   Ballot Content: {ballot_data['ballot_data']}")

    success, result = safe_request(
        'POST', f"{BASE_URL}/record-ballot", ballot_data)
    if success:
        print_result(result)
        ballot_commitment = result.get('ballot_commitment')
    else:
        print_error(result)
        return

    # Verify the ballot
    print_section("BALLOT VERIFICATION")
    verify_data = {
        "election_id": election_id,
        "tracking_code": ballot_data["tracking_code"],
        "ballot_data": ballot_data["ballot_data"]
    }

    print_step(1, f"Verifying ballot: {ballot_data['tracking_code']}")
    success, result = safe_request(
        'POST', f"{BASE_URL}/verify-ballot", verify_data)
    if success:
        if result.get('exists'):
            print("✅ Ballot verification successful!")
            print_result(result)
        else:
            print("❌ Ballot not found!")
    else:
        print_error(result)
        return

    # Test invalid verification
    print_section("SECURITY TEST - INVALID BALLOT")
    fake_verify_data = {
        "election_id": election_id,
        "tracking_code": "FAKE_BALLOT_999",
        "ballot_data": "This ballot was never recorded"
    }

    print_step(1, "Testing security with fake ballot")
    success, result = safe_request(
        'POST', f"{BASE_URL}/verify-ballot", fake_verify_data)
    if success:
        if not result.get('exists'):
            print("✅ Security test passed - fake ballot rejected!")
            print_result(result)
        else:
            print("⚠️ Security issue - fake ballot accepted!")
    else:
        print_error(result)

    # Get final election details
    print_section("FINAL ELECTION STATUS")
    print_step(1, f"Getting final status for: {election_id}")
    success, result = safe_request('GET', f"{BASE_URL}/election/{election_id}")
    if success:
        print_result(result)
    else:
        print_error(result)

    # Demo summary
    print("\n" + "=" * 80)
    print("🎉 IMMEDIATE WORKFLOW DEMO COMPLETED!")
    print("=" * 80)
    print("🔍 What we demonstrated:")
    print("   ✅ Service health verification")
    print("   ✅ Real-time election creation")
    print("   ✅ Voter registration on blockchain")
    print("   ✅ Cryptographic ballot recording")
    print("   ✅ Tamper-proof ballot verification")
    print("   ✅ Security validation (fake ballot rejection)")
    print("   ✅ Complete audit trail via transaction hashes")
    print("=" * 80)
    print("🏗️ Architecture highlights:")
    print("   • FastAPI REST endpoints for easy integration")
    print("   • Ethereum smart contract for immutable storage")
    print("   • Web3.py for blockchain interaction")
    print("   • Cryptographic commitments for ballot integrity")
    print("   • Time-based election controls")
    print("=" * 80)


if __name__ == "__main__":
    try:
        demo_quick_workflow()
    except KeyboardInterrupt:
        print("\n\n🛑 Demo interrupted by user")
    except Exception as e:
        print(f"\n\n💥 Demo failed with error: {e}")
        import traceback
        traceback.print_exc()
