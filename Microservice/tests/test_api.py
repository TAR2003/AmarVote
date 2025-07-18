import pytest
import sys
import os

# Add the parent directory to the path so we can import from Microservice
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'

def test_setup_guardians(client):
    payload = {
        "number_of_guardians": 3,
        "quorum": 2,
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"]
    }
    response = client.post('/setup_guardians', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert isinstance(data['joint_public_key'], str)
    assert isinstance(data['commitment_hash'], str)
    assert isinstance(data['manifest'], str)
    assert isinstance(data['guardian_data'], list)
    assert isinstance(data['private_keys'], list)
    assert isinstance(data['public_keys'], list)
    assert isinstance(data['polynomials'], list)
    assert data['number_of_guardians'] == 3
    assert data['quorum'] == 2

def test_create_encrypted_ballot(client):
    # First, setup guardians to get required keys
    setup_payload = {
        "number_of_guardians": 3,
        "quorum": 2,
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"]
    }
    setup_response = client.post('/setup_guardians', json=setup_payload)
    setup_data = setup_response.get_json()
    ballot_payload = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "candidate_name": "Candidate 1",
        "ballot_id": "ballot-1",
        "joint_public_key": setup_data['joint_public_key'],
        "commitment_hash": setup_data['commitment_hash'],
        "number_of_guardians": 3,
        "quorum": 2
    }
    response = client.post('/create_encrypted_ballot', json=ballot_payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert isinstance(data['encrypted_ballot'], str)
    assert isinstance(data['ballot_hash'], str)