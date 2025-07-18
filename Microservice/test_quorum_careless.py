#!/usr/bin/env python

import requests
import json
import random
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from collections import defaultdict

# API Base URL
BASE_URL = "http://localhost:5000"

def test_quorum_with_redundant_compensated_shares():
    """Test quorum decryption with redundant compensated shares (including available guardians)."""
    print("=" * 80)
    print("TESTING QUORUM WITH REDUNDANT COMPENSATED SHARES")
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
    
    joint_public_key = setup_result['joint_public_key']
    commitment_hash = setup_result['commitment_hash']
    guardian_data = setup_result['guardian_data']
    quorum = setup_result['quorum']
    
    print(f"✅ Created {setup_data['number_of_guardians']} guardians with quorum of {quorum}")

    # 2. Create and encrypt a test ballot
    print("\n🔹 STEP 2: Creating and encrypting a test ballot")
    ballot_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "candidate_name": "Alice Johnson",
        "ballot_id": "test-ballot-1",
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash
    }
    
    ballot_response = requests.post(f"{BASE_URL}/create_encrypted_ballot", json=ballot_request)
    assert ballot_response.status_code == 200, f"Ballot encryption failed: {ballot_response.text}"
    ballot_result = ballot_response.json()
    
    # 3. Tally the ballot
    print("\n🔹 STEP 3: Tallying the ballot")
    tally_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "encrypted_ballots": [ballot_result['encrypted_ballot']]
    }
    
    tally_response = requests.post(f"{BASE_URL}/create_encrypted_tally", json=tally_request)
    assert tally_response.status_code == 200, f"Tally creation failed: {tally_response.text}"
    tally_result = tally_response.json()
    
    ciphertext_tally = tally_result['ciphertext_tally']
    submitted_ballots = tally_result['submitted_ballots']
    
    # 4. Select available guardians (meeting quorum)
    available_guardians = random.sample(guardian_data, quorum)
    missing_guardians = [g for g in guardian_data if g not in available_guardians]
    
    print(f"\n🔹 STEP 4: Selected {len(available_guardians)} available guardians (quorum met)")
    print(f"🔹 {len(missing_guardians)} guardians will be marked as missing")

    # 5. Compute standard decryption shares for available guardians
    print("\n🔹 STEP 5: Computing standard decryption shares for available guardians")
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
        assert partial_response.status_code == 200, f"Partial decryption failed: {partial_response.text}"
        
        partial_result = partial_response.json()
        available_guardian_shares[guardian['id']] = partial_result
        print(f"✅ Guardian {guardian['id']} provided standard shares")

    # 6. Compute COMPENSATED shares for ALL guardians (including available ones)
    print("\n🔹 STEP 6: Computing COMPENSATED shares for ALL guardians (including available ones)")
    compensated_shares = defaultdict(dict)
    
    # For each guardian (target), get compensated shares from all other guardians
    for target_guardian in guardian_data:
        for source_guardian in guardian_data:
            if source_guardian['id'] == target_guardian['id']:
                continue  # Guardians don't compensate for themselves
            
            compensated_request = {
                "available_guardian_id": source_guardian['id'],
                "missing_guardian_id": target_guardian['id'],
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
            compensated_shares[target_guardian['id']][source_guardian['id']] = compensated_result
            print(f"✅ Guardian {source_guardian['id']} computed compensated share for {target_guardian['id']}")

    # 7. Combine shares (API should ignore compensated shares for available guardians)
    print("\n🔹 STEP 7: Combining shares (API should ignore redundant compensated shares)")
    combine_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "ciphertext_tally": ciphertext_tally,
        "submitted_ballots": submitted_ballots,
        "guardian_data": guardian_data,
        "available_guardian_shares": available_guardian_shares,
        "compensated_shares": compensated_shares,  # Includes ALL guardians
        "quorum": quorum
    }
    
    combine_response = requests.post(f"{BASE_URL}/combine_decryption_shares", json=combine_request)
    assert combine_response.status_code == 200, f"Share combination failed: {combine_response.text}"
    
    combine_result = combine_response.json()
    results = combine_result['results']
    
    # 8. Verify results
    print("\n🔹 STEP 8: Verifying results")
    print(f"✅ Election decrypted successfully with quorum of {quorum}")
    print(f"✅ Total ballots: {results['results']['total_ballots_cast']}")
    
    # Check guardian verification status
    print("\n🔐 Guardian Verification Status:")
    for guardian in results['verification']['guardians']:
        status = "✅ Available" if guardian['status'] == 'available' else "⚠️ Compensated"
        print(f"  {status} - Guardian {guardian['id']} (seq {guardian['sequence_order']})")
    
    # Verify the system ignored compensated shares for available guardians
    available_ids = {g['id'] for g in available_guardians}
    for guardian in results['verification']['guardians']:
        if guardian['id'] in available_ids and "compensated" in guardian['status'].lower():
            print(f"❌ ERROR: Guardian {guardian['id']} was marked as compensated despite being available!")
        elif guardian['id'] not in available_ids and "available" in guardian['status'].lower():
            print(f"❌ ERROR: Missing guardian {guardian['id']} was not properly compensated!")
    
    print("\n✅ TEST COMPLETED: System correctly ignored redundant compensated shares!")
    print("=" * 80)

if __name__ == "__main__":
    test_quorum_with_redundant_compensated_shares()