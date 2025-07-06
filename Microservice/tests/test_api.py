import pytest
from Microservice.api import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json['status'] == 'healthy'

# Add more endpoint tests as needed, e.g.:
# def test_setup_guardians(client):
#     response = client.post('/setup_guardians', json={...})
#     assert response.status_code == 200