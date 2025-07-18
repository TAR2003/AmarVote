#!/usr/bin/env python

import requests
import json
import random
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from collections import defaultdict

# API Base URL
BASE_URL = "http://localhost:5000"

def test_quorum_election_workflow():
    """Test the complete election workflow with quorum-based decryption."""
    print("=" * 80)
    print("TESTING QUORUM-BASED ELECTION WORKFLOW")
    print("=" * 80)
    
    # 1. Setup Guardians with quorum
    print("\n🔹 STEP 1: Setting up guardians with quorum support")
    setup_data = {
        "number_of_guardians": 5,
        "quorum": 3,  # Only 3 out of 5 guardians needed for decryption
        "party_names": ["Democratic Party", "Republican Party", "Green Party"],
        "candidate_names": ["Alice Johnson", "Bob Smith", "Carol Green"]
    }
    
    setup_response = requests.post(f"{BASE_URL}/setup_guardians", json=setup_data)
    assert setup_response.status_code == 200, f"Guardian setup failed: {setup_response.text}"
    setup_result = setup_response.json()
    
    # Extract key information
    joint_public_key = setup_result['joint_public_key']
    commitment_hash = setup_result['commitment_hash']
    guardian_data = setup_result['guardian_data']
    number_of_guardians = setup_result['number_of_guardians']
    quorum = setup_result['quorum']
    
    print(f"✅ Set up {number_of_guardians} guardians with quorum={quorum}")
    
    # 2. Create encrypted ballots
    print("\n🔹 STEP 2: Creating encrypted ballots")
    
    # Create multiple ballots with different candidate selections
    ballot_data = []
    ballot_choices = [
        "Alice Johnson",
        "Bob Smith", 
        "Carol Green",
        "Alice Johnson",
        "Bob Smith"
    ]
    
    for i, chosen_candidate in enumerate(ballot_choices):
        ballot_request = {
            "party_names": setup_data['party_names'],
            "candidate_names": setup_data['candidate_names'],
            "candidate_name": chosen_candidate,
            "ballot_id": f"ballot-voter-{i+1}",
            "joint_public_key": joint_public_key,
            "commitment_hash": commitment_hash
        }
        
        ballot_response = requests.post(f"{BASE_URL}/create_encrypted_ballot", json=ballot_request)
        assert ballot_response.status_code == 200, f"Ballot encryption failed: {ballot_response.text}"
        
        ballot_result = ballot_response.json()
        ballot_data.append(ballot_result['encrypted_ballot'])
        
        print(f"✅ Encrypted ballot {i+1} for candidate: {chosen_candidate}")
    
    # 3. Tally encrypted ballots
    print("\n🔹 STEP 3: Tallying encrypted ballots")
    
    tally_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "encrypted_ballots": ballot_data
    }
    
    tally_response = requests.post(f"{BASE_URL}/create_encrypted_tally", json=tally_request)
    assert tally_response.status_code == 200, f"Tally creation failed: {tally_response.text}"
    
    tally_result = tally_response.json()
    ciphertext_tally = tally_result['ciphertext_tally']
    submitted_ballots = tally_result['submitted_ballots']
    
    print(f"✅ Tally created with {len(submitted_ballots)} ballots")
    
    # 4. Demonstrate quorum decryption - only use 3 out of 5 guardians
    print("\n🔹 STEP 4: Demonstrating quorum decryption (3 out of 5 guardians)")
    
    # Randomly select 3 guardians out of 5 to participate
    available_guardians = random.sample(guardian_data, quorum)
    missing_guardians = [g for g in guardian_data if g not in available_guardians]
    
    print(f"✅ Selected {len(available_guardians)} available guardians:")
    for g in available_guardians:
        print(f"   - Guardian {g['id']} (sequence {g['sequence_order']})")
    
    print(f"✅ Missing {len(missing_guardians)} guardians (will be compensated):")
    for g in missing_guardians:
        print(f"   - Guardian {g['id']} (sequence {g['sequence_order']})")
    
    # 5. Compute decryption shares for available guardians
    print("\n🔹 STEP 5: Computing decryption shares for available guardians")
    
    available_guardian_shares = {}
    
    for guardian in available_guardians:
        partial_request = {
            "guardian_id": guardian['id'],
            "guardian_data": guardian_data,
            "party_names": setup_data['party_names'],
            "candidate_names": setup_data['candidate_names'],
            "ciphertext_tally": ciphertext_tally,
            "submitted_ballots": submitted_ballots,
            "joint_public_key": joint_public_key,
            "commitment_hash": commitment_hash
        }
        
        partial_response = requests.post(f"{BASE_URL}/create_partial_decryption", json=partial_request)
        assert partial_response.status_code == 200, f"Partial decryption failed for guardian {guardian['id']}: {partial_response.text}"
        
        partial_result = partial_response.json()
        available_guardian_shares[guardian['id']] = {
            'guardian_public_key': partial_result['guardian_public_key'],
            'tally_share': partial_result['tally_share'],
            'ballot_shares': partial_result['ballot_shares']
        }
        
        print(f"✅ Guardian {guardian['id']} computed decryption shares")
    
    # 6. Compute compensated decryption shares for missing guardians
    print("\n🔹 STEP 6: Computing compensated decryption shares for missing guardians")
    
    compensated_shares = {}
    
    for missing_guardian in missing_guardians:
        compensated_shares[missing_guardian['id']] = {}
        
        for available_guardian in available_guardians:
            compensated_request = {
                "available_guardian_id": available_guardian['id'],
                "missing_guardian_id": missing_guardian['id'],
                "guardian_data": guardian_data,
                "party_names": setup_data['party_names'],
                "candidate_names": setup_data['candidate_names'],
                "ciphertext_tally": ciphertext_tally,
                "submitted_ballots": submitted_ballots,
                "joint_public_key": joint_public_key,
                "commitment_hash": commitment_hash
            }
            
            compensated_response = requests.post(f"{BASE_URL}/create_compensated_decryption", json=compensated_request)
            assert compensated_response.status_code == 200, f"Compensated decryption failed: {compensated_response.text}"
            
            compensated_result = compensated_response.json()
            compensated_shares[missing_guardian['id']][available_guardian['id']] = {
                'compensated_tally_share': compensated_result['compensated_tally_share'],
                'compensated_ballot_shares': compensated_result['compensated_ballot_shares']
            }
            
            print(f"✅ Guardian {available_guardian['id']} computed compensated shares for missing guardian {missing_guardian['id']}")
    
    # 7. Combine all shares to get final results
    print("\n🔹 STEP 7: Combining shares to get final results")
    
    combine_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "ciphertext_tally": ciphertext_tally,
        "submitted_ballots": submitted_ballots,
        "guardian_data": guardian_data,
        "available_guardian_shares": available_guardian_shares,
        "compensated_shares": compensated_shares,
        "quorum": quorum
    }
    
    combine_response = requests.post(f"{BASE_URL}/combine_decryption_shares", json=combine_request)
    
    if combine_response.status_code != 200:
        print(f"❌ Share combination failed: {combine_response.text}")
        return False
    
    combine_result = combine_response.json()
    results = combine_result['results']
    
    print(f"✅ Successfully decrypted election with {quorum} out of {number_of_guardians} guardians")
    
    # 8. Display final results
    print("\n🔹 STEP 8: Final Election Results")
    print("=" * 50)
    
    election_info = results['election']
    print(f"Election: {election_info['name']}")
    print(f"Guardians: {election_info['number_of_guardians']} total, {election_info['quorum']} quorum")
    print(f"Total ballots cast: {results['results']['total_ballots_cast']}")
    print(f"Valid ballots: {results['results']['total_valid_ballots']}")
    print(f"Spoiled ballots: {results['results']['total_spoiled_ballots']}")
    
    print("\n📊 Candidate Vote Counts:")
    for candidate, result in results['results']['candidates'].items():
        print(f"   {candidate}: {result['votes']} votes ({result['percentage']}%)")
    
    print("\n🔒 Guardian Verification:")
    for guardian in results['verification']['guardians']:
        print(f"   Guardian {guardian['id']}: {guardian['status']}")
    
    print(f"\n✅ Quorum-based decryption test completed successfully!")
    print(f"✅ Used {len(available_guardians)} out of {number_of_guardians} guardians")
    
    return True

def test_api_health():
    """Test the API health endpoint."""
    print("\n🔹 Testing API Health")
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200, f"Health check failed: {response.text}"
    print("✅ API is healthy")

def main():
    """Run all tests."""
    print("Starting Quorum-based Election Tests...")
    
    # Test API health first
    test_api_health()
    
    # Test the main workflow
    try:
        success = test_quorum_election_workflow()
        if success:
            print("\n🎉 ALL TESTS PASSED! 🎉")
        else:
            print("\n❌ Some tests failed")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
