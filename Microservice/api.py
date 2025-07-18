#!/usr/bin/env python

from flask import Flask, request, jsonify
from typing import Dict, List, Optional, Tuple, Any
import random
from datetime import datetime
import uuid
from collections import defaultdict
import hashlib
import json
from electionguard.ballot import (
    BallotBoxState,
    CiphertextBallot,
    PlaintextBallot,
    PlaintextBallotSelection,
    PlaintextBallotContest,
    SubmittedBallot,
)
from electionguard.serialize import to_raw, from_raw
from electionguard.constants import get_constants
from electionguard.data_store import DataStore
from electionguard.decryption_mediator import DecryptionMediator
from electionguard.election import CiphertextElectionContext
from electionguard.election_polynomial import (
    LagrangeCoefficientsRecord,
    ElectionPolynomial
)
from electionguard.encrypt import EncryptionDevice, EncryptionMediator
from electionguard.guardian import Guardian
from electionguard.key_ceremony_mediator import KeyCeremonyMediator
from electionguard.key_ceremony import ElectionKeyPair, ElectionPublicKey
from electionguard.ballot_box import BallotBox, get_ballots
from electionguard.elgamal import ElGamalPublicKey, ElGamalSecretKey, ElGamalCiphertext
from electionguard.group import ElementModQ, ElementModP, g_pow_p, int_to_p, int_to_q
from electionguard.manifest import (
    Manifest,
    InternalManifest,
    GeopoliticalUnit,
    Party,
    Candidate,
    ContestDescription as Contest,
    SelectionDescription,
    BallotStyle,
    ElectionType,
    VoteVariationType,
    SpecVersion,
    ContactInformation,
    ReportingUnitType
)
from electionguard_tools.helpers.election_builder import ElectionBuilder
from electionguard.tally import (
    tally_ballots,
    CiphertextTally,
    PlaintextTally,
    CiphertextTallyContest,
    CiphertextTallySelection
)
from electionguard.type import BallotId, GuardianId
from electionguard.utils import get_optional
from electionguard.election_polynomial import ElectionPolynomial, Coefficient, SecretCoefficient, PublicCommitment
from electionguard.schnorr import SchnorrProof
from electionguard.elgamal import ElGamalKeyPair, ElGamalPublicKey, ElGamalSecretKey
from electionguard.hash import hash_elems
from electionguard.decryption_share import DecryptionShare, CompensatedDecryptionShare
from electionguard.decryption import (
    compute_decryption_share, 
    compute_decryption_share_for_ballot,
    compute_compensated_decryption_share,
    compute_compensated_decryption_share_for_ballot,
    decrypt_backup,
    compute_lagrange_coefficients_for_guardians as compute_lagrange_coeffs
)
from services.setup_guardians import setup_guardians_service
from services.create_encrypted_ballot import create_encrypted_ballot_service
from services.create_encrypted_tally import create_encrypted_tally_service
from services.create_partial_decryption import create_partial_decryption_service
from services.create_compensated_decryption_shares import create_compensated_decryption_service, compute_compensated_ballot_shares
from services.combine_decryption_shares import combine_decryption_shares_service
from services.create_partial_decryption_shares import compute_ballot_shares, compute_guardian_decryption_shares
from services.create_encrypted_ballot import create_election_manifest, create_plaintext_ballot
from services.create_encrypted_tally import ciphertext_tally_to_raw, raw_to_ciphertext_tally

app = Flask(__name__)

def print_json(data, str_):
    with open("APIformat.txt", "a") as f:
        print(f"\n---------------\nData: {str_}", file=f)
        for key, value in data.items():
            if isinstance(value, list):
                if not value:
                    value_type = "list (empty)"
                else:
                    value_type = f"list of ({type(value[0]).__name__})"
            else:
                value_type = type(value).__name__
            print(f"{key}: {value_type}", file=f)
        print(f"End of {str_}\n------------------\n\n", file=f)

# Helper functions for serialization/deserialization
def serialize_dict_to_string(data):
    """Convert dict to JSON string with safe int handling"""
    if isinstance(data, dict):
        return json.dumps(data, ensure_ascii=False)
    return data

def deserialize_string_to_dict(data):
    """Convert JSON string to dict with safe int handling"""
    if isinstance(data, dict):
        # Already a dict (from request.json), return as-is
        return data
    elif isinstance(data, str):
        try:
            return json.loads(data)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON string: {e}")
    else:
        raise ValueError(f"Expected string or dict, got {type(data)}")

def serialize_list_of_dicts_to_list_of_strings(data):
    """Convert List[dict] to List[str] with safe int handling"""
    if isinstance(data, list):
        if not data:
            return []
        if isinstance(data[0], dict):
            return [json.dumps(item, ensure_ascii=False) for item in data]
    return data

def deserialize_list_of_strings_to_list_of_dicts(data):
    """Convert List[str] to List[dict] with safe int handling"""
    if isinstance(data, list):
        if not data:
            return []
        if isinstance(data[0], dict):
            # Already a list of dicts (from request.json), return as-is
            return data
        elif isinstance(data[0], str):
            try:
                return [json.loads(item) for item in data]
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in list: {e}")
        else:
            raise ValueError(f"Expected list of strings or dicts, got list of {type(data[0])}")
    elif isinstance(data, str):
        # Single string that should be parsed as JSON
        try:
            parsed = json.loads(data)
            if isinstance(parsed, list):
                return parsed
            else:
                return [parsed]
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON string: {e}")
    else:
        raise ValueError(f"Expected list or string, got {type(data)}")

def safe_int_conversion(value):
    """Safely convert values to int, handling JSON string->int issues"""
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            raise ValueError(f"Cannot convert string '{value}' to integer")
    elif isinstance(value, float):
        return int(value)
    elif value is None:
        raise ValueError("Cannot convert None to integer")
    return value

# Global storage for election data
election_data = {
    'guardians': None,
    'joint_public_key': None,
    'commitment_hash': None,
    'manifest': None,
    'encrypted_ballots': [],
    'ciphertext_tally': None,
    'submitted_ballots': None,
    'guardian_shares': [],
    'number_of_guardians': 0,
    'quorum': 0
}

geopolitical_unit = GeopoliticalUnit(
    object_id="county-1",
    name="County 1",
    type=ReportingUnitType.county,
    contact_information=None,
)

ballot_style = BallotStyle(
    object_id="ballot-style-1",
    geopolitical_unit_ids=["county-1"],
    party_ids=None,
    image_uri=None,
)


def generate_ballot_hash(ballot: Any) -> str:
    """Generate a cryptographic hash for the ballot using ElectionGuard's built-in hash function."""
    if hasattr(ballot, 'crypto_hash'):
        # Use ElectionGuard's built-in crypto_hash method if available
        return ballot.crypto_hash.to_hex()
    else:
        # Fallback to serialization-based hashing for other objects
        ballot_bytes = to_raw(ballot).encode('utf-8')
        return hashlib.sha256(ballot_bytes).hexdigest()

def generate_ballot_hash_electionguard(ballot: Any) -> str:
    """Generate a cryptographic hash using ElectionGuard's hash_elems function."""
    if hasattr(ballot, 'object_id') and hasattr(ballot, 'crypto_hash'):
        # Use the ballot's built-in crypto_hash which is computed using ElectionGuard's hash_elems
        return ballot.crypto_hash.to_hex()
    else:
        # For other objects, serialize and hash using ElectionGuard's hash_elems
        serialized = to_raw(ballot)
        hash_result = hash_elems(serialized)
        return hash_result.to_hex()

def generate_ballot_hash_from_serialized(serialized_ballot: Dict) -> str:
    """Generate a SHA-256 hash from a serialized ballot dictionary."""
    import json
    # Convert dict to JSON string with consistent ordering
    ballot_json = json.dumps(serialized_ballot, sort_keys=True)
    return hashlib.sha256(ballot_json.encode('utf-8')).hexdigest()

@app.route('/setup_guardians', methods=['POST'])
def api_setup_guardians():
    """API endpoint to setup guardians and create joint key."""
    try:
        data = request.json
        number_of_guardians = safe_int_conversion(data['number_of_guardians'])
        quorum = safe_int_conversion(data['quorum'])
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        
        print_json(data, "setup_guardians")
        
        # Call service function
        result = setup_guardians_service(
            number_of_guardians,
            quorum,
            party_names,
            candidate_names
        )
        
        # Store election data
        election_data['guardians'] = result['guardians']
        election_data['joint_public_key'] = result['joint_public_key']
        election_data['commitment_hash'] = result['commitment_hash']
        election_data['manifest'] = create_election_manifest(party_names, candidate_names)
        election_data['number_of_guardians'] = result['number_of_guardians']
        election_data['quorum'] = result['quorum']
        
        # Convert response dicts to strings - all complex objects serialized
        response = {
            'status': 'success',
            'joint_public_key': result['joint_public_key'],
            'commitment_hash': result['commitment_hash'],
            'manifest': serialize_dict_to_string(to_raw(election_data['manifest'])),
            'guardian_data': serialize_list_of_dicts_to_list_of_strings(result['guardian_data']),
            'private_keys': serialize_list_of_dicts_to_list_of_strings(result['private_keys']),
            'public_keys': serialize_list_of_dicts_to_list_of_strings(result['public_keys']),
            'polynomials': serialize_list_of_dicts_to_list_of_strings(result['polynomials']),
            'number_of_guardians': result['number_of_guardians'],
            'quorum': result['quorum']
        }
        print_json(response, "setup_guardians_response")
        
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/create_encrypted_ballot', methods=['POST'])
def api_create_encrypted_ballot():
    """API endpoint to create and encrypt a ballot."""
    try:
        data = request.json
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        candidate_name = data['candidate_name']
        ballot_id = data['ballot_id']
        joint_public_key = data['joint_public_key']  # Expecting string
        commitment_hash = data['commitment_hash']    # Expecting string
        
        print_json(data, "create_encrypted_ballot")
        
        # Get election data with safe int conversion
        number_of_guardians = safe_int_conversion(data.get('number_of_guardians', 1))
        quorum = safe_int_conversion(data.get('quorum', 1))
        
        # Call service function
        result = create_encrypted_ballot_service(
            party_names,
            candidate_names,
            candidate_name,
            ballot_id,
            joint_public_key,
            commitment_hash,
            number_of_guardians,
            quorum,
            create_plaintext_ballot,
            create_election_manifest,
            generate_ballot_hash_electionguard
        )
        
        # Store the encrypted ballot (optional) - ensure key exists
        if 'encrypted_ballots' not in election_data:
            election_data['encrypted_ballots'] = []
        election_data['encrypted_ballots'].append(result['encrypted_ballot'])
        
        response = {
            'status': 'success',
            'encrypted_ballot': result['encrypted_ballot'],
            'ballot_hash': result['ballot_hash']
        }
        print_json(response, "create_encrypted_ballot_response")
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/health', methods=['GET'])
def api_health_check():
    """API endpoint for health check."""
    return jsonify({'status': 'healthy'}), 200

@app.route('/create_encrypted_tally', methods=['POST'])
def api_create_encrypted_tally():
    """API endpoint to tally encrypted ballots."""
    try:
        data = request.json
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        joint_public_key = data['joint_public_key']  # Expecting string
        commitment_hash = data['commitment_hash']    # Expecting string
        encrypted_ballots = data['encrypted_ballots'] # List of encrypted ballot strings
        
        print_json(data, "create_encrypted_tally")
        
        # Get election data with safe int conversion
        number_of_guardians = safe_int_conversion(data.get('number_of_guardians', 1))
        quorum = safe_int_conversion(data.get('quorum', 1))
        
        # Call service function
        result = create_encrypted_tally_service(
            party_names,
            candidate_names,
            joint_public_key,
            commitment_hash,
            encrypted_ballots,
            number_of_guardians,
            quorum,
            create_election_manifest,
            ciphertext_tally_to_raw
        )
        
        # Optionally store tally data if needed
        election_data['ciphertext_tally'] = result['ciphertext_tally']
        election_data['submitted_ballots'] = result['submitted_ballots']
        
        response = {
            'status': 'success',
            'ciphertext_tally': serialize_dict_to_string(result['ciphertext_tally']),
            'submitted_ballots': serialize_list_of_dicts_to_list_of_strings(result['submitted_ballots'])
        }
        print_json(response, "create_encrypted_tally_response")
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/create_partial_decryption', methods=['POST'])
def api_create_partial_decryption():
    """API endpoint to compute decryption shares for a single guardian."""
    try:
        data = request.json
        guardian_id = data['guardian_id']
        print_json(data, "create_partial_decryption")
        
        # Deserialize list of dicts from list of strings with error context
        try:
            guardian_data = deserialize_list_of_strings_to_list_of_dicts(data['guardian_data'])
        except Exception as e:
            raise ValueError(f"Error deserializing guardian_data: {e}")
            
        try:
            private_keys = deserialize_list_of_strings_to_list_of_dicts(data['private_keys'])
        except Exception as e:
            raise ValueError(f"Error deserializing private_keys: {e}")
            
        try:
            public_keys = deserialize_list_of_strings_to_list_of_dicts(data['public_keys'])
        except Exception as e:
            raise ValueError(f"Error deserializing public_keys: {e}")
            
        try:
            polynomials = deserialize_list_of_strings_to_list_of_dicts(data['polynomials'])
        except Exception as e:
            raise ValueError(f"Error deserializing polynomials: {e}")
            
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        
        # Deserialize dict from string with error context
        try:
            ciphertext_tally_json = deserialize_string_to_dict(data['ciphertext_tally'])
        except Exception as e:
            raise ValueError(f"Error deserializing ciphertext_tally: {e}")
            
        # Deserialize submitted_ballots from list of strings to list of dicts
        try:
            submitted_ballots_json = deserialize_list_of_strings_to_list_of_dicts(data['submitted_ballots'])
        except Exception as e:
            raise ValueError(f"Error deserializing submitted_ballots: {e}")
            
        joint_public_key = data['joint_public_key']
        commitment_hash = data['commitment_hash']
        
        # Get election data with safe int conversion
        number_of_guardians = safe_int_conversion(data.get('number_of_guardians', len(guardian_data)))
        quorum = safe_int_conversion(data.get('quorum', len(guardian_data)))
        
        # Call service function
        result = create_partial_decryption_service(
            party_names,
            candidate_names,
            guardian_id,
            guardian_data,
            private_keys,
            public_keys,
            polynomials,
            ciphertext_tally_json,
            submitted_ballots_json,
            joint_public_key,
            commitment_hash,
            number_of_guardians,
            quorum,
            create_election_manifest,
            raw_to_ciphertext_tally,
            compute_ballot_shares
        )
        
        response = {
            'status': 'success',
            'guardian_public_key': result['guardian_public_key'],
            'tally_share': result['tally_share'],
            'ballot_shares': serialize_dict_to_string(result['ballot_shares'])
        }
        print_json(response, "create_partial_decryption_response")
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/create_compensated_decryption', methods=['POST'])
def api_create_compensated_decryption():
    """API endpoint to compute compensated decryption shares for missing guardians."""
    try:
        # Extract data from request
        data = request.json
        available_guardian_id = data['available_guardian_id']
        missing_guardian_id = data['missing_guardian_id']
        print_json(data, "create_compensated_decryption")
        
        # Deserialize list of dicts from list of strings with error context
        try:
            guardian_data = deserialize_list_of_strings_to_list_of_dicts(data['guardian_data'])
        except Exception as e:
            raise ValueError(f"Error deserializing guardian_data: {e}")
            
        try:
            private_keys = deserialize_list_of_strings_to_list_of_dicts(data['private_keys'])
        except Exception as e:
            raise ValueError(f"Error deserializing private_keys: {e}")
            
        try:
            public_keys = deserialize_list_of_strings_to_list_of_dicts(data['public_keys'])
        except Exception as e:
            raise ValueError(f"Error deserializing public_keys: {e}")
            
        try:
            polynomials = deserialize_list_of_strings_to_list_of_dicts(data['polynomials'])
        except Exception as e:
            raise ValueError(f"Error deserializing polynomials: {e}")
            
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        
        # Deserialize dict from string with error context
        try:
            ciphertext_tally_json = deserialize_string_to_dict(data['ciphertext_tally'])
        except Exception as e:
            raise ValueError(f"Error deserializing ciphertext_tally: {e}")
            
        # Deserialize submitted_ballots from list of strings to list of dicts
        try:
            submitted_ballots_json = deserialize_list_of_strings_to_list_of_dicts(data['submitted_ballots'])
        except Exception as e:
            raise ValueError(f"Error deserializing submitted_ballots: {e}")
        joint_public_key = data['joint_public_key']
        commitment_hash = data['commitment_hash']
        
        # Get election data with safe int conversion
        number_of_guardians = safe_int_conversion(data.get('number_of_guardians', len(guardian_data)))
        quorum = safe_int_conversion(data.get('quorum', len(guardian_data)))
        
        # Call service function
        result = create_compensated_decryption_service(
            party_names,
            candidate_names,
            available_guardian_id,
            missing_guardian_id,
            guardian_data,
            private_keys,
            public_keys,
            polynomials,
            ciphertext_tally_json,
            submitted_ballots_json,
            joint_public_key,
            commitment_hash,
            number_of_guardians,
            quorum,
            create_election_manifest,
            raw_to_ciphertext_tally,
            compute_compensated_ballot_shares
        )
        
        # Format response
        response = {
            'status': 'success',
            'compensated_tally_share': result['compensated_tally_share'],
            'compensated_ballot_shares': serialize_dict_to_string(result['compensated_ballot_shares'])
        }
        print_json(response, "create_compensated_decryption_response")  
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/combine_decryption_shares', methods=['POST'])
def api_combine_decryption_shares():
    """API endpoint to combine decryption shares with quorum support."""
    try:
        # Extract data from request
        data = request.json
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        joint_public_key = data['joint_public_key']
        commitment_hash = data['commitment_hash']
        print_json(data, "combine_decryption_shares")
        
        # Deserialize dict from string with error context
        try:
            ciphertext_tally_json = deserialize_string_to_dict(data['ciphertext_tally'])
        except Exception as e:
            raise ValueError(f"Error deserializing ciphertext_tally: {e}")
        
        # Deserialize list of strings to list of dicts for submitted_ballots
        try:
            submitted_ballots_json = deserialize_list_of_strings_to_list_of_dicts(data['submitted_ballots'])
        except Exception as e:
            raise ValueError(f"Error deserializing submitted_ballots: {e}")
        
        # Deserialize guardian_data from list of strings to list of dicts
        try:
            guardian_data = deserialize_list_of_strings_to_list_of_dicts(data['guardian_data'])
        except Exception as e:
            raise ValueError(f"Error deserializing guardian_data: {e}")

        # Reconstruct available_guardian_shares from separate arrays
        available_guardian_shares = {}
        available_guardian_ids_list = data.get('available_guardian_ids', [])
        available_guardian_public_keys = data.get('available_guardian_public_keys', [])
        available_tally_shares = data.get('available_tally_shares', [])
        available_ballot_shares = data.get('available_ballot_shares', [])
        
        for i, guardian_id in enumerate(available_guardian_ids_list):
            try:
                available_guardian_shares[guardian_id] = {
                    'guardian_public_key': available_guardian_public_keys[i],
                    'tally_share': available_tally_shares[i],
                    'ballot_shares': deserialize_string_to_dict(available_ballot_shares[i]) if isinstance(available_ballot_shares[i], str) else available_ballot_shares[i]
                }
            except Exception as e:
                raise ValueError(f"Error reconstructing available_guardian_shares for {guardian_id}: {e}")
        
        # Reconstruct compensated_shares from separate arrays
        all_compensated_shares = {}
        missing_guardian_ids_list = data.get('missing_guardian_ids', [])
        compensating_guardian_ids_list = data.get('compensating_guardian_ids', [])
        compensated_tally_shares = data.get('compensated_tally_shares', [])
        compensated_ballot_shares = data.get('compensated_ballot_shares', [])
        
        for i in range(len(missing_guardian_ids_list)):
            try:
                missing_guardian_id = missing_guardian_ids_list[i]
                compensating_guardian_id = compensating_guardian_ids_list[i]
                
                if missing_guardian_id not in all_compensated_shares:
                    all_compensated_shares[missing_guardian_id] = {}
                
                all_compensated_shares[missing_guardian_id][compensating_guardian_id] = {
                    'compensated_tally_share': compensated_tally_shares[i],
                    'compensated_ballot_shares': deserialize_string_to_dict(compensated_ballot_shares[i]) if isinstance(compensated_ballot_shares[i], str) else compensated_ballot_shares[i]
                }
            except Exception as e:
                raise ValueError(f"Error reconstructing compensated_shares: {e}")
        
        # Get the required quorum with safe int conversion
        quorum = safe_int_conversion(data.get('quorum', len(guardian_data)))
        number_of_guardians = safe_int_conversion(data.get('number_of_guardians', len(guardian_data)))
        
        # Determine which guardians are available and which are missing
        available_guardian_ids = set(available_guardian_shares.keys())
        all_guardian_ids = {g['id'] for g in guardian_data}
        missing_guardian_ids = all_guardian_ids - available_guardian_ids
        
        print(f"Available guardians: {sorted(available_guardian_ids)}")
        print(f"Missing guardians: {sorted(missing_guardian_ids)}")
        print(f"All guardian IDs: {sorted(all_guardian_ids)}")
        print(f"Quorum required: {quorum}, Available: {len(available_guardian_ids)}")
        
        # Validate we have enough guardians
        if len(available_guardian_ids) < quorum:
            raise ValueError(f"Insufficient guardians available. Need {quorum}, have {len(available_guardian_ids)}")
        
        # Filter compensated shares to ONLY include the missing guardians
        # This is where the backend determines which guardians need compensation
        filtered_compensated_shares = {}
        for missing_guardian_id in missing_guardian_ids:
            if missing_guardian_id in all_compensated_shares:
                filtered_compensated_shares[missing_guardian_id] = all_compensated_shares[missing_guardian_id]
                print(f"Including compensated shares for missing guardian: {missing_guardian_id}")
            else:
                raise ValueError(f"Missing compensated shares for guardian {missing_guardian_id}")
        
        # Log what we're filtering out
        excluded_guardians = set(all_compensated_shares.keys()) - missing_guardian_ids
        if excluded_guardians:
            print(f"Excluding compensated shares for available guardians: {sorted(excluded_guardians)}")
        
        # Call service function
        results = combine_decryption_shares_service(
            party_names,
            candidate_names,
            joint_public_key,
            commitment_hash,
            ciphertext_tally_json,
            submitted_ballots_json,
            guardian_data,
            available_guardian_shares,
            filtered_compensated_shares,
            quorum,
            create_election_manifest,
            raw_to_ciphertext_tally,
            generate_ballot_hash,
            generate_ballot_hash_electionguard
        )
        
        # Format response - ensure all nested dicts are serialized to strings
        response = {
            'status': 'success',
            'results': serialize_dict_to_string(results)
        }
        print_json(response, "combine_decryption_shares_response")
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)