#!/usr/bin/env python3
"""
Simple Sequential Workflow Examples for Blockchain Microservice
Demonstrates basic API usage patterns and common operations
"""

import json
import time
from datetime import datetime

# Note: In real usage, you would import requests
# For demonstration, we'll show the curl equivalents too

# Configuration
BASE_URL = "http://localhost:5002"

# =============================================================================
# EXAMPLE 1: Basic Health Check and Service Verification
# =============================================================================


def example_1_health_check():
    """Basic health check to verify service is running"""
    print("=" * 60)
    print("EXAMPLE 1: Health Check and Service Verification")
    print("=" * 60)

    # Python requests version:
    print("🐍 Python Version:")
    print("""
import requests

response = requests.get("http://localhost:5002/health")
if response.status_code == 200:
    data = response.json()
    print(f"Status: {data['status']}")
    print(f"Blockchain Connected: {data['blockchain_connected']}")
    print(f"Latest Block: {data['latest_block']}")
    print(f"Contract Address: {data['contract_address']}")
else:
    print(f"Error: {response.status_code}")
""")

    # Curl equivalent:
    print("💻 Curl Equivalent:")
    print("""
curl -X GET "http://localhost:5002/health"
""")

    print("📋 Expected Response:")
    print("""
{
  "status": "healthy",
  "blockchain_connected": true,
  "latest_block": 1234,
  "contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
}
""")

# =============================================================================
# EXAMPLE 2: Election Creation (Admin Operation)
# =============================================================================


def example_2_create_election():
    """Create a new election with time boundaries"""
    print("=" * 60)
    print("EXAMPLE 2: Election Creation (Admin Operation)")
    print("=" * 60)

    # Calculate timestamps
    current_time = int(time.time())
    start_time = current_time + 300    # Start in 5 minutes
    end_time = current_time + 86400    # End in 24 hours

    print("🐍 Python Version:")
    print(f"""
import requests
import time

# Calculate future timestamps
current_time = int(time.time())
start_time = current_time + 300    # Start in 5 minutes  
end_time = current_time + 86400    # End in 24 hours

payload = {{
    "election_id": "city_council_2025",
    "start_time": {start_time},
    "end_time": {end_time}
}}

response = requests.post(
    "http://localhost:5002/admin/create-election",
    json=payload
)

if response.status_code == 200:
    data = response.json()
    print(f"Election created: {{data['election_id']}}")
    print(f"Transaction hash: {{data['transaction_hash']}}")
else:
    print(f"Error: {{response.text}}")
""")

    print("💻 Curl Equivalent:")
    print(f"""
curl -X POST "http://localhost:5002/admin/create-election" \\
     -H "Content-Type: application/json" \\
     -d '{{
       "election_id": "city_council_2025",
       "start_time": {start_time},
       "end_time": {end_time}
     }}'
""")

    print("📋 Expected Response:")
    print("""
{
  "success": true,
  "transaction_hash": "0x1234567890abcdef...",
  "election_id": "city_council_2025"
}
""")

# =============================================================================
# EXAMPLE 3: Voter Registration (Admin Operation)
# =============================================================================


def example_3_register_voters():
    """Register multiple voters for an election"""
    print("=" * 60)
    print("EXAMPLE 3: Voter Registration (Admin Operation)")
    print("=" * 60)

    voters = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    ]

    print("🐍 Python Version (Batch Registration):")
    print(f"""
import requests

voters = {voters}
election_id = "city_council_2025"

for voter_address in voters:
    payload = {{
        "election_id": election_id,
        "voter_address": voter_address
    }}
    
    response = requests.post(
        "http://localhost:5002/admin/register-voter",
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"Registered {{voter_address}}: {{data['transaction_hash']}}")
    else:
        print(f"Failed to register {{voter_address}}: {{response.text}}")
""")

    print("💻 Curl Equivalent (Single Voter):")
    print(f"""
curl -X POST "http://localhost:5002/admin/register-voter" \\
     -H "Content-Type: application/json" \\
     -d '{{
       "election_id": "city_council_2025",
       "voter_address": "{voters[0]}"
     }}'
""")

# =============================================================================
# EXAMPLE 4: Election Details Retrieval
# =============================================================================


def example_4_get_election_details():
    """Retrieve election information and status"""
    print("=" * 60)
    print("EXAMPLE 4: Election Details Retrieval")
    print("=" * 60)

    print("🐍 Python Version:")
    print("""
import requests

election_id = "city_council_2025"
response = requests.get(f"http://localhost:5002/election/{election_id}")

if response.status_code == 200:
    data = response.json()
    print(f"Election ID: {data['election_id']}")
    print(f"Active: {data['is_active']}")
    print(f"Start Time: {data['start_date']}")
    print(f"End Time: {data['end_date']}")
else:
    print(f"Error: {response.text}")
""")

    print("💻 Curl Equivalent:")
    print("""
curl -X GET "http://localhost:5002/election/city_council_2025"
""")

    print("📋 Expected Response:")
    print("""
{
  "election_id": "city_council_2025",
  "is_active": true,
  "start_time": 1234567890,
  "end_time": 1234654290,
  "start_date": "2025-01-01T12:00:00",
  "end_date": "2025-01-02T12:00:00"
}
""")

# =============================================================================
# EXAMPLE 5: Ballot Recording (Voter Operation)
# =============================================================================


def example_5_record_ballot():
    """Record a ballot on the blockchain"""
    print("=" * 60)
    print("EXAMPLE 5: Ballot Recording (Voter Operation)")
    print("=" * 60)

    print("🐍 Python Version:")
    print("""
import requests

# Ballot data
ballot_payload = {
    "election_id": "city_council_2025",
    "tracking_code": "BALLOT_12345",
    "ballot_data": "Mayor: Alice Johnson, Council: Bob Smith, Charlie Brown",
    "voter_signature": "demo_signature_12345"
}

response = requests.post(
    "http://localhost:5002/record-ballot",
    json=ballot_payload
)

if response.status_code == 200:
    data = response.json()
    print(f"Ballot recorded successfully!")
    print(f"Transaction Hash: {data['transaction_hash']}")
    print(f"Timestamp: {data['timestamp']}")
    print(f"Ballot Commitment: {data['ballot_commitment']}")
else:
    print(f"Error: {response.text}")
""")

    print("💻 Curl Equivalent:")
    print("""
curl -X POST "http://localhost:5002/record-ballot" \\
     -H "Content-Type: application/json" \\
     -d '{
       "election_id": "city_council_2025",
       "tracking_code": "BALLOT_12345",
       "ballot_data": "Mayor: Alice Johnson, Council: Bob Smith, Charlie Brown",
       "voter_signature": "demo_signature_12345"
     }'
""")

    print("📋 Expected Response:")
    print("""
{
  "success": true,
  "transaction_hash": "0xabcdef1234567890...",
  "timestamp": 1234567890,
  "ballot_commitment": "0x9876543210fedcba...",
  "message": "Ballot recorded successfully"
}
""")

# =============================================================================
# EXAMPLE 6: Ballot Verification
# =============================================================================


def example_6_verify_ballot():
    """Verify a ballot exists and matches the commitment"""
    print("=" * 60)
    print("EXAMPLE 6: Ballot Verification")
    print("=" * 60)

    print("🐍 Python Version:")
    print("""
import requests

# Verification data (must match original ballot)
verify_payload = {
    "election_id": "city_council_2025",
    "tracking_code": "BALLOT_12345",
    "ballot_data": "Mayor: Alice Johnson, Council: Bob Smith, Charlie Brown"
}

response = requests.post(
    "http://localhost:5002/verify-ballot",
    json=verify_payload
)

if response.status_code == 200:
    data = response.json()
    if data['exists']:
        print(f"✅ Ballot verified successfully!")
        print(f"Timestamp: {data['timestamp']}")
        print(f"Voter Address: {data['voter_address']}")
    else:
        print(f"❌ Ballot verification failed: {data['message']}")
else:
    print(f"Error: {response.text}")
""")

    print("💻 Curl Equivalent:")
    print("""
curl -X POST "http://localhost:5002/verify-ballot" \\
     -H "Content-Type: application/json" \\
     -d '{
       "election_id": "city_council_2025",
       "tracking_code": "BALLOT_12345", 
       "ballot_data": "Mayor: Alice Johnson, Council: Bob Smith, Charlie Brown"
     }'
""")

    print("📋 Expected Response (Successful Verification):")
    print("""
{
  "exists": true,
  "timestamp": 1234567890,
  "voter_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "message": "Ballot verification successful"
}
""")

# =============================================================================
# EXAMPLE 7: Complete Sequential Workflow
# =============================================================================


def example_7_complete_workflow():
    """Complete workflow from election setup to ballot verification"""
    print("=" * 60)
    print("EXAMPLE 7: Complete Sequential Workflow")
    print("=" * 60)

    print("🔄 Step-by-Step Workflow:")
    print("""
import requests
import time

# Step 1: Health Check
print("Step 1: Checking service health...")
health = requests.get("http://localhost:5002/health")
if health.status_code != 200:
    print("Service not ready!")
    exit(1)

# Step 2: Create Election
print("Step 2: Creating election...")
current_time = int(time.time())
election_data = {
    "election_id": "local_election_2025",
    "start_time": current_time + 60,
    "end_time": current_time + 86400
}
election_response = requests.post(
    "http://localhost:5002/admin/create-election",
    json=election_data
)
print(f"Election created: {election_response.json()}")

# Step 3: Register Voters
print("Step 3: Registering voters...")
voters = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
]

for voter in voters:
    voter_data = {
        "election_id": "local_election_2025",
        "voter_address": voter
    }
    voter_response = requests.post(
        "http://localhost:5002/admin/register-voter",
        json=voter_data
    )
    print(f"Voter registered: {voter_response.json()}")

# Step 4: Record Ballots
print("Step 4: Recording ballots...")
ballots = [
    {
        "election_id": "local_election_2025",
        "tracking_code": "VOTE_001",
        "ballot_data": "Candidate A: YES, Proposition 1: NO",
        "voter_signature": "sig_001"
    },
    {
        "election_id": "local_election_2025", 
        "tracking_code": "VOTE_002",
        "ballot_data": "Candidate B: YES, Proposition 1: YES",
        "voter_signature": "sig_002"
    }
]

for ballot in ballots:
    ballot_response = requests.post(
        "http://localhost:5002/record-ballot",
        json=ballot
    )
    print(f"Ballot recorded: {ballot_response.json()}")

# Step 5: Verify Ballots
print("Step 5: Verifying ballots...")
for ballot in ballots:
    verify_data = {
        "election_id": ballot["election_id"],
        "tracking_code": ballot["tracking_code"],
        "ballot_data": ballot["ballot_data"]
    }
    verify_response = requests.post(
        "http://localhost:5002/verify-ballot",
        json=verify_data
    )
    result = verify_response.json()
    print(f"Verification for {ballot['tracking_code']}: {result['exists']}")

print("✅ Complete workflow executed successfully!")
""")

# =============================================================================
# EXAMPLE 8: Error Handling Patterns
# =============================================================================


def example_8_error_handling():
    """Common error handling patterns"""
    print("=" * 60)
    print("EXAMPLE 8: Error Handling Patterns")
    print("=" * 60)

    print("🚨 Common Error Scenarios and Handling:")
    print("""
import requests
from datetime import datetime

def safe_api_call(url, method='GET', data=None, max_retries=3):
    \"\"\"Safe API call with retry logic\"\"\"
    for attempt in range(max_retries):
        try:
            if method == 'GET':
                response = requests.get(url, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                return response.json(), None
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                print(f"Attempt {attempt + 1} failed: {error_msg}")
                
        except requests.exceptions.ConnectionError:
            print(f"Attempt {attempt + 1}: Connection failed")
        except requests.exceptions.Timeout:
            print(f"Attempt {attempt + 1}: Request timed out")
        except Exception as e:
            print(f"Attempt {attempt + 1}: Unexpected error: {e}")
        
        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)  # Exponential backoff
    
    return None, "Max retries exceeded"

# Example usage:
data, error = safe_api_call("http://localhost:5002/health")
if error:
    print(f"Failed to get health status: {error}")
else:
    print(f"Service is {data['status']}")

# Specific error handling for elections:
def create_election_with_validation(election_id, hours_duration=24):
    # Validate election doesn't already exist
    existing, _ = safe_api_call(f"http://localhost:5002/election/{election_id}")
    if existing:
        print(f"Election {election_id} already exists!")
        return False
    
    # Create with proper timestamps
    current_time = int(time.time())
    election_data = {
        "election_id": election_id,
        "start_time": current_time + 300,  # 5 minutes from now
        "end_time": current_time + (hours_duration * 3600)
    }
    
    result, error = safe_api_call(
        "http://localhost:5002/admin/create-election",
        method='POST',
        data=election_data
    )
    
    if error:
        print(f"Failed to create election: {error}")
        return False
    
    print(f"Election created successfully: {result['transaction_hash']}")
    return True
""")

# =============================================================================
# Main execution function
# =============================================================================


def run_all_examples():
    """Run all examples in sequence"""
    examples = [
        ("Health Check", example_1_health_check),
        ("Election Creation", example_2_create_election),
        ("Voter Registration", example_3_register_voters),
        ("Election Details", example_4_get_election_details),
        ("Ballot Recording", example_5_record_ballot),
        ("Ballot Verification", example_6_verify_ballot),
        ("Complete Workflow", example_7_complete_workflow),
        ("Error Handling", example_8_error_handling)
    ]

    print("🚀 BLOCKCHAIN MICROSERVICE - API USAGE EXAMPLES")
    print("=" * 80)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    for example_name, example_func in examples:
        print(f"\\n\\n🔹 Running: {example_name}")
        try:
            example_func()
        except Exception as e:
            print(f"❌ Error in {example_name}: {e}")

        input("\\n⏸️  Press Enter to continue to next example...")

    print("\\n\\n🎉 All examples completed!")
    print("=" * 80)
    print("📚 Key Takeaways:")
    print("  1. Always check service health before operations")
    print("  2. Use proper timestamp validation for elections")
    print("  3. Handle errors gracefully with retry logic")
    print("  4. Verify ballots immediately after recording")
    print("  5. Use meaningful tracking codes for audit trails")
    print("=" * 80)


if __name__ == "__main__":
    run_all_examples()
