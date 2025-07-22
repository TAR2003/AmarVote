# 🔗 Blockchain Microservice - Complete Usage Guide

## 📋 Overview

The blockchain microservice provides a secure, blockchain-backed ballot recording and verification system with the following key components:

- **Smart Contract**: `BallotContract.sol` - Handles election management and ballot storage
- **FastAPI Service**: `main.py` - REST API for blockchain interactions
- **Web3 Integration**: Connects to Hardhat local blockchain
- **Cryptographic Security**: Uses commitments and signatures for ballot privacy

## 🏗️ Architecture

```
Frontend/Client → Blockchain Microservice (Port 5002) → Hardhat Node (Port 8545) → Smart Contract
```

## 📡 API Endpoints

### Health & Monitoring
- `GET /health` - Service health check and blockchain status
- `GET /docs` - Interactive API documentation

### Election Management (Admin)
- `POST /admin/create-election` - Create new election with time boundaries
- `POST /admin/register-voter` - Register voters for specific elections

### Voting Operations
- `POST /record-ballot` - Record encrypted ballot on blockchain
- `POST /verify-ballot` - Verify ballot existence and integrity
- `GET /election/{election_id}` - Get election details and status

## 🔄 Sequential Workflow Examples

### Example 1: Complete Election Setup and Voting

```python
import requests
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5002"

# Step 1: Check service health
def check_health():
    response = requests.get(f"{BASE_URL}/health")
    print(f"Health Check: {response.json()}")
    return response.status_code == 200

# Step 2: Create an election (Admin operation)
def create_election():
    # Calculate future timestamps
    current_time = int(time.time())
    start_time = current_time + 300  # Start in 5 minutes
    end_time = current_time + 3600   # End in 1 hour
    
    payload = {
        "election_id": "presidential_election_2025",
        "start_time": start_time,
        "end_time": end_time
    }
    
    response = requests.post(f"{BASE_URL}/admin/create-election", json=payload)
    print(f"Election Creation: {response.json()}")
    return response.status_code == 200

# Step 3: Register voters (Admin operation)
def register_voters():
    voters = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",  # Test account 1
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",  # Test account 2
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"   # Test account 3
    ]
    
    for voter_address in voters:
        payload = {
            "election_id": "presidential_election_2025",
            "voter_address": voter_address
        }
        response = requests.post(f"{BASE_URL}/admin/register-voter", json=payload)
        print(f"Voter Registration ({voter_address}): {response.json()}")
    
    return True

# Step 4: Check election details
def check_election():
    response = requests.get(f"{BASE_URL}/election/presidential_election_2025")
    print(f"Election Details: {response.json()}")
    return response.status_code == 200

# Step 5: Record ballots (Voter operations)
def record_ballots():
    ballots = [
        {
            "election_id": "presidential_election_2025",
            "tracking_code": "BALLOT_001",
            "ballot_data": "President: Alice, Governor: Bob, Proposition 1: YES",
            "voter_signature": "demo_signature_1"
        },
        {
            "election_id": "presidential_election_2025",
            "tracking_code": "BALLOT_002", 
            "ballot_data": "President: Charlie, Governor: David, Proposition 1: NO",
            "voter_signature": "demo_signature_2"
        }
    ]
    
    for ballot in ballots:
        response = requests.post(f"{BASE_URL}/record-ballot", json=ballot)
        print(f"Ballot Recording ({ballot['tracking_code']}): {response.json()}")
    
    return True

# Step 6: Verify ballots
def verify_ballots():
    verifications = [
        {
            "election_id": "presidential_election_2025",
            "tracking_code": "BALLOT_001",
            "ballot_data": "President: Alice, Governor: Bob, Proposition 1: YES"
        },
        {
            "election_id": "presidential_election_2025",
            "tracking_code": "BALLOT_002",
            "ballot_data": "President: Charlie, Governor: David, Proposition 1: NO"
        }
    ]
    
    for verification in verifications:
        response = requests.post(f"{BASE_URL}/verify-ballot", json=verification)
        print(f"Ballot Verification ({verification['tracking_code']}): {response.json()}")
    
    return True

# Execute the complete workflow
def run_complete_workflow():
    print("🗳️ Starting Complete Election Workflow")
    print("=" * 50)
    
    steps = [
        ("Health Check", check_health),
        ("Create Election", create_election),
        ("Register Voters", register_voters),
        ("Check Election Details", check_election),
        ("Record Ballots", record_ballots),
        ("Verify Ballots", verify_ballots)
    ]
    
    for step_name, step_func in steps:
        print(f"\n📋 {step_name}")
        print("-" * 30)
        try:
            result = step_func()
            print(f"✅ {step_name} completed successfully")
        except Exception as e:
            print(f"❌ {step_name} failed: {e}")
            return False
    
    print("\n🎉 Complete workflow executed successfully!")
    return True

if __name__ == "__main__":
    run_complete_workflow()
```

### Example 2: Ballot Audit and Verification Workflow

```python
import requests
import json

BASE_URL = "http://localhost:5002"

class BlockchainAuditor:
    def __init__(self):
        self.base_url = BASE_URL
        
    def audit_election(self, election_id):
        """Comprehensive election audit"""
        print(f"🔍 Auditing Election: {election_id}")
        
        # Get election details
        response = requests.get(f"{self.base_url}/election/{election_id}")
        if response.status_code == 200:
            election_data = response.json()
            print(f"📊 Election Data: {json.dumps(election_data, indent=2)}")
            
            # Check if election is active
            if election_data.get('is_active'):
                print("✅ Election is active")
            else:
                print("⚠️ Election is not active")
                
            return election_data
        else:
            print(f"❌ Failed to get election details: {response.text}")
            return None
    
    def verify_ballot_integrity(self, election_id, tracking_code, ballot_data):
        """Verify individual ballot integrity"""
        print(f"🔐 Verifying ballot integrity for {tracking_code}")
        
        payload = {
            "election_id": election_id,
            "tracking_code": tracking_code,
            "ballot_data": ballot_data
        }
        
        response = requests.post(f"{self.base_url}/verify-ballot", json=payload)
        if response.status_code == 200:
            result = response.json()
            if result.get('exists'):
                print(f"✅ Ballot verified successfully")
                print(f"   - Timestamp: {result.get('timestamp')}")
                print(f"   - Voter: {result.get('voter_address')}")
                return True
            else:
                print(f"❌ Ballot verification failed: {result.get('message')}")
                return False
        else:
            print(f"❌ Verification request failed: {response.text}")
            return False
    
    def batch_verify_ballots(self, ballots_to_verify):
        """Verify multiple ballots in batch"""
        print(f"📦 Batch verifying {len(ballots_to_verify)} ballots")
        
        results = []
        for i, ballot in enumerate(ballots_to_verify):
            print(f"\nVerifying ballot {i+1}/{len(ballots_to_verify)}")
            result = self.verify_ballot_integrity(
                ballot['election_id'],
                ballot['tracking_code'], 
                ballot['ballot_data']
            )
            results.append(result)
        
        verified_count = sum(results)
        print(f"\n📈 Verification Summary: {verified_count}/{len(ballots_to_verify)} ballots verified")
        return results

# Usage example
def run_audit_workflow():
    auditor = BlockchainAuditor()
    
    # Audit an election
    election_data = auditor.audit_election("presidential_election_2025")
    
    # Verify specific ballots
    ballots_to_verify = [
        {
            "election_id": "presidential_election_2025",
            "tracking_code": "BALLOT_001",
            "ballot_data": "President: Alice, Governor: Bob, Proposition 1: YES"
        },
        {
            "election_id": "presidential_election_2025", 
            "tracking_code": "BALLOT_002",
            "ballot_data": "President: Charlie, Governor: David, Proposition 1: NO"
        }
    ]
    
    auditor.batch_verify_ballots(ballots_to_verify)

if __name__ == "__main__":
    run_audit_workflow()
```

### Example 3: Real-time Monitoring and Health Check

```python
import requests
import time
import json
from datetime import datetime

BASE_URL = "http://localhost:5002"

class BlockchainMonitor:
    def __init__(self):
        self.base_url = BASE_URL
        
    def monitor_health(self, interval=10, duration=60):
        """Monitor blockchain service health"""
        print(f"📊 Starting health monitoring (interval: {interval}s, duration: {duration}s)")
        
        start_time = time.time()
        checks = 0
        successful_checks = 0
        
        while (time.time() - start_time) < duration:
            checks += 1
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            try:
                response = requests.get(f"{self.base_url}/health", timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    successful_checks += 1
                    print(f"[{timestamp}] ✅ Healthy - Block: {data.get('latest_block', 'N/A')}")
                else:
                    print(f"[{timestamp}] ❌ Unhealthy - Status: {response.status_code}")
            except Exception as e:
                print(f"[{timestamp}] ❌ Connection failed: {e}")
            
            time.sleep(interval)
        
        success_rate = (successful_checks / checks) * 100
        print(f"\n📈 Monitoring Summary:")
        print(f"   - Total checks: {checks}")
        print(f"   - Successful: {successful_checks}")
        print(f"   - Success rate: {success_rate:.1f}%")
        
        return success_rate
    
    def get_service_metrics(self):
        """Get detailed service metrics"""
        try:
            response = requests.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                print("📊 Service Metrics:")
                print(f"   - Status: {data.get('status')}")
                print(f"   - Blockchain Connected: {data.get('blockchain_connected')}")
                print(f"   - Latest Block: {data.get('latest_block')}")
                print(f"   - Contract Address: {data.get('contract_address')}")
                return data
            else:
                print(f"❌ Failed to get metrics: {response.text}")
                return None
        except Exception as e:
            print(f"❌ Metrics request failed: {e}")
            return None

# Usage example  
def run_monitoring_workflow():
    monitor = BlockchainMonitor()
    
    # Get current metrics
    monitor.get_service_metrics()
    
    # Monitor health for 2 minutes with 10-second intervals
    monitor.monitor_health(interval=10, duration=120)

if __name__ == "__main__":
    run_monitoring_workflow()
```

## 🔧 Data Models and Validation

### Request Models

```python
# Election Creation
{
    "election_id": "string",     # Unique identifier
    "start_time": 1234567890,    # Unix timestamp (future)
    "end_time": 1234567999       # Unix timestamp (after start_time)
}

# Voter Registration  
{
    "election_id": "string",     # Must exist
    "voter_address": "0x..."     # Ethereum address
}

# Ballot Recording
{
    "election_id": "string",     # Must exist and be active
    "tracking_code": "string",   # Unique per election
    "ballot_data": "string",     # Actual vote content
    "voter_signature": "string"  # Cryptographic signature
}

# Ballot Verification
{
    "election_id": "string",     # Election to verify in
    "tracking_code": "string",   # Ballot identifier
    "ballot_data": "string"      # Original vote content
}
```

### Response Models

```python
# Health Check Response
{
    "status": "healthy",
    "blockchain_connected": true,
    "latest_block": 1234,
    "contract_address": "0x..."
}

# Election Details Response
{
    "election_id": "string",
    "is_active": true,
    "start_time": 1234567890,
    "end_time": 1234567999,
    "start_date": "2025-01-01T00:00:00",
    "end_date": "2025-01-02T00:00:00"
}

# Ballot Record Response  
{
    "success": true,
    "transaction_hash": "0x...",
    "timestamp": 1234567890,
    "ballot_commitment": "0x...",
    "message": "Ballot recorded successfully"
}

# Ballot Verify Response
{
    "exists": true,
    "timestamp": 1234567890,
    "voter_address": "0x...",
    "message": "Ballot verification successful"
}
```

## 🔒 Security Features

1. **Cryptographic Commitments**: Ballot data is hashed for privacy
2. **Signature Verification**: All transactions require valid signatures
3. **Time-based Validation**: Elections have strict time boundaries
4. **Voter Registration**: Only registered voters can participate
5. **Unique Tracking Codes**: Prevents double voting
6. **Immutable Records**: Blockchain ensures data integrity

## 🚀 Getting Started

1. **Start the system**:
   ```bash
   docker-compose up -d
   ```

2. **Wait for services to be ready**:
   ```bash
   curl http://localhost:5002/health
   ```

3. **View API documentation**:
   ```
   http://localhost:5002/docs
   ```

4. **Run test workflows**:
   ```bash
   python test_blockchain_api.py
   ```

## 🐞 Troubleshooting

### Common Issues

1. **Service not ready**: Wait for blockchain deployment
2. **Connection refused**: Check if containers are running
3. **Invalid timestamps**: Use future timestamps for elections  
4. **Signature errors**: Ensure proper voter authentication
5. **Contract not found**: Wait for deployment to complete

### Debug Commands

```bash
# Check container status
docker-compose ps

# View service logs
docker logs blockchain_microservice
docker logs hardhat_node

# Test connectivity
curl http://localhost:5002/health
curl http://localhost:8545  # Hardhat RPC
```

## 📊 Monitoring and Observability

- **Health endpoint**: Real-time service status
- **Block tracking**: Monitor blockchain progress
- **Transaction hashes**: Track all ballot operations
- **Detailed logging**: Comprehensive audit trails
- **Error handling**: Graceful failure responses

This microservice provides a robust, secure foundation for blockchain-based voting systems with comprehensive API coverage and strong security guarantees.
