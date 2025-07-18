#!/usr/bin/env python

import requests
import json

# API Base URL
BASE_URL = "http://localhost:5000"

def test_new_api_structure():
    """Test the new API structure with separated keys and polynomials."""
    print("=" * 80)
    print("TESTING NEW API STRUCTURE")
    print("=" * 80)
    
    # 1. Setup Guardians
    print("\n🔹 STEP 1: Setting up guardians")
    setup_data = {
        "number_of_guardians": 3,
        "quorum": 2,
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate X", "Candidate Y"]
    }
    
    setup_response = requests.post(f"{BASE_URL}/setup_guardians", json=setup_data)
    assert setup_response.status_code == 200, f"Guardian setup failed: {setup_response.text}"
    setup_result = setup_response.json()
    
    print(f"✅ Status: {setup_result.get('status')}")
    print(f"✅ Guardian data: {len(setup_result.get('guardian_data', []))} guardians")
    print(f"✅ Private keys: {len(setup_result.get('private_keys', []))} keys")
    print(f"✅ Public keys: {len(setup_result.get('public_keys', []))} keys")
    print(f"✅ Polynomials: {len(setup_result.get('polynomials', []))} polynomials")
    
    # Extract data
    joint_public_key = setup_result['joint_public_key']
    commitment_hash = setup_result['commitment_hash']
    guardian_data = setup_result['guardian_data']
    private_keys = setup_result['private_keys']
    public_keys = setup_result['public_keys']
    polynomials = setup_result['polynomials']
    
    # 2. Create a test ballot
    print("\n🔹 STEP 2: Creating encrypted ballot")
    ballot_request = {
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "candidate_name": "Candidate X",
        "ballot_id": "test-ballot-1",
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash
    }
    
    ballot_response = requests.post(f"{BASE_URL}/create_encrypted_ballot", json=ballot_request)
    assert ballot_response.status_code == 200, f"Ballot creation failed: {ballot_response.text}"
    ballot_result = ballot_response.json()
    
    print(f"✅ Ballot created: {ballot_result.get('status')}")
    
    # 3. Create tally
    print("\n🔹 STEP 3: Creating encrypted tally")
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
    
    print(f"✅ Tally created: {tally_result.get('status')}")
    
    # 4. Test partial decryption with new structure
    print("\n🔹 STEP 4: Testing partial decryption")
    partial_request = {
        "guardian_id": guardian_data[0]['id'],
        "guardian_data": guardian_data,
        "private_keys": private_keys,
        "public_keys": public_keys,
        "polynomials": polynomials,
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "ciphertext_tally": tally_result['ciphertext_tally'],
        "submitted_ballots": tally_result['submitted_ballots'],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash
    }
    
    partial_response = requests.post(f"{BASE_URL}/create_partial_decryption", json=partial_request)
    assert partial_response.status_code == 200, f"Partial decryption failed: {partial_response.text}"
    partial_result = partial_response.json()
    
    print(f"✅ Partial decryption: {partial_result.get('status')}")
    
    # 5. Test compensated decryption with new structure
    print("\n🔹 STEP 5: Testing compensated decryption")
    compensated_request = {
        "available_guardian_id": guardian_data[0]['id'],
        "missing_guardian_id": guardian_data[1]['id'],
        "guardian_data": guardian_data,
        "private_keys": private_keys,
        "public_keys": public_keys,
        "polynomials": polynomials,
        "party_names": setup_data['party_names'],
        "candidate_names": setup_data['candidate_names'],
        "ciphertext_tally": tally_result['ciphertext_tally'],
        "submitted_ballots": tally_result['submitted_ballots'],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash
    }
    
    compensated_response = requests.post(f"{BASE_URL}/create_compensated_decryption", json=compensated_request)
    assert compensated_response.status_code == 200, f"Compensated decryption failed: {compensated_response.text}"
    compensated_result = compensated_response.json()
    
    print(f"✅ Compensated decryption: {compensated_result.get('status')}")
    
    print("\n✅ ALL NEW API STRUCTURE TESTS PASSED!")
    print("=" * 80)

if __name__ == "__main__":
    try:
        test_new_api_structure()
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
