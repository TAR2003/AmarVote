import pytest
import json
import sys
import os
from typing import Dict, Any

# Add the parent directory to the path so we can import from Microservice
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app

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
    guardian_data = setup_result['guardian_data']
    private_keys = setup_result['private_keys']
    public_keys = setup_result['public_keys']
    polynomials = setup_result['polynomials']

    # Create encrypted ballots (example, not executed)
    # ballot_data_1 = {
    #     "party_names": ["Party A", "Party B"],
    #     "candidate_names": ["Candidate 1", "Candidate 2"],
    #     "candidate_name": "Candidate 1",
    #     "ballot_id": "ballot-masnoon",
    #     "joint_public_key": joint_public_key,
    #     "commitment_hash": commitment_hash,
    #     "number_of_guardians": 3,
    #     "quorum": 3
    # }
    # ballot_response_1 = client.post('/create_encrypted_ballot', json=ballot_data_1)
    # assert ballot_response_1.status_code == 200
    # ballot_result_1 = ballot_response_1.get_json()
    # assert ballot_result_1['status'] == 'success'
    # assert isinstance(ballot_result_1['encrypted_ballot'], str)
    # assert isinstance(ballot_result_1['ballot_hash'], str)