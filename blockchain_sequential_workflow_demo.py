#!/usr/bin/env python3
"""
Comprehensive Sequential Workflow Demonstration for Blockchain Microservice
Demonstrates complete election lifecycle with blockchain integration
"""

import requests
import json
import time
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# Configuration
BASE_URL = "http://localhost:5002"
HARDHAT_URL = "http://localhost:8545"


class BlockchainElectionManager:
    """Complete election management using blockchain microservice"""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.elections = {}
        self.voters = {}
        self.ballots = {}

    def log(self, message: str, level: str = "INFO"):
        """Enhanced logging with timestamps"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    # PHASE 1: SERVICE VERIFICATION
    def verify_service_health(self) -> bool:
        """Step 1: Verify blockchain microservice is healthy and ready"""
        self.log("🔍 PHASE 1: Service Health Verification")
        self.log("-" * 50)

        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Service Status: {data.get('status')}")
                self.log(
                    f"✅ Blockchain Connected: {data.get('blockchain_connected')}")
                self.log(f"✅ Latest Block: {data.get('latest_block')}")
                self.log(f"✅ Contract Address: {data.get('contract_address')}")

                if data.get('blockchain_connected') and data.get('contract_address'):
                    self.log("✅ Service is fully operational")
                    return True
                else:
                    self.log("❌ Service not fully initialized")
                    return False
            else:
                self.log(f"❌ Health check failed: {response.status_code}")
                return False

        except Exception as e:
            self.log(f"❌ Service unreachable: {e}", "ERROR")
            return False

    # PHASE 2: ELECTION SETUP
    def create_election(self, election_id: str, duration_hours: int = 24) -> bool:
        """Step 2: Create a new election with time boundaries"""
        self.log(f"🗳️ PHASE 2: Creating Election '{election_id}'")
        self.log("-" * 50)

        # Calculate election timeframe
        current_time = int(time.time())
        start_time = current_time + 60      # Start in 1 minute
        end_time = start_time + (duration_hours * 3600)  # Duration in hours

        payload = {
            "election_id": election_id,
            "start_time": start_time,
            "end_time": end_time
        }

        try:
            response = requests.post(
                f"{self.base_url}/admin/create-election", json=payload)
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Election created successfully")
                self.log(
                    f"   - Transaction Hash: {data.get('transaction_hash')}")
                self.log(
                    f"   - Start Time: {datetime.fromtimestamp(start_time)}")
                self.log(f"   - End Time: {datetime.fromtimestamp(end_time)}")

                # Store election info
                self.elections[election_id] = {
                    "start_time": start_time,
                    "end_time": end_time,
                    "transaction_hash": data.get('transaction_hash'),
                    "voters": [],
                    "ballots": []
                }
                return True
            else:
                self.log(
                    f"❌ Election creation failed: {response.text}", "ERROR")
                return False

        except Exception as e:
            self.log(f"❌ Election creation error: {e}", "ERROR")
            return False

    def register_voters(self, election_id: str, voter_addresses: List[str]) -> bool:
        """Step 3: Register voters for the election"""
        self.log(f"👥 PHASE 3: Registering {len(voter_addresses)} voters")
        self.log("-" * 50)

        successful_registrations = 0

        for i, voter_address in enumerate(voter_addresses):
            self.log(
                f"Registering voter {i+1}/{len(voter_addresses)}: {voter_address}")

            payload = {
                "election_id": election_id,
                "voter_address": voter_address
            }

            try:
                response = requests.post(
                    f"{self.base_url}/admin/register-voter", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    self.log(
                        f"   ✅ Registered - TX: {data.get('transaction_hash')[:10]}...")
                    successful_registrations += 1

                    # Store voter info
                    if election_id in self.elections:
                        self.elections[election_id]['voters'].append(
                            voter_address)
                else:
                    self.log(
                        f"   ❌ Registration failed: {response.text}", "ERROR")

            except Exception as e:
                self.log(f"   ❌ Registration error: {e}", "ERROR")

        self.log(
            f"📊 Registration Summary: {successful_registrations}/{len(voter_addresses)} successful")
        return successful_registrations == len(voter_addresses)

    def verify_election_setup(self, election_id: str) -> bool:
        """Step 4: Verify election is properly configured"""
        self.log(f"🔍 PHASE 4: Verifying Election Setup")
        self.log("-" * 50)

        try:
            response = requests.get(f"{self.base_url}/election/{election_id}")
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Election Details Retrieved:")
                self.log(f"   - ID: {data.get('election_id')}")
                self.log(f"   - Active: {data.get('is_active')}")
                self.log(f"   - Start: {data.get('start_date')}")
                self.log(f"   - End: {data.get('end_date')}")

                if data.get('is_active'):
                    self.log("✅ Election is active and ready for voting")
                    return True
                else:
                    self.log("⚠️ Election exists but not active")
                    return False
            else:
                self.log(
                    f"❌ Failed to get election details: {response.text}", "ERROR")
                return False

        except Exception as e:
            self.log(f"❌ Election verification error: {e}", "ERROR")
            return False

    # PHASE 3: VOTING OPERATIONS
    def record_ballots(self, election_id: str, ballots: List[Dict]) -> bool:
        """Step 5: Record multiple ballots on the blockchain"""
        self.log(f"📝 PHASE 5: Recording {len(ballots)} ballots")
        self.log("-" * 50)

        successful_records = 0

        for i, ballot_data in enumerate(ballots):
            self.log(
                f"Recording ballot {i+1}/{len(ballots)}: {ballot_data['tracking_code']}")

            payload = {
                "election_id": election_id,
                "tracking_code": ballot_data['tracking_code'],
                "ballot_data": ballot_data['ballot_data'],
                "voter_signature": ballot_data.get('voter_signature', 'demo_signature')
            }

            try:
                response = requests.post(
                    f"{self.base_url}/record-ballot", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    self.log(
                        f"   ✅ Recorded - TX: {data.get('transaction_hash')[:10]}...")
                    self.log(
                        f"      Commitment: {data.get('ballot_commitment')[:10]}...")
                    successful_records += 1

                    # Store ballot info
                    ballot_info = {
                        **ballot_data,
                        'transaction_hash': data.get('transaction_hash'),
                        'commitment': data.get('ballot_commitment'),
                        'timestamp': data.get('timestamp')
                    }

                    if election_id in self.elections:
                        self.elections[election_id]['ballots'].append(
                            ballot_info)

                else:
                    self.log(
                        f"   ❌ Recording failed: {response.text}", "ERROR")

            except Exception as e:
                self.log(f"   ❌ Recording error: {e}", "ERROR")

        self.log(
            f"📊 Recording Summary: {successful_records}/{len(ballots)} successful")
        return successful_records == len(ballots)

    def verify_ballots(self, election_id: str, ballots_to_verify: List[Dict]) -> bool:
        """Step 6: Verify all recorded ballots"""
        self.log(f"🔐 PHASE 6: Verifying {len(ballots_to_verify)} ballots")
        self.log("-" * 50)

        successful_verifications = 0

        for i, ballot_data in enumerate(ballots_to_verify):
            self.log(
                f"Verifying ballot {i+1}/{len(ballots_to_verify)}: {ballot_data['tracking_code']}")

            payload = {
                "election_id": election_id,
                "tracking_code": ballot_data['tracking_code'],
                "ballot_data": ballot_data['ballot_data']
            }

            try:
                response = requests.post(
                    f"{self.base_url}/verify-ballot", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('exists'):
                        self.log(
                            f"   ✅ Verified - Timestamp: {data.get('timestamp')}")
                        self.log(
                            f"      Voter: {data.get('voter_address')[:10]}...")
                        successful_verifications += 1
                    else:
                        self.log(
                            f"   ❌ Verification failed: {data.get('message')}")
                else:
                    self.log(
                        f"   ❌ Verification request failed: {response.text}", "ERROR")

            except Exception as e:
                self.log(f"   ❌ Verification error: {e}", "ERROR")

        self.log(
            f"📊 Verification Summary: {successful_verifications}/{len(ballots_to_verify)} successful")
        return successful_verifications == len(ballots_to_verify)

    # PHASE 4: AUDIT AND ANALYSIS
    def perform_election_audit(self, election_id: str) -> Dict:
        """Step 7: Comprehensive election audit"""
        self.log(f"📊 PHASE 7: Election Audit and Analysis")
        self.log("-" * 50)

        audit_results = {
            "election_id": election_id,
            "audit_timestamp": datetime.now().isoformat(),
            "total_voters": 0,
            "total_ballots": 0,
            "verified_ballots": 0,
            "integrity_score": 0.0,
            "anomalies": []
        }

        if election_id in self.elections:
            election_data = self.elections[election_id]
            audit_results["total_voters"] = len(
                election_data.get('voters', []))
            audit_results["total_ballots"] = len(
                election_data.get('ballots', []))

            self.log(f"📈 Audit Results:")
            self.log(
                f"   - Registered Voters: {audit_results['total_voters']}")
            self.log(
                f"   - Recorded Ballots: {audit_results['total_ballots']}")

            # Calculate participation rate
            if audit_results["total_voters"] > 0:
                participation_rate = (
                    audit_results["total_ballots"] / audit_results["total_voters"]) * 100
                self.log(f"   - Participation Rate: {participation_rate:.1f}%")

            # Check for anomalies
            tracking_codes = [ballot['tracking_code']
                              for ballot in election_data.get('ballots', [])]
            if len(tracking_codes) != len(set(tracking_codes)):
                audit_results["anomalies"].append(
                    "Duplicate tracking codes detected")
                self.log("⚠️ ANOMALY: Duplicate tracking codes found")

            audit_results["integrity_score"] = 100.0 if not audit_results["anomalies"] else 95.0
            self.log(
                f"   - Integrity Score: {audit_results['integrity_score']}%")

        return audit_results

    def generate_election_report(self, election_id: str) -> str:
        """Step 8: Generate comprehensive election report"""
        self.log(f"📋 PHASE 8: Generating Election Report")
        self.log("-" * 50)

        report = []
        report.append("=" * 60)
        report.append(f"BLOCKCHAIN ELECTION REPORT")
        report.append(f"Election ID: {election_id}")
        report.append(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("=" * 60)

        if election_id in self.elections:
            election_data = self.elections[election_id]

            # Election details
            report.append("\n📋 ELECTION DETAILS")
            report.append("-" * 30)
            report.append(
                f"Start Time: {datetime.fromtimestamp(election_data['start_time'])}")
            report.append(
                f"End Time: {datetime.fromtimestamp(election_data['end_time'])}")
            report.append(
                f"Creation TX: {election_data.get('transaction_hash', 'N/A')}")

            # Voter statistics
            report.append("\n👥 VOTER STATISTICS")
            report.append("-" * 30)
            report.append(
                f"Registered Voters: {len(election_data.get('voters', []))}")
            for i, voter in enumerate(election_data.get('voters', [])[:5]):  # Show first 5
                report.append(f"  {i+1}. {voter}")
            if len(election_data.get('voters', [])) > 5:
                report.append(
                    f"  ... and {len(election_data.get('voters', [])) - 5} more")

            # Ballot statistics
            report.append("\n🗳️ BALLOT STATISTICS")
            report.append("-" * 30)
            report.append(
                f"Total Ballots: {len(election_data.get('ballots', []))}")

            # Show first 3
            for i, ballot in enumerate(election_data.get('ballots', [])[:3]):
                report.append(f"\n  Ballot {i+1}:")
                report.append(f"    Tracking Code: {ballot['tracking_code']}")
                report.append(
                    f"    Transaction: {ballot.get('transaction_hash', 'N/A')[:20]}...")
                report.append(
                    f"    Timestamp: {datetime.fromtimestamp(ballot.get('timestamp', 0))}")

            if len(election_data.get('ballots', [])) > 3:
                report.append(
                    f"  ... and {len(election_data.get('ballots', [])) - 3} more ballots")

        report.append("\n" + "=" * 60)

        report_content = "\\n".join(report)
        self.log("✅ Election report generated successfully")

        return report_content


def demonstrate_complete_workflow():
    """Demonstrate the complete blockchain election workflow"""
    print("🚀 BLOCKCHAIN ELECTION SYSTEM - COMPLETE WORKFLOW DEMONSTRATION")
    print("=" * 80)
    print()

    # Initialize manager
    manager = BlockchainElectionManager()

    # Define test data
    election_id = "presidential_election_2025"
    test_voters = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",  # Test account 1
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",  # Test account 2
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",  # Test account 3
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",  # Test account 4
        "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"   # Test account 5
    ]

    test_ballots = [
        {
            "tracking_code": "BALLOT_001",
            "ballot_data": "President: Alice Johnson, Governor: Bob Smith, Proposition 1: YES, Proposition 2: NO",
            "voter_signature": "signature_001"
        },
        {
            "tracking_code": "BALLOT_002",
            "ballot_data": "President: Charlie Brown, Governor: Diana White, Proposition 1: NO, Proposition 2: YES",
            "voter_signature": "signature_002"
        },
        {
            "tracking_code": "BALLOT_003",
            "ballot_data": "President: Alice Johnson, Governor: Diana White, Proposition 1: YES, Proposition 2: YES",
            "voter_signature": "signature_003"
        },
        {
            "tracking_code": "BALLOT_004",
            "ballot_data": "President: Charlie Brown, Governor: Bob Smith, Proposition 1: NO, Proposition 2: NO",
            "voter_signature": "signature_004"
        }
    ]

    # Execute workflow phases
    workflow_steps = [
        ("Service Health Check", lambda: manager.verify_service_health()),
        ("Election Creation", lambda: manager.create_election(
            election_id, duration_hours=48)),
        ("Voter Registration", lambda: manager.register_voters(
            election_id, test_voters)),
        ("Election Verification", lambda: manager.verify_election_setup(election_id)),
        ("Ballot Recording", lambda: manager.record_ballots(election_id, test_ballots)),
        ("Ballot Verification", lambda: manager.verify_ballots(
            election_id, test_ballots)),
        ("Election Audit", lambda: manager.perform_election_audit(election_id)),
        ("Report Generation", lambda: manager.generate_election_report(election_id))
    ]

    successful_steps = 0
    total_steps = len(workflow_steps)

    for step_name, step_function in workflow_steps:
        print(f"\\n🔄 Executing: {step_name}")
        print("=" * 80)

        try:
            result = step_function()
            if result:
                successful_steps += 1
                manager.log(f"✅ {step_name} completed successfully", "SUCCESS")
            else:
                manager.log(f"❌ {step_name} failed", "ERROR")

        except Exception as e:
            manager.log(f"❌ {step_name} error: {e}", "ERROR")

        # Add delay between steps for demonstration
        time.sleep(1)

    # Final summary
    print("\\n" + "=" * 80)
    print("🎯 WORKFLOW COMPLETION SUMMARY")
    print("=" * 80)
    print(f"✅ Successful Steps: {successful_steps}/{total_steps}")
    print(f"📊 Success Rate: {(successful_steps/total_steps)*100:.1f}%")

    if successful_steps == total_steps:
        print("🎉 Complete workflow executed successfully!")
        print("🔗 Blockchain election system is fully operational!")
    else:
        print("⚠️ Some steps failed. Please check the logs above.")

    print("=" * 80)
    return successful_steps == total_steps


if __name__ == "__main__":
    # Wait for services to be ready
    print("⏳ Waiting for blockchain services to be ready...")
    time.sleep(5)

    # Run the complete demonstration
    success = demonstrate_complete_workflow()

    # Exit with appropriate code
    exit(0 if success else 1)
