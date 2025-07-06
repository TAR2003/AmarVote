import pytest
import json
from typing import Dict, Any
from Microservice.api import app
# from Mincrapi import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_election_workflow(client):
    # 1. Setup Guardians
    setup_data = {
        "number_of_guardians": 3,
        "quorum": 3,
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"]
    }
    setup_response = client.post('/setup_guardians', json=setup_data)
    assert setup_response.status_code == 200, "Guardian setup failed"
    setup_result = setup_response.get_json()
    
    number_of_guardians = 3

    joint_public_key = setup_result['joint_public_key']
    commitment_hash = setup_result['commitment_hash']
    manifest = setup_result['manifest']
    guardian_public_keys = setup_result['guardian_public_keys']
    guardian_private_keys = setup_result['guardian_private_keys']
    guardian_polynomials = setup_result['guardian_polynomials']
    
    # # print(f"Joint public key: {joint_public_key}")
    # # print(f"Commitment hash: {commitment_hash}")
    # # print(f"Manifest: {manifest}")
    # # print(f"Guardian public keys: {guardian_public_keys}")
    # # print(f"Guardian private keys: {guardian_private_keys}")
    # # print(f"Guardian polynomials: {guardian_polynomials}")
    # print("\nCreating encrypted ballots...")
    encrypted_ballots = []
    ballot_hashes = []
    
    
    ballot_data = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "candidate_name": "Candidate 1",
        "ballot_id": f"ballot-masnoon",
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash
    }
    ballot_response = client.post('/create_encrypted_ballot', json=ballot_data)
    assert ballot_response.status_code == 200, "Ballot creation failed"
    ballot_result = ballot_response.get_json()
    encrypted_ballots.append(ballot_result['encrypted_ballot'])
    ballot_hashes.append(ballot_result['ballot_hash'])
    # # print(f"{ballot_result}")
    
    

    
    ballot_data = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "candidate_name": "Candidate 2",
        "ballot_id": f"ballot-tawkir",
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash
    }
    ballot_response = client.post('/create_encrypted_ballot', json=ballot_data)
    assert ballot_response.status_code == 200, "Ballot creation failed"
    ballot_result = ballot_response.get_json()
    encrypted_ballots.append(ballot_result['encrypted_ballot'])
    ballot_hashes.append(ballot_result['ballot_hash'])

    for i in range(len(encrypted_ballots)):
        enc  = json.loads(encrypted_ballots[i])
        # print(f"🔐 Ballot ID: {enc['object_id']}, Encrypted Hash: {ballot_hashes[i]}")
    
    
    tally_data = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "encrypted_ballots": encrypted_ballots
    }
    tally_response = client.post('/create_encrypted_tally', json=tally_data)
    assert tally_response.status_code == 200, "Tally creation failed"
    tally_result = tally_response.get_json()
    ciphertext_tally = tally_result['ciphertext_tally']
    submitted_ballots = tally_result['submitted_ballots']
    # # print(tally_result)
    
    

    # guardian_shares = []
    guardian_public_keys_array = []
    tally_shares = []
    ballot_shares = []

    
    for i in range(setup_data['number_of_guardians']):
        guardian_data = {
            "guardian_id": str(i+1),
            "sequence_order": i+1,
            "guardian_public_key": guardian_public_keys[i],
            "guardian_private_key": guardian_private_keys[i],
            "guardian_polynomial": guardian_polynomials[i],
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "ciphertext_tally": ciphertext_tally,
            "submitted_ballots": submitted_ballots,
            "joint_public_key": joint_public_key,
            "commitment_hash": commitment_hash,
            "number_of_guardians": setup_data['number_of_guardians']
        }
        share_response = client.post('/create_partial_decryption', json=guardian_data)
        assert share_response.status_code == 200, "Partial decryption failed"
        share_result = share_response.get_json()
        guardian_public_keys_array.append(share_result['guardian_public_key'])
        tally_shares.append(share_result['tally_share'])
        ballot_shares.append(share_result['ballot_shares'])
        # # print(f"Created partial decryption for guardian {i+1}")
        
    
    # 5. Combine decryptions and get results
    # print("\nCombining decryptions...")
    combine_data = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "joint_public_key": joint_public_key,
        "commitment_hash": commitment_hash,
        "ciphertext_tally": ciphertext_tally,
        "submitted_ballots": submitted_ballots,
        "guardian_public_keys": guardian_public_keys_array,
        "tally_shares": tally_shares,
        "ballot_shares": ballot_shares,
    }
    # print("Data to combine:")
    # # print(json.dumps(combine_data, indent=2))

    combine_response = client.post('/combine_partial_decryption', json=combine_data)
    assert combine_response.status_code == 200, "Combining decryptions failed"
    final_results = combine_response.get_json()
    # print("Final results obtained!")
    # # print(combine_response.json())
    
    
    # print("\n=== ELECTION RESULTS ===")
    # # print(f"Total ballots cast: {final_results['results']['total_ballots_cast']}")
    # print(f"Valid ballots: {final_results['results']['results']['total_valid_ballots']}")
    # print(f"Spoiled ballots: {final_results['results']['results']['total_spoiled_ballots']}")
    
    # print("\nCandidate Results:")
    # for candidate, result in final_results['results']['results']['candidates'].items():
        # print(f"{candidate}: {result['votes']} votes ({result['percentage']}%)")
    
    # print("\nVerification Status:")
    # for ballot in final_results['results']['verification']['ballots']:
        # print(f"Hash for ballot {ballot['ballot_id']}: {ballot['decrypted_hash']}")
        # print(f"Ballot {ballot['ballot_id']}: {ballot['status']} - Verification: {ballot.get('verification', 'N/A')}")
    
    return final_results

if __name__ == "__main__":
    # Create a test client for standalone execution
    app.config['TESTING'] = True
    with app.test_client() as test_client:
        results = test_election_workflow(test_client)
        
        # with open("election_results.json", "w") as f:
        #     json.dump(results, f, indent=2)