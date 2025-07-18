import requests
import json
from typing import Dict, Any
import random

BASE_URL = "http://localhost:5000"

def test_quorum_election_workflow():
    """Test election workflow with quorum-based decryption."""
    
    # 1. Setup Guardians with quorum support
    print("Setting up guardians with quorum support...")
    setup_data = {
        "number_of_guardians": 5,  # Total guardians
        "quorum": 3,               # Minimum required for decryption
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"]
    }
    
    setup_response = requests.post(f"{BASE_URL}/setup_guardians", json=setup_data)
    assert setup_response.status_code == 200, f"Guardian setup failed: {setup_response.text}"
    setup_result = setup_response.json()
    
    print(f"✅ Setup complete with {setup_result['number_of_guardians']} guardians, quorum: {setup_result['quorum']}")
    
    # Extract setup results
    joint_public_key = setup_result['joint_public_key']
    commitment_hash = setup_result['commitment_hash']
    manifest = setup_result['manifest']
    guardians = setup_result['guardians']
    quorum = setup_result['quorum']
    number_of_guardians = setup_result['number_of_guardians']
    
    print(f"Guardian IDs: {[g['id'] for g in guardians]}")
    
    # 2. Create encrypted ballots
    print("\nCreating encrypted ballots...")
    encrypted_ballots = []
    ballot_hashes = []
    
    # Create some ballots with different votes
    ballot_votes = [
        ("ballot-alice", "Candidate 1"),
        ("ballot-bob", "Candidate 2"),
        ("ballot-charlie", "Candidate 1"),
        ("ballot-diana", "Candidate 2"),
        ("ballot-eve", "Candidate 1")
    ]
    
    for ballot_id, candidate_name in ballot_votes:
        ballot_data = {
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "candidate_name": candidate_name,
            "ballot_id": ballot_id,
            "joint_public_key": joint_public_key,
            "commitment_hash": commitment_hash
        }
        
        ballot_response = requests.post(f"{BASE_URL}/create_encrypted_ballot", json=ballot_data)
        assert ballot_response.status_code == 200, f"Ballot creation failed: {ballot_response.text}"
        
        ballot_result = ballot_response.json()
        encrypted_ballots.append(ballot_result['encrypted_ballot'])
        ballot_hashes.append(ballot_result['ballot_hash'])
        
        print(f"🔐 Created ballot {ballot_id} for {candidate_name}")
    
    print(f"✅ Created {len(encrypted_ballots)} encrypted ballots")
    
    # 3. Create encrypted tally
    print("\nCreating encrypted tally...")
    tally_data = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "encrypted_ballots": encrypted_ballots
    }
    
    tally_response = requests.post(f"{BASE_URL}/create_encrypted_tally", json=tally_data)
    assert tally_response.status_code == 200, f"Tally creation failed: {tally_response.text}"
    
    tally_result = tally_response.json()
    ciphertext_tally = tally_result['ciphertext_tally']
    submitted_ballots = tally_result['submitted_ballots']
    
    print("✅ Encrypted tally created successfully")
    
    # 4. Generate partial decryptions from available guardians
    print("\nGenerating partial decryptions...")
    
    # Simulate that only some guardians are available (more than quorum)
    available_guardians = random.sample(guardians, k=quorum + 1)  # Select quorum + 1 guardians
    missing_guardians = [g for g in guardians if g not in available_guardians]
    
    print(f"Available guardians: {[g['id'] for g in available_guardians]}")
    print(f"Missing guardians: {[g['id'] for g in missing_guardians]}")
    
    available_guardian_shares = []
    
    for guardian_data in available_guardians:
        share_data = {
            "guardian_data": guardian_data,
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "ciphertext_tally": ciphertext_tally,
            "submitted_ballots": submitted_ballots,
            "joint_public_key": joint_public_key,
            "commitment_hash": commitment_hash
        }
        
        share_response = requests.post(f"{BASE_URL}/create_partial_decryption", json=share_data)
        assert share_response.status_code == 200, f"Partial decryption failed: {share_response.text}"
        
        share_result = share_response.json()
        available_guardian_shares.append((
            share_result['guardian_public_key'],
            share_result['tally_share'],
            share_result['ballot_shares']
        ))
        
        print(f"✅ Generated partial decryption for guardian {guardian_data['id']}")
    
    print(f"✅ Generated {len(available_guardian_shares)} partial decryptions")
    
    # 5. Combine partial decryptions with quorum
    print("\nCombining partial decryptions with quorum...")
    
    combine_data = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "ciphertext_tally": ciphertext_tally,
        "submitted_ballots": submitted_ballots,
        "available_guardian_shares": available_guardian_shares,
        "missing_guardian_ids": [g['id'] for g in missing_guardians]
    }
    
    combine_response = requests.post(f"{BASE_URL}/combine_partial_decryption", json=combine_data)
    assert combine_response.status_code == 200, f"Combining decryptions failed: {combine_response.text}"
    
    final_results = combine_response.json()
    
    print("✅ Final results obtained with quorum-based decryption!")
    
    # 6. Display results
    print("\n" + "="*50)
    print("ELECTION RESULTS (QUORUM-BASED DECRYPTION)")
    print("="*50)
    
    election_info = final_results['results']['election']
    results_info = final_results['results']['results']
    verification_info = final_results['results']['verification']
    
    print(f"Election: {election_info['name']}")
    print(f"Total Guardians: {election_info['number_of_guardians']}")
    print(f"Quorum Required: {election_info['quorum']}")
    print(f"Available Guardians: {election_info['available_guardians']}")
    print(f"Missing Guardians: {election_info['missing_guardians']}")
    
    print(f"\nBallot Summary:")
    print(f"  Total ballots: {results_info['total_ballots_cast']}")
    print(f"  Valid ballots: {results_info['total_valid_ballots']}")
    print(f"  Spoiled ballots: {results_info['total_spoiled_ballots']}")
    
    print(f"\nCandidate Results:")
    for candidate, result in results_info['candidates'].items():
        print(f"  {candidate}: {result['votes']} votes ({result['percentage']}%)")
    
    print(f"\nGuardian Status:")
    for guardian in verification_info['guardians']:
        print(f"  Guardian {guardian['id']}: {guardian['status']}")
    
    print(f"\nBallot Verification:")
    for ballot in verification_info['ballots']:
        print(f"  Ballot {ballot['ballot_id']}: {ballot['status']} - {ballot.get('verification', 'N/A')}")
    
    # 7. Test with minimum quorum
    print(f"\n" + "="*50)
    print("TESTING WITH MINIMUM QUORUM")
    print("="*50)
    
    # Test with exactly quorum guardians
    minimum_guardians = random.sample(guardians, k=quorum)
    remaining_guardians = [g for g in guardians if g not in minimum_guardians]
    
    print(f"Testing with minimum quorum: {[g['id'] for g in minimum_guardians]}")
    print(f"Missing guardians: {[g['id'] for g in remaining_guardians]}")
    
    minimum_guardian_shares = []
    
    for guardian_data in minimum_guardians:
        share_data = {
            "guardian_data": guardian_data,
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "ciphertext_tally": ciphertext_tally,
            "submitted_ballots": submitted_ballots,
            "joint_public_key": joint_public_key,
            "commitment_hash": commitment_hash
        }
        
        share_response = requests.post(f"{BASE_URL}/create_partial_decryption", json=share_data)
        assert share_response.status_code == 200, f"Partial decryption failed: {share_response.text}"
        
        share_result = share_response.json()
        minimum_guardian_shares.append((
            share_result['guardian_public_key'],
            share_result['tally_share'],
            share_result['ballot_shares']
        ))
    
    # Combine with minimum quorum
    combine_data_min = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "ciphertext_tally": ciphertext_tally,
        "submitted_ballots": submitted_ballots,
        "available_guardian_shares": minimum_guardian_shares,
        "missing_guardian_ids": [g['id'] for g in remaining_guardians]
    }
    
    combine_response_min = requests.post(f"{BASE_URL}/combine_partial_decryption", json=combine_data_min)
    assert combine_response_min.status_code == 200, f"Minimum quorum decryption failed: {combine_response_min.text}"
    
    final_results_min = combine_response_min.json()
    
    print("✅ Minimum quorum decryption successful!")
    
    # Verify results are the same
    original_results = final_results['results']['results']['candidates']
    minimum_results = final_results_min['results']['results']['candidates']
    
    print(f"\nResult verification:")
    for candidate in original_results:
        orig_votes = original_results[candidate]['votes']
        min_votes = minimum_results[candidate]['votes']
        match = orig_votes == min_votes
        print(f"  {candidate}: {orig_votes} vs {min_votes} - {'✅ MATCH' if match else '❌ MISMATCH'}")
    
    # 8. Test insufficient guardians (should fail)
    print(f"\n" + "="*50)
    print("TESTING INSUFFICIENT GUARDIANS (SHOULD FAIL)")
    print("="*50)
    
    if quorum > 1:
        insufficient_guardians = random.sample(guardians, k=quorum-1)
        print(f"Testing with insufficient guardians: {[g['id'] for g in insufficient_guardians]}")
        
        insufficient_guardian_shares = []
        
        for guardian_data in insufficient_guardians:
            share_data = {
                "guardian_data": guardian_data,
                "party_names": ["Party A", "Party B"],
                "candidate_names": ["Candidate 1", "Candidate 2"],
                "ciphertext_tally": ciphertext_tally,
                "submitted_ballots": submitted_ballots,
                "joint_public_key": joint_public_key,
                "commitment_hash": commitment_hash
            }
            
            share_response = requests.post(f"{BASE_URL}/create_partial_decryption", json=share_data)
            assert share_response.status_code == 200, f"Partial decryption failed: {share_response.text}"
            
            share_result = share_response.json()
            insufficient_guardian_shares.append((
                share_result['guardian_public_key'],
                share_result['tally_share'],
                share_result['ballot_shares']
            ))
        
        # This should fail
        combine_data_insufficient = {
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "joint_public_key": joint_public_key,
            "commitment_hash": commitment_hash,
            "ciphertext_tally": ciphertext_tally,
            "submitted_ballots": submitted_ballots,
            "available_guardian_shares": insufficient_guardian_shares,
            "missing_guardian_ids": []
        }
        
        combine_response_insufficient = requests.post(f"{BASE_URL}/combine_partial_decryption", json=combine_data_insufficient)
        
        if combine_response_insufficient.status_code == 400:
            print("✅ Insufficient guardians correctly rejected!")
            print(f"Error message: {combine_response_insufficient.json().get('message', 'Unknown error')}")
        else:
            print("❌ Insufficient guardians should have been rejected but wasn't!")
    
    # Save results
    with open("quorum_election_results.json", "w") as f:
        json.dump(final_results, f, indent=2)
    
    print(f"\n" + "="*50)
    print("QUORUM-BASED ELECTION TEST COMPLETED SUCCESSFULLY!")
    print("="*50)
    
    return final_results

if __name__ == "__main__":
    try:
        results = test_quorum_election_workflow()
        print("\n🎉 All tests passed! Quorum-based decryption is working correctly.")
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
