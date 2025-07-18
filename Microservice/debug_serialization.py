#!/usr/bin/env python

import json

def test_serialization_issue():
    """Test the serialization functions to debug the JSON issue."""
    print("Testing serialization functions...")
    
    # Test case 1: String that should be parsed
    test_string = '{"key": "value", "number": 123}'
    print(f"Test string: {test_string}")
    print(f"Type: {type(test_string)}")
    
    try:
        result = json.loads(test_string)
        print(f"Parsed successfully: {result}")
        print(f"Result type: {type(result)}")
    except Exception as e:
        print(f"Failed to parse: {e}")
    
    # Test case 2: Already a dict
    test_dict = {"key": "value", "number": 123}
    print(f"\nTest dict: {test_dict}")
    print(f"Type: {type(test_dict)}")
    
    # Test case 3: List of strings
    test_list = ['{"id": "guardian-1", "data": "test1"}', '{"id": "guardian-2", "data": "test2"}']
    print(f"\nTest list: {test_list}")
    print(f"Type: {type(test_list)}")
    
    try:
        result = [json.loads(item) for item in test_list]
        print(f"Parsed successfully: {result}")
        print(f"Result type: {type(result)}")
    except Exception as e:
        print(f"Failed to parse: {e}")
    
    # Test case 4: List of dicts (already parsed)
    test_list_dicts = [{"id": "guardian-1", "data": "test1"}, {"id": "guardian-2", "data": "test2"}]
    print(f"\nTest list of dicts: {test_list_dicts}")
    print(f"Type: {type(test_list_dicts)}")
    
    # This should not need parsing
    if isinstance(test_list_dicts[0], dict):
        print("Already a list of dicts - no parsing needed")
    else:
        print("Needs parsing")

def simulate_api_data():
    """Simulate the data structure that might be causing issues."""
    print("\n" + "="*50)
    print("SIMULATING API DATA STRUCTURE")
    print("="*50)
    
    # This is what might be coming from the frontend
    frontend_data = {
        "guardian_id": "guardian-1",
        "guardian_data": [
            '{"id": "guardian-1", "sequence_order": 1}',
            '{"id": "guardian-2", "sequence_order": 2}'
        ],
        "private_keys": [
            '{"guardian_id": "guardian-1", "private_key": "123456"}',
            '{"guardian_id": "guardian-2", "private_key": "789012"}'
        ],
        "ciphertext_tally": '{"contest_1": {"selection_1": "encrypted_data"}}',
        "submitted_ballots": [
            '{"ballot_id": "ballot-1", "data": "encrypted"}',
            '{"ballot_id": "ballot-2", "data": "encrypted"}'
        ]
    }
    
    print("Frontend data structure:")
    for key, value in frontend_data.items():
        print(f"  {key}: {type(value)} -> {value}")
    
    # Test our deserialization functions
    print("\nTesting deserialization...")
    
    # Test string to dict
    try:
        tally_result = json.loads(frontend_data['ciphertext_tally'])
        print(f"✅ ciphertext_tally parsed: {type(tally_result)}")
    except Exception as e:
        print(f"❌ ciphertext_tally failed: {e}")
    
    # Test list of strings to list of dicts
    try:
        guardian_result = [json.loads(item) for item in frontend_data['guardian_data']]
        print(f"✅ guardian_data parsed: {type(guardian_result)} with {len(guardian_result)} items")
    except Exception as e:
        print(f"❌ guardian_data failed: {e}")

if __name__ == "__main__":
    test_serialization_issue()
    simulate_api_data()
