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
        number_of_guardians = int(data['number_of_guardians'])  # Convert to int
        quorum = int(data['quorum'])  # Convert to int
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
        
        response = {
            'status': 'success',
            'joint_public_key': result['joint_public_key'],
            'commitment_hash': result['commitment_hash'],
            'manifest': to_raw(election_data['manifest']),
            'guardian_data': result['guardian_data'],
            'private_keys': result['private_keys'],
            'public_keys': result['public_keys'],
            'polynomials': result['polynomials'],
            'number_of_guardians': result['number_of_guardians'],
            'quorum': result['quorum']
        }
        print_json(response, "setup_guardians_response")
        
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

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
        # Get election data
        number_of_guardians = election_data.get('number_of_guardians', 1)
        quorum = election_data.get('quorum', 1)
        
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
        return jsonify({'status': 'error', 'message': str(e)}), 400



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
        encrypted_ballots = data['encrypted_ballots'] # From request
        
        print_json(data, "create_encrypted_tally")
        # Get election data
        number_of_guardians = election_data.get('number_of_guardians', 1)
        quorum = election_data.get('quorum', 1)
        
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
            'ciphertext_tally': result['ciphertext_tally'],
            'submitted_ballots': result['submitted_ballots']
        }
        print_json(response, "create_encrypted_tally_response")
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400



@app.route('/create_partial_decryption', methods=['POST'])
def api_create_partial_decryption():
    """API endpoint to compute decryption shares for a single guardian."""
    try:
        data = request.json
        guardian_id = data['guardian_id']
        guardian_data = data['guardian_data']
        private_keys = data['private_keys']
        public_keys = data['public_keys']
        polynomials = data['polynomials']
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        ciphertext_tally_json = data['ciphertext_tally']
        submitted_ballots_json = data['submitted_ballots']
        joint_public_key = data['joint_public_key']
        commitment_hash = data['commitment_hash']
        

        print_json(data, "create_partial_decryption")
        # Get election data
        number_of_guardians = election_data.get('number_of_guardians', len(guardian_data))
        quorum = election_data.get('quorum', len(guardian_data))
        
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
            'ballot_shares': result['ballot_shares']
        }
        print_json(response, "create_partial_decryption_response")
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/create_compensated_decryption', methods=['POST'])
def api_create_compensated_decryption():
    """API endpoint to compute compensated decryption shares for missing guardians."""
    try:
        # Extract data from request
        data = request.json
        available_guardian_id = data['available_guardian_id']
        missing_guardian_id = data['missing_guardian_id']
        guardian_data = data['guardian_data']
        private_keys = data['private_keys']
        public_keys = data['public_keys']
        polynomials = data['polynomials']
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        ciphertext_tally_json = data['ciphertext_tally']
        submitted_ballots_json = data['submitted_ballots']
        joint_public_key = data['joint_public_key']
        commitment_hash = data['commitment_hash']
        
        print_json(data, "create_compensated_decryption")
        # Get election data
        number_of_guardians = election_data.get('number_of_guardians', len(guardian_data))
        quorum = election_data.get('quorum', len(guardian_data))
        
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
            'compensated_ballot_shares': result['compensated_ballot_shares']
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
        ciphertext_tally_json = data['ciphertext_tally']
        submitted_ballots_json = data['submitted_ballots']
        guardian_data = data['guardian_data']
        
        print_json(data, "combine_decryption_shares")
        # Regular decryption shares from available guardians
        available_guardian_shares = data.get('available_guardian_shares', {})
        
        # Compensated decryption shares for missing guardians
        compensated_shares = data.get('compensated_shares', {})
        
        # Get the required quorum
        quorum = data.get('quorum', len(guardian_data))
        
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
            compensated_shares,
            quorum,
            create_election_manifest,
            raw_to_ciphertext_tally,
            generate_ballot_hash,
            generate_ballot_hash_electionguard
        )
        
        # Format response
        response = {
            'status': 'success',
            'results': results
        }
        print_json(response, "combine_decryption_shares_response")
        return jsonify(response), 200
    
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400







if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
