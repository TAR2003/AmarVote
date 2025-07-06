"""Pytest configuration and fixtures for Microservice tests."""
import pytest
import sys
import os

# Ensure the parent directory is in the path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

@pytest.fixture(scope="session")
def setup_test_environment():
    """Set up test environment variables and configurations."""
    # Add any global test setup here
    yield
    # Add any cleanup here if needed
