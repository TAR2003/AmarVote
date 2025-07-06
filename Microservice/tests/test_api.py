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
    # Updated to handle both dict and Response object cases
    if hasattr(response, 'json'):
        data = response.json if callable(response.json) else response.json
    else:
        data = response.get_json()
    assert data['status'] == 'healthy'

# Add more endpoint tests as needed, e.g.:
# def test_setup_guardians(client):
#     response = client.post('/setup_guardians', json={...})
#     assert response.status_code == 200