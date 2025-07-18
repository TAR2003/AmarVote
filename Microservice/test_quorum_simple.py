#!/usr/bin/env python
"""
Quick comparison test to show the difference between old (all guardians required) 
and new (quorum-based) decryption approaches.
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def test_quorum_vs_all_guardians():
    """Demonstrate the difference between quorum and all-guardian decryption."""
    
    print("=" * 80)
    print("QUORUM vs ALL-GUARDIANS DECRYPTION COMPARISON")
    print("=" * 80)
    
    # Setup: 5 guardians, 3 quorum
    setup_data = {
        "number_of_guardians": 5,
        "quorum": 3,
        "party_names": ["Democratic", "Republican"],
        "candidate_names": ["Alice", "Bob"]
    }
    
    print(f"Setting up: {setup_data['number_of_guardians']} guardians, {setup_data['quorum']} quorum")
    
    response = requests.post(f"{BASE_URL}/setup_guardians", json=setup_data)
    if response.status_code != 200:
        print(f"❌ Setup failed: {response.text}")
        return
    
    result = response.json()
    guardian_data = result['guardian_data']
    
    print(f"✅ Election setup complete")
    print(f"   - Total guardians: {len(guardian_data)}")
    print(f"   - Quorum needed: {setup_data['quorum']}")
    
    # Create a test ballot
    ballot_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "candidate_name": "Alice",
        "ballot_id": "test-ballot",
        "joint_public_key": result['joint_public_key'],
        "commitment_hash": result['commitment_hash']
    }
    
    ballot_response = requests.post(f"{BASE_URL}/create_encrypted_ballot", json=ballot_request)
    if ballot_response.status_code != 200:
        print(f"❌ Ballot creation failed: {ballot_response.text}")
        return
    
    ballot_result = ballot_response.json()
    
    # Create tally
    tally_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "joint_public_key": result['joint_public_key'],
        "commitment_hash": result['commitment_hash'],
        "encrypted_ballots": [ballot_result['encrypted_ballot']]
    }
    
    tally_response = requests.post(f"{BASE_URL}/create_encrypted_tally", json=tally_request)
    if tally_response.status_code != 200:
        print(f"❌ Tally creation failed: {tally_response.text}")
        return
    
    tally_result = tally_response.json()
    
    print(f"✅ Ballot encrypted and tallied")
    
    # Scenario 1: Only 3 guardians available (quorum) - NEW APPROACH
    print("\n🔹 SCENARIO 1: Quorum-based decryption (3 out of 5 guardians)")
    available_guardians = guardian_data[:3]  # First 3 guardians
    missing_guardians = guardian_data[3:]    # Last 2 guardians
    
    print(f"Available guardians: {[g['id'] for g in available_guardians]}")
    print(f"Missing guardians: {[g['id'] for g in missing_guardians]}")
    
    # Get shares from available guardians
    available_shares = {}
    for guardian in available_guardians:
        partial_request = {
            "guardian_id": guardian['id'],
            "guardian_data": guardian_data,
            "party_names": setup_data['party_names'],
            "candidate_names": setup_data['candidate_names'],
            "ciphertext_tally": tally_result['ciphertext_tally'],
            "submitted_ballots": tally_result['submitted_ballots'],
            "joint_public_key": result['joint_public_key'],
            "commitment_hash": result['commitment_hash']
        }
        
        partial_response = requests.post(f"{BASE_URL}/create_partial_decryption", json=partial_request)
        if partial_response.status_code != 200:
            print(f"❌ Partial decryption failed: {partial_response.text}")
            return
        
        partial_result = partial_response.json()
        available_shares[guardian['id']] = {
            'guardian_public_key': partial_result['guardian_public_key'],
            'tally_share': partial_result['tally_share'],
            'ballot_shares': partial_result['ballot_shares']
        }
    
    # Get compensated shares for missing guardians
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
                "ciphertext_tally": tally_result['ciphertext_tally'],
                "submitted_ballots": tally_result['submitted_ballots'],
                "joint_public_key": result['joint_public_key'],
                "commitment_hash": result['commitment_hash']
            }
            
            compensated_response = requests.post(f"{BASE_URL}/create_compensated_decryption", json=compensated_request)
            if compensated_response.status_code != 200:
                print(f"❌ Compensated decryption failed: {compensated_response.text}")
                return
            
            compensated_result = compensated_response.json()
            compensated_shares[missing_guardian['id']][available_guardian['id']] = {
                'compensated_tally_share': compensated_result['compensated_tally_share'],
                'compensated_ballot_shares': compensated_result['compensated_ballot_shares']
            }
    
    # Combine shares
    combine_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "joint_public_key": result['joint_public_key'],
        "commitment_hash": result['commitment_hash'],
        "ciphertext_tally": tally_result['ciphertext_tally'],
        "submitted_ballots": tally_result['submitted_ballots'],
        "guardian_data": guardian_data,
        "available_guardian_shares": available_shares,
        "compensated_shares": compensated_shares,
        "quorum": setup_data['quorum']
    }
    
    combine_response = requests.post(f"{BASE_URL}/combine_decryption_shares", json=combine_request)
    if combine_response.status_code == 200:
        combine_result = combine_response.json()
        results = combine_result['results']
        
        print("✅ SUCCESS: Quorum-based decryption worked!")
        print(f"   - Used {len(available_guardians)} out of {len(guardian_data)} guardians")
        print(f"   - Results: Alice = {results['results']['candidates']['Alice']['votes']} votes")
        print(f"   - Results: Bob = {results['results']['candidates']['Bob']['votes']} votes")
        print(f"   - This is the NEW APPROACH - only quorum needed!")
    else:
        print(f"❌ Quorum-based decryption failed: {combine_response.text}")
    
    print("\n🔹 SCENARIO 2: What the old approach would require")
    print("❌ OLD APPROACH: Would need ALL 5 guardians to be present")
    print("❌ If any guardian is missing, election cannot be decrypted")
    print("❌ This is the problem we solved with quorum-based decryption!")
    
    print("\n" + "=" * 80)
    print("SUMMARY:")
    print("✅ NEW: Only 3 out of 5 guardians needed (quorum)")
    print("❌ OLD: All 5 guardians required (single point of failure)")
    print("✅ NEW: Uses ElectionGuard's compensated decryption and Lagrange coefficients")
    print("✅ NEW: Provides cryptographic security with practical resilience")
    print("=" * 80)

if __name__ == "__main__":
    test_quorum_vs_all_guardians()
