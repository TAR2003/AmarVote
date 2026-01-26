#!/usr/bin/env python3

"""
Debug script to test the partial decryption endpoint directly
This helps identify if the issue is in the microservice itself or in the data format
"""

import requests
import json

# Test data based on the expected API format
test_data = {
    "guardian_id": "1",
    "guardian_data": "{}",  # Empty JSON string for testing
    "private_key": "{}",    # Empty JSON string for testing
    "public_key": "{}",     # Empty JSON string for testing
    "polynomial": "{}",     # Empty JSON string for testing
    "party_names": ["Party A", "Party B"],
    "candidate_names": ["Candidate 1", "Candidate 2"],
    "ciphertext_tally": "{}",  # Empty JSON string for testing
    "submitted_ballots": ["{}"],  # List with one empty JSON string
    "joint_public_key": "test_joint_key",
    "commitment_hash": "test_commitment_hash",
    "number_of_guardians": 3,
    "quorum": 2
}

def test_partial_decryption_endpoint():
    """Test the partial decryption endpoint with minimal data"""
    try:
        url = "http://localhost:5000/create_partial_decryption"
        headers = {"Content-Type": "application/json"}
        
        print("Testing partial decryption endpoint...")
        print(f"URL: {url}")
        print(f"Data: {json.dumps(test_data, indent=2)}")
        
        response = requests.post(url, json=test_data, headers=headers, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Endpoint is working!")
        else:
            print("❌ Endpoint returned an error")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to microservice. Is it running on localhost:5000?")
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_health_endpoint():
    """Test the health endpoint to see if microservice is running"""
    try:
        url = "http://localhost:5000/health"
        response = requests.get(url, timeout=5)
        
        print(f"Health check - Status Code: {response.status_code}")
        print(f"Health check - Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Microservice is running!")
            return True
        else:
            print("❌ Microservice health check failed")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to microservice health endpoint")
        return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

if __name__ == "__main__":
    print("=== ElectionGuard Microservice Debug ===")
    
    # First check if microservice is running
    if test_health_endpoint():
        print("\n" + "="*50)
        # Then test the partial decryption endpoint
        test_partial_decryption_endpoint()
    else:
        print("\nMicroservice is not accessible. Please check:")
        print("1. Docker containers are running: docker-compose ps")
        print("2. ElectionGuard service is up: docker-compose logs electionguard")
        print("3. Port 5000 is accessible")
