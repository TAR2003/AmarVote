import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    response = client.get('/health')
    assert response.status_code == 200
    result = response.get_json()
    assert result is not None
    assert result['status'] == 'healthy'

def test_setup_guardians(client):
    setup_data = {
        "number_of_guardians": 3,
        "quorum": 2,
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"]
    }
    response = client.post('/setup_guardians', json=setup_data)
    assert response.status_code == 200
    result = response.get_json()
    assert result is not None
    assert result['status'] == 'success'
    for field in [
        'joint_public_key', 'commitment_hash', 'manifest',
        'guardian_data', 'private_keys', 'public_keys', 'polynomials',
        'number_of_guardians', 'quorum']:
        assert field in result
    assert isinstance(result['joint_public_key'], str)
    assert isinstance(result['commitment_hash'], str)
    assert isinstance(result['guardian_data'], list)
    assert isinstance(result['private_keys'], list)
    assert isinstance(result['public_keys'], list)
    assert isinstance(result['polynomials'], list)
    assert result['number_of_guardians'] == 3
    assert result['quorum'] == 2

def test_create_encrypted_ballot(client):
    setup_data = {
        "number_of_guardians": 3,
        "quorum": 2,
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"]
    }
    setup_response = client.post('/setup_guardians', json=setup_data)
    setup_result = setup_response.get_json()
    ballot_data = {
        "party_names": ["Party A", "Party B"],
        "candidate_names": ["Candidate 1", "Candidate 2"],
        "candidate_name": "Candidate 1",
        "ballot_id": "ballot-1",
        "joint_public_key": setup_result['joint_public_key'],
        "commitment_hash": setup_result['commitment_hash'],
        "number_of_guardians": 3,
        "quorum": 2
    }
    response = client.post('/create_encrypted_ballot', json=ballot_data)
    assert response.status_code == 200
    result = response.get_json()
    assert result['status'] == 'success'
    assert isinstance(result['encrypted_ballot'], str)
    assert isinstance(result['ballot_hash'], str)
    # Remove invalid leftover code and class remnants
    
    def test_create_partial_decryption(self, client):
        """Test the create_partial_decryption endpoint."""
        # Setup prerequisites
        tally_result, setup_result = self.test_create_encrypted_tally(client)
        
        # Test partial decryption for first guardian
        guardian_data = {
            "guardian_id": "1",
            "sequence_order": 1,
            "guardian_public_key": setup_result['guardian_public_keys'][0],
            "guardian_private_key": setup_result['guardian_private_keys'][0],
            "guardian_polynomial": setup_result['guardian_polynomials'][0],
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "ciphertext_tally": tally_result['ciphertext_tally'],
            "submitted_ballots": tally_result['submitted_ballots'],
            "joint_public_key": setup_result['joint_public_key'],
            "commitment_hash": setup_result['commitment_hash'],
            "number_of_guardians": 3
        }
        
        response = client.post('/create_partial_decryption', json=guardian_data)
        assert response.status_code == 200, f"Create partial decryption failed with status {response.status_code}"
        
        result = response.get_json()
        assert result is not None, "Create partial decryption should return JSON"
        assert result['status'] == 'success', f"Create partial decryption should succeed, got: {result.get('status')}"
        
        # Check required fields
        required_fields = ['guardian_public_key', 'tally_share', 'ballot_shares']
        for field in required_fields:
            assert field in result, f"Response should contain {field}"
            assert result[field] is not None, f"{field} should not be null"
        
        # Validate data types
        # guardian_public_key can be various types, so we don't assert its specific type
        # tally_share can be various types, so we don't assert its specific type
        assert isinstance(result['ballot_shares'], dict), "ballot_shares should be dict"
        
        print("✓ Create partial decryption endpoint is working correctly")
        return result, tally_result, setup_result
    
    def test_combine_partial_decryption(self, client):
        """Test the combine_partial_decryption endpoint."""
        # Setup prerequisites
        partial_result, tally_result, setup_result = self.test_create_partial_decryption(client)
        
        # Create partial decryptions for all guardians
        guardian_public_keys = []
        tally_shares = []
        ballot_shares = []
        
        for i in range(3):  # 3 guardians
            guardian_data = {
                "guardian_id": str(i + 1),
                "sequence_order": i + 1,
                "guardian_public_key": setup_result['guardian_public_keys'][i],
                "guardian_private_key": setup_result['guardian_private_keys'][i],
                "guardian_polynomial": setup_result['guardian_polynomials'][i],
                "party_names": ["Party A", "Party B"],
                "candidate_names": ["Candidate 1", "Candidate 2"],
                "ciphertext_tally": tally_result['ciphertext_tally'],
                "submitted_ballots": tally_result['submitted_ballots'],
                "joint_public_key": setup_result['joint_public_key'],
                "commitment_hash": setup_result['commitment_hash'],
                "number_of_guardians": 3
            }
            
            share_response = client.post('/create_partial_decryption', json=guardian_data)
            share_result = share_response.get_json()
            
            guardian_public_keys.append(share_result['guardian_public_key'])
            tally_shares.append(share_result['tally_share'])
            ballot_shares.append(share_result['ballot_shares'])
        
        # Combine decryptions
        combine_data = {
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "joint_public_key": setup_result['joint_public_key'],
            "commitment_hash": setup_result['commitment_hash'],
            "ciphertext_tally": tally_result['ciphertext_tally'],
            "submitted_ballots": tally_result['submitted_ballots'],
            "guardian_public_keys": guardian_public_keys,
            "tally_shares": tally_shares,
            "ballot_shares": ballot_shares
        }
        
        response = client.post('/combine_partial_decryption', json=combine_data)
        assert response.status_code == 200, f"Combine partial decryption failed with status {response.status_code}"
        
        result = response.get_json()
        assert result is not None, "Combine partial decryption should return JSON"
        assert result['status'] == 'success', f"Combine partial decryption should succeed, got: {result.get('status')}"
        
        # Check required fields
        assert 'results' in result, "Response should contain results"
        assert result['results'] is not None, "Results should not be null"
        
        # Validate results structure
        results = result['results']
        assert isinstance(results, dict), "Results should be dict"
        
        # Check if we have election results
        if 'results' in results:
            election_results = results['results']
            if isinstance(election_results, dict):
                # Check for typical election result fields
                expected_fields = ['total_valid_ballots', 'total_spoiled_ballots', 'candidates']
                for field in expected_fields:
                    if field in election_results:
                        print(f"✓ Found {field} in results")
        
        print("✓ Combine partial decryption endpoint is working correctly")
        return result
    
    def test_invalid_endpoint(self, client):
        """Test that invalid endpoints return appropriate errors."""
        response = client.get('/invalid_endpoint')
        assert response.status_code == 404, "Invalid endpoint should return 404"
        print("✓ Invalid endpoint handling is working correctly")
    
    def test_missing_required_fields(self, client):
        """Test that endpoints properly validate required fields."""
        # Test setup_guardians with missing fields
        incomplete_data = {
            "number_of_guardians": 3
            # Missing other required fields
        }
        
        response = client.post('/setup_guardians', json=incomplete_data)
        assert response.status_code == 400, "Setup guardians should fail with incomplete data"
        
        result = response.get_json()
        assert result is not None, "Error response should return JSON"
        assert result['status'] == 'error', "Status should be error"
        assert 'message' in result, "Error response should contain message"
        
        print("✓ Required field validation is working correctly")
    
    def test_invalid_json_format(self, client):
        """Test that endpoints handle invalid JSON gracefully."""
        response = client.post('/setup_guardians', 
                             data="invalid json",
                             content_type='application/json')
        assert response.status_code == 400, "Invalid JSON should return 400"
        print("✓ Invalid JSON handling is working correctly")

if __name__ == "__main__":
    print("Run 'pytest' to execute the tests.")
