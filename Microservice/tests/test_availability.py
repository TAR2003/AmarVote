import pytest
import json
from typing import Dict, Any
from Microservice.api import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestAPIAvailability:
    """Test suite to verify all API endpoints are available and functional."""
    
    def test_health_endpoint(self, client):
        """Test the health check endpoint."""
        response = client.get('/health')
        assert response.status_code == 200, "Health endpoint should return 200"
        
        result = response.get_json()
        assert result is not None, "Health endpoint should return JSON"
        assert result['status'] == 'healthy', "Health endpoint should return healthy status"
        
        print("✓ Health endpoint is working correctly")
    
    def test_setup_guardians(self, client):
        """Test the setup_guardians endpoint."""
        setup_data = {
            "number_of_guardians": 3,
            "quorum": 3,
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"]
        }
        
        response = client.post('/setup_guardians', json=setup_data)
        assert response.status_code == 200, f"Setup guardians failed with status {response.status_code}"
        
        result = response.get_json()
        assert result is not None, "Setup guardians should return JSON"
        assert result['status'] == 'success', f"Setup guardians should succeed, got: {result.get('status')}"
        
        # Check required fields are present
        required_fields = [
            'joint_public_key', 'commitment_hash', 'guardian_public_keys',
            'guardian_private_keys', 'guardian_polynomials', 'manifest'
        ]
        for field in required_fields:
            assert field in result, f"Response should contain {field}"
            assert result[field] is not None, f"{field} should not be null"
        
        # Validate data types
        assert isinstance(result['joint_public_key'], str), "joint_public_key should be string"
        assert isinstance(result['commitment_hash'], str), "commitment_hash should be string"
        assert isinstance(result['guardian_public_keys'], list), "guardian_public_keys should be list"
        assert isinstance(result['guardian_private_keys'], list), "guardian_private_keys should be list"
        assert isinstance(result['guardian_polynomials'], list), "guardian_polynomials should be list"
        # manifest can be various types, so we don't assert its specific type
        
        # Check list lengths
        assert len(result['guardian_public_keys']) == setup_data['number_of_guardians'], "Should have correct number of public keys"
        assert len(result['guardian_private_keys']) == setup_data['number_of_guardians'], "Should have correct number of private keys"
        assert len(result['guardian_polynomials']) == setup_data['number_of_guardians'], "Should have correct number of polynomials"
        
        print("✓ Setup guardians endpoint is working correctly")
        return result
    
    def test_create_encrypted_ballot(self, client):
        """Test the create_encrypted_ballot endpoint."""
        # First setup guardians to get required keys
        setup_data = {
            "number_of_guardians": 3,
            "quorum": 3,
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"]
        }
        setup_response = client.post('/setup_guardians', json=setup_data)
        setup_result = setup_response.get_json()
        
        # Create ballot data
        ballot_data = {
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "candidate_name": "Candidate 1",
            "ballot_id": "test-ballot-001",
            "joint_public_key": setup_result['joint_public_key'],
            "commitment_hash": setup_result['commitment_hash']
        }
        
        response = client.post('/create_encrypted_ballot', json=ballot_data)
        assert response.status_code == 200, f"Create encrypted ballot failed with status {response.status_code}"
        
        result = response.get_json()
        assert result is not None, "Create encrypted ballot should return JSON"
        assert result['status'] == 'success', f"Create encrypted ballot should succeed, got: {result.get('status')}"
        
        # Check required fields
        required_fields = ['encrypted_ballot', 'ballot_hash']
        for field in required_fields:
            assert field in result, f"Response should contain {field}"
            assert result[field] is not None, f"{field} should not be null"
        
        # Validate data types
        # encrypted_ballot can be various types, so we don't assert its specific type
        assert isinstance(result['ballot_hash'], str), "ballot_hash should be string"
        
        # Validate encrypted ballot structure (if it's accessible as dict)
        encrypted_ballot = result['encrypted_ballot']
        if isinstance(encrypted_ballot, dict) and 'object_id' in encrypted_ballot:
            assert encrypted_ballot['object_id'] == ballot_data['ballot_id'], "Ballot ID should match"
        
        print("✓ Create encrypted ballot endpoint is working correctly")
        return result
    
    def test_create_encrypted_tally(self, client):
        """Test the create_encrypted_tally endpoint."""
        # Setup guardians
        setup_data = {
            "number_of_guardians": 3,
            "quorum": 3,
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"]
        }
        setup_response = client.post('/setup_guardians', json=setup_data)
        setup_result = setup_response.get_json()
        
        # Create encrypted ballots
        encrypted_ballots = []
        for i, candidate in enumerate(["Candidate 1", "Candidate 2"]):
            ballot_data = {
                "party_names": ["Party A", "Party B"],
                "candidate_names": ["Candidate 1", "Candidate 2"],
                "candidate_name": candidate,
                "ballot_id": f"test-ballot-{i:03d}",
                "joint_public_key": setup_result['joint_public_key'],
                "commitment_hash": setup_result['commitment_hash']
            }
            ballot_response = client.post('/create_encrypted_ballot', json=ballot_data)
            ballot_result = ballot_response.get_json()
            encrypted_ballots.append(ballot_result['encrypted_ballot'])
        
        # Create tally
        tally_data = {
            "party_names": ["Party A", "Party B"],
            "candidate_names": ["Candidate 1", "Candidate 2"],
            "joint_public_key": setup_result['joint_public_key'],
            "commitment_hash": setup_result['commitment_hash'],
            "encrypted_ballots": encrypted_ballots
        }
        
        response = client.post('/create_encrypted_tally', json=tally_data)
        assert response.status_code == 200, f"Create encrypted tally failed with status {response.status_code}"
        
        result = response.get_json()
        assert result is not None, "Create encrypted tally should return JSON"
        assert result['status'] == 'success', f"Create encrypted tally should succeed, got: {result.get('status')}"
        
        # Check required fields
        required_fields = ['ciphertext_tally', 'submitted_ballots']
        for field in required_fields:
            assert field in result, f"Response should contain {field}"
            assert result[field] is not None, f"{field} should not be null"
        
        # Validate data types
        assert isinstance(result['ciphertext_tally'], dict), "ciphertext_tally should be dict"
        assert isinstance(result['submitted_ballots'], list), "submitted_ballots should be list"
        
        # Check that we have submitted ballots
        assert len(result['submitted_ballots']) > 0, "Should have at least one submitted ballot"
        
        print("✓ Create encrypted tally endpoint is working correctly")
        return result, setup_result
    
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
    # Create a test client for standalone execution
    app.config['TESTING'] = True
    with app.test_client() as test_client:
        test_suite = TestAPIAvailability()
        
        print("🧪 Starting API Availability Tests")
        print("=" * 50)
        
        try:
            # Run individual tests
            test_suite.test_health_endpoint(test_client)
            test_suite.test_setup_guardians(test_client)
            test_suite.test_create_encrypted_ballot(test_client)
            test_suite.test_create_encrypted_tally(test_client)
            test_suite.test_create_partial_decryption(test_client)
            test_suite.test_combine_partial_decryption(test_client)
            test_suite.test_invalid_endpoint(test_client)
            test_suite.test_missing_required_fields(test_client)
            test_suite.test_invalid_json_format(test_client)
            
            print("=" * 50)
            print("🎉 All API Availability Tests Passed!")
            
        except Exception as e:
            print(f"❌ Test failed with error: {str(e)}")
            raise
