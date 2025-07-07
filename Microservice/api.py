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
from electionguard.election_polynomial import LagrangeCoefficientsRecord
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
from electionguard.type import BallotId
from electionguard.utils import get_optional
from electionguard.election_polynomial import ElectionPolynomial, Coefficient, SecretCoefficient, PublicCommitment
from electionguard.schnorr import SchnorrProof
from electionguard.elgamal import ElGamalKeyPair, ElGamalPublicKey, ElGamalSecretKey
from electionguard.hash import hash_elems
from electionguard.decryption_share import DecryptionShare
from electionguard.decryption import compute_decryption_share, compute_decryption_share_for_ballot

app = Flask(__name__)

# Global variable to track ballot hashes
ballot_hashes = {}

# Global storage for election data
election_data = {
    'guardians': None,
    'joint_public_key': None,
    'commitment_hash': None,
    'manifest': None,
    'encrypted_ballots': [],
    'ciphertext_tally': None,
    'submitted_ballots': None,
    'guardian_shares': []
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


def compute_ballot_shares(
    _election_keys: ElectionKeyPair,
    ballots: List[SubmittedBallot],
    context: CiphertextElectionContext
) -> Dict[BallotId, Optional[DecryptionShare]]:
    """Compute the decryption shares of ballots."""
    shares = {}
    for ballot in ballots:
        share = compute_decryption_share_for_ballot(
            _election_keys,
            ballot,
            context,
        )
        shares[ballot.object_id] = share
    return shares


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

def create_election_manifest(
    party_names: List[str], 
    candidate_names: List[str]
) -> Manifest:
    """Create a complete election manifest programmatically."""
    parties: List[Party] = []
    for i in range(len(party_names)):
        parties.append(
            Party(
                object_id=f"party-{i+1}",
                name=party_names[i],
                abbreviation=party_names[i],
                color=None,
                logo_uri=None,
            )
        )

    candidates: List[Candidate] = []
    for i in range(len(candidate_names)):
        candidates.append(
            Candidate(
                object_id=f"candidate-{i+1}",
                name=candidate_names[i],
                party_id=f"party-{i+1}",
            )
        )
   
    ballot_selections: List[SelectionDescription] = []
    for i in range(len(candidate_names)):
        ballot_selections.append(
            SelectionDescription(
                object_id=f"{candidate_names[i]}",
                candidate_id=f"{candidate_names[i]}",
                sequence_order=i,
            )
        )

    contests: List[Contest] = [
        Contest(
            object_id="contest-1",
            sequence_order=0,
            electoral_district_id="county-1",
            vote_variation=VoteVariationType.one_of_m,
            name="County Executive",
            ballot_selections=ballot_selections,
            ballot_title=None,
            ballot_subtitle=None,
            votes_allowed=1,
            number_elected=1,
        ),
    ]
    
    start_date = datetime(2025,1,1)
    end_date = datetime(2025,1,1)
    
    manifest = Manifest(
        election_scope_id=f"election-1",
        spec_version="1.0",
        type=ElectionType.general,
        start_date=start_date,
        end_date=end_date,
        geopolitical_units=[geopolitical_unit],
        parties=parties,
        candidates=candidates,
        contests=contests,
        ballot_styles=[ballot_style],
        name="Test Election",
        contact_information=None,
    )
    
    return manifest

def create_plaintext_ballot(party_names, candidate_names, candidate_name: str, ballot_id: str) -> PlaintextBallot:
    """Create a single plaintext ballot for a specific candidate."""
    manifest = create_election_manifest(
        party_names,
        candidate_names,
    )
    selection = None
    contest = manifest.contests[0]
    for option in contest.ballot_selections:
        if option.candidate_id == candidate_name:
            selection = option
            break
    
    if not selection:
        raise ValueError(f"Candidate {candidate_name} not found in manifest")
    
    ballot_contests = []
    for contest in manifest.contests:
        selections = []
        for option in contest.ballot_selections:
            vote = 1 if option.object_id == selection.object_id else 0
            selections.append(
                PlaintextBallotSelection(
                    object_id=option.object_id,
                    vote=vote,
                    is_placeholder_selection=False,
                )
            )
        ballot_contests.append(
            PlaintextBallotContest(
                object_id=contest.object_id,
                ballot_selections=selections
            )
        )
    
    return PlaintextBallot(
        object_id=ballot_id,
        style_id=ballot_style.object_id,
        contests=ballot_contests,
    )

def ciphertext_tally_to_raw(tally: CiphertextTally) -> Dict:
    """Convert a CiphertextTally to a raw dictionary for serialization."""
    return {
        "_encryption": to_raw(tally._encryption),
        "cast_ballot_ids": list(tally.cast_ballot_ids),
        "spoiled_ballot_ids": list(tally.spoiled_ballot_ids),
        "contests": {contest_id: to_raw(contest) for contest_id, contest in tally.contests.items()},
        "_internal_manifest": to_raw(tally._internal_manifest),
        "_manifest": to_raw(tally._internal_manifest.manifest)
    }

def raw_to_ciphertext_tally(raw: Dict, manifest: Manifest = None) -> CiphertextTally:
    """Reconstruct a CiphertextTally from its raw dictionary representation."""
    internal_manifest = InternalManifest(manifest)
    
    tally = CiphertextTally(
        object_id=raw.get("object_id", ""),
        _internal_manifest=internal_manifest,
        _encryption=from_raw(CiphertextElectionContext, raw["_encryption"]),
    )
    
    tally.cast_ballot_ids = set(raw["cast_ballot_ids"])
    tally.spoiled_ballot_ids = set(raw["spoiled_ballot_ids"])
    
    tally.contests = {
        contest_id: from_raw(CiphertextTallyContest, contest_raw)
        for contest_id, contest_raw in raw["contests"].items()
    }
    
    return tally

@app.route('/setup_guardians', methods=['POST'])
def api_setup_guardians():
    """API endpoint to setup guardians and create joint key."""
    try:
        data = request.json
        number_of_guardians = int(data['number_of_guardians'])  # Convert to int
        quorum = int(data['quorum'])  # Convert to int
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        
        # Setup Guardians
        guardians: List[Guardian] = []
        for i in range(number_of_guardians):
            guardian = Guardian.from_nonce(
                str(i + 1),  # guardian id
                i + 1,  # sequence order
                number_of_guardians,
                quorum,
            )
            guardians.append(guardian)
        
        # Setup Key Ceremony Mediator
        mediator = KeyCeremonyMediator(
            "key-ceremony-mediator", 
            guardians[0].ceremony_details
        )
        
        # ROUND 1: Public Key Sharing
        for guardian in guardians:
            mediator.announce(guardian.share_key())
            
        # Share Keys
        for guardian in guardians:
            announced_keys = get_optional(mediator.share_announced())
            for key in announced_keys:
                if guardian.id != key.owner_id:
                    guardian.save_guardian_key(key)
        
        # ROUND 2: Election Partial Key Backup Sharing
        for sending_guardian in guardians:
            sending_guardian.generate_election_partial_key_backups()
            
            backups = []
            for designated_guardian in guardians:
                if designated_guardian.id != sending_guardian.id:
                    backup = get_optional(
                        sending_guardian.share_election_partial_key_backup(
                            designated_guardian.id
                        )
                    )
                    backups.append(backup)
            
            mediator.receive_backups(backups)
        
        # Receive Backups
        for designated_guardian in guardians:
            backups = get_optional(mediator.share_backups(designated_guardian.id))
            for backup in backups:
                designated_guardian.save_election_partial_key_backup(backup)
        
        # ROUND 3: Verification of Backups
        for designated_guardian in guardians:
            verifications = []
            for backup_owner in guardians:
                if designated_guardian.id != backup_owner.id:
                    verification = designated_guardian.verify_election_partial_key_backup(
                        backup_owner.id
                    )
                    verifications.append(get_optional(verification))
            
            mediator.receive_backup_verifications(verifications)
        
        # FINAL: Publish Joint Key
        joint_key = get_optional(mediator.publish_joint_key())
        
        # Store election data
        election_data['guardians'] = guardians
        election_data['joint_public_key'] = str(int(joint_key.joint_public_key))  # Convert to string
        election_data['commitment_hash'] = str(int(joint_key.commitment_hash))  # Convert to string
        election_data['manifest'] = create_election_manifest(party_names, candidate_names)
        
        guardian_public_keys = [str(int(g._election_keys.key_pair.public_key)) for g in guardians]  # Convert to string
        guardian_private_keys = [str(int(g._election_keys.key_pair.secret_key)) for g in guardians]  # Convert to string
        guardian_polynomials = [to_raw(g._election_keys.polynomial) for g in guardians]
        
        response = {
            'status': 'success',
            'joint_public_key': election_data['joint_public_key'],
            'commitment_hash': election_data['commitment_hash'],
            'guardian_public_keys': guardian_public_keys,
            'guardian_private_keys': guardian_private_keys,
            'guardian_polynomials': guardian_polynomials,
            'manifest': to_raw(election_data['manifest'])
        }
        
        return jsonify(response), 200
    
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
        
        # Convert string inputs to integers for internal processing
        joint_public_key_int = int(joint_public_key)
        commitment_hash_int = int(commitment_hash)
        
        ballot = create_plaintext_ballot(party_names, candidate_names, candidate_name, ballot_id)
        encrypted_ballot = encrypt_ballot(
            party_names, 
            candidate_names, 
            joint_public_key_int,  # Use converted int
            commitment_hash_int,    # Use converted int
            ballot
        )
        
        if encrypted_ballot:
            # Generate and store hash for the ballot using ElectionGuard's native hash
            ballot_hash = generate_ballot_hash_electionguard(encrypted_ballot)
            ballot_hashes[encrypted_ballot.object_id] = ballot_hash
            
            # Serialize the ballot for response
            serialized_ballot = to_raw(encrypted_ballot)
            
            # Store the encrypted ballot (optional)
            election_data['encrypted_ballots'].append(serialized_ballot)
            
            response = {
                'status': 'success',
                'encrypted_ballot': serialized_ballot,
                'ballot_hash': ballot_hash
            }
            return jsonify(response), 200
        else:
            return jsonify({'status': 'error', 'message': 'Failed to encrypt ballot'}), 400
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

def encrypt_ballot(
    party_names,
    candidate_names,
    joint_public_key_json,
    commitment_hash_json,
    plaintext_ballot
) -> Optional[CiphertextBallot]:
    """Encrypt a single ballot."""
    joint_public_key = int_to_p(joint_public_key_json)
    commitment_hash = int_to_q(commitment_hash_json)
    manifest = create_election_manifest(party_names, candidate_names)
    
    # Create election builder and set public key and commitment hash
    election_builder = ElectionBuilder(
        number_of_guardians=1,
        quorum=1,
        manifest=manifest
    )
    election_builder.set_public_key(joint_public_key)
    election_builder.set_commitment_hash(commitment_hash)
    
    # Build the election context
    internal_manifest, context = get_optional(election_builder.build())
    
    # Create encryption device and mediator
    device = EncryptionDevice(device_id=1, session_id=1, launch_code=1, location="polling-place")
    encrypter = EncryptionMediator(internal_manifest, context, device)
    
    # Encrypt the ballot
    encrypted_ballot = encrypter.encrypt(plaintext_ballot)
    if encrypted_ballot:
        return get_optional(encrypted_ballot)
    return None

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
        
        if not encrypted_ballots:
            return jsonify({'status': 'error', 'message': 'No ballots to tally. Provide encrypted ballots.'}), 400
        
        # Convert string inputs to integers for internal processing
        joint_public_key_int = int(joint_public_key)
        commitment_hash_int = int(commitment_hash)
        
        ciphertext_tally_json, submitted_ballots_json = tally_encrypted_ballots(
            party_names,
            candidate_names,
            joint_public_key_int,    # Use converted int
            commitment_hash_int,     # Use converted int
            encrypted_ballots        # From request
        )
        
        # Optionally store tally data if needed
        election_data['ciphertext_tally'] = ciphertext_tally_json
        election_data['submitted_ballots'] = submitted_ballots_json
        
        response = {
            'status': 'success',
            'ciphertext_tally': ciphertext_tally_json,
            'submitted_ballots': submitted_ballots_json
        }
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

def tally_encrypted_ballots(
    party_names,
    candidate_names,
    joint_public_key_json,
    commitment_hash_json,
    encrypted_ballots_json
) -> Tuple[Dict, List[Dict]]:
    """Tally encrypted ballots."""
    joint_public_key = int_to_p(joint_public_key_json)
    commitment_hash = int_to_q(commitment_hash_json)
    encrypted_ballots : List[CiphertextBallot] = []
    for encrypted_ballot_json in encrypted_ballots_json:
        encrypted_ballots.append(from_raw(CiphertextBallot, encrypted_ballot_json))
    
    manifest = create_election_manifest(party_names, candidate_names)
    
    # Create election builder and set public key and commitment hash
    election_builder = ElectionBuilder(
        number_of_guardians=1,
        quorum=1,
        manifest=manifest
    )
    election_builder.set_public_key(joint_public_key)
    election_builder.set_commitment_hash(commitment_hash)
    
    # Build the election context
    internal_manifest, context = get_optional(election_builder.build())
    
    # Create ballot store and ballot box
    ballot_store = DataStore()
    ballot_box = BallotBox(internal_manifest, context, ballot_store)
    
    # Submit ballots - cast all ballots and ensure their hashes are stored
    submitted_ballots = []
    for i, ballot in enumerate(encrypted_ballots):
        # Ensure ballot hash is stored before submission using ElectionGuard's native hash
        if ballot.object_id not in ballot_hashes:
            # Generate hash using ElectionGuard's native hash function
            ballot_hash = generate_ballot_hash_electionguard(ballot)
            ballot_hashes[ballot.object_id] = ballot_hash
            
        # Cast all ballots
        submitted = ballot_box.cast(ballot)
        if submitted:
            submitted_ballots.append(get_optional(submitted))
    
    # Tally the ballots
    ciphertext_tally = get_optional(
        tally_ballots(ballot_store, internal_manifest, context)
    )
    
    ciphertext_tally_json = ciphertext_tally_to_raw(ciphertext_tally)
    submitted_ballots_json = [to_raw(submitted_ballot) for submitted_ballot in submitted_ballots]
    return ciphertext_tally_json, submitted_ballots_json

@app.route('/create_partial_decryption', methods=['POST'])
def api_create_partial_decryption():
    """API endpoint to compute decryption shares for a single guardian."""
    try:
        data = request.json
        guardian_id = data['guardian_id']
        sequence_order = int(data['sequence_order'])  # Convert to int
        guardian_public_key = data['guardian_public_key']  # Expecting string
        guardian_private_key = data['guardian_private_key']  # Expecting string
        guardian_polynomial = data['guardian_polynomial']
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        ciphertext_tally_json = data['ciphertext_tally']  # From request
        submitted_ballots_json = data['submitted_ballots']  # From request
        joint_public_key = data['joint_public_key']  # Expecting string
        commitment_hash = data['commitment_hash']  # Expecting string
        number_of_guardians = int(data['number_of_guardians'])  # Convert to int

        # Convert string inputs to integers for internal processing
        guardian_public_key_int = int(guardian_public_key)
        guardian_private_key_int = int(guardian_private_key)
        joint_public_key_int = int(joint_public_key)
        commitment_hash_int = int(commitment_hash)
        
        shares = compute_guardian_decryption_shares(
            party_names=party_names,
            candidate_names=candidate_names,
            guardian_id=guardian_id,
            sequence_order=sequence_order,
            guardian_public_key=guardian_public_key_int,
            guardian_private_key=guardian_private_key_int,
            guardian_polynomial=guardian_polynomial,
            ciphertext_tally_json=ciphertext_tally_json,
            submitted_ballots_json=submitted_ballots_json,
            joint_public_key_json=joint_public_key_int,
            commitment_hash_json=commitment_hash_int,
            number_of_guardians=number_of_guardians
        )
        
        # Convert numeric outputs back to strings for response
        guardian_public_key_str = shares[0]
        tally_share_str = shares[1]
        ballot_shares_str = shares[2]
        
        # Optionally store the guardian shares
        if 'guardian_shares' not in election_data:
            election_data['guardian_shares'] = []
        election_data['guardian_shares'].append((guardian_public_key_str, tally_share_str, ballot_shares_str))
        
        response = {
            'status': 'success',
            'guardian_public_key': guardian_public_key_str,
            'tally_share': tally_share_str,
            'ballot_shares': ballot_shares_str
        }
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

def compute_guardian_decryption_shares(
    party_names,
    candidate_names,
    guardian_id: str,
    sequence_order: int,
    guardian_public_key: int,
    guardian_private_key: int,
    guardian_polynomial,
    ciphertext_tally_json,
    submitted_ballots_json,
    joint_public_key_json,
    commitment_hash_json,
    number_of_guardians
) -> Tuple[Dict, Optional[Dict], Dict[str, Optional[Dict]]]:
    """Compute decryption shares for a single guardian."""
    # Convert inputs to proper types
    public_key = int_to_p(guardian_public_key)
    private_key = int_to_q(guardian_private_key)
    polynomial = from_raw(ElectionPolynomial, guardian_polynomial)
    
    # Create election key pair for this guardian
    election_key = ElectionKeyPair(
        owner_id=guardian_id,
        sequence_order=sequence_order,
        key_pair=ElGamalKeyPair(private_key, public_key),
        polynomial=polynomial
    )
    
    manifest = create_election_manifest(party_names, candidate_names)
    election_builder = ElectionBuilder(
        number_of_guardians=number_of_guardians,
        quorum=number_of_guardians,
        manifest=manifest
    )
    
    # Set election parameters
    joint_public_key = int_to_p(joint_public_key_json)
    commitment_hash = int_to_q(commitment_hash_json)
    election_builder.set_public_key(joint_public_key)
    election_builder.set_commitment_hash(commitment_hash)
        
    # Build the election context
    internal_manifest, context = get_optional(election_builder.build())
    ciphertext_tally = raw_to_ciphertext_tally(ciphertext_tally_json, manifest=manifest)
    submitted_ballots = [
        from_raw(SubmittedBallot, ballot_json)
        for ballot_json in submitted_ballots_json
    ]

    # Compute shares
    guardian_public_key = election_key.share()
    tally_share = compute_decryption_share(election_key, ciphertext_tally, context)
    ballot_shares = compute_ballot_shares(election_key, submitted_ballots, context)
    
    # Serialize each component (output will be string-based JSON)
    serialized_public_key = to_raw(guardian_public_key) if guardian_public_key else None
    serialized_tally_share = to_raw(tally_share) if tally_share else None

    serialized_ballot_shares = {}
    for ballot_id, ballot_share in ballot_shares.items():
        serialized_ballot_shares[ballot_id] = to_raw(ballot_share) if ballot_share else None
    
    return serialized_public_key, serialized_tally_share, serialized_ballot_shares

@app.route('/combine_partial_decryption', methods=['POST'])
def api_combine_partial_decryption():
    """API endpoint to combine decryption shares and produce final election results."""
    try:
        data = request.json
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        joint_public_key = data['joint_public_key']  # Expecting string
        commitment_hash = data['commitment_hash']    # Expecting string
        ciphertext_tally_json = data['ciphertext_tally'] # From request
        submitted_ballots_json = data['submitted_ballots'] # From request
        guardian_public_keys = data['guardian_public_keys']  # Expecting string
        tally_shares = data['tally_shares']  # From request
        ballot_shares = data['ballot_shares']  # From request

        guardian_shares = []
        for i in range (len(ballot_shares)):
            guardian_shares.append((
                guardian_public_keys[i],
                tally_shares[i],
                ballot_shares[i]
            ))
     # From request
        
        if not guardian_shares:
            return jsonify({'status': 'error', 'message': 'No guardian shares provided'}), 400
        
        # Convert string inputs to integers for internal processing
        joint_public_key_int = int(joint_public_key)
        commitment_hash_int = int(commitment_hash)
        
        results = combine_decryption_shares(
            party_names=party_names,
            candidate_names=candidate_names,
            joint_public_key_json=joint_public_key_int,
            commitment_hash_json=commitment_hash_int,
            ciphertext_tally_json=ciphertext_tally_json,
            submitted_ballots_json=submitted_ballots_json,
            guardian_shares=guardian_shares
        )
        
        response = {
            'status': 'success',
            'results': results
        }
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    
    
def combine_decryption_shares(
    party_names: List[str],
    candidate_names: List[str],
    joint_public_key_json: int,
    commitment_hash_json: int,
    ciphertext_tally_json: Dict,
    submitted_ballots_json: List[Dict],
    guardian_shares: List[Tuple]
) -> Dict[str, Any]:
    """Combine decryption shares to produce final election results."""
    # Build election context
    manifest = create_election_manifest(party_names, candidate_names)
    election_builder = ElectionBuilder(
        number_of_guardians=len(guardian_shares),
        quorum=len(guardian_shares),
        manifest=manifest
    )
    joint_public_key = int_to_p(joint_public_key_json)
    commitment_hash = int_to_q(commitment_hash_json)
    election_builder.set_public_key(joint_public_key)
    election_builder.set_commitment_hash(commitment_hash)
    internal_manifest, context = get_optional(election_builder.build())
    
    # Process ciphertext tally and ballots
    ciphertext_tally = raw_to_ciphertext_tally(ciphertext_tally_json, manifest=manifest)
    submitted_ballots = [
        from_raw(SubmittedBallot, ballot_json)
        for ballot_json in submitted_ballots_json
    ]
    
    # Ensure all ballot hashes are populated
    ensure_ballot_hashes_populated(submitted_ballots)
    
    # Deserialize guardian shares
    deserialized_shares = []
    for serialized_tuple in guardian_shares:
        serialized_public_key, serialized_tally_share, serialized_ballot_shares = serialized_tuple
        public_key = from_raw(ElectionPublicKey, serialized_public_key) if serialized_public_key else None
        tally_share = from_raw(DecryptionShare, serialized_tally_share) if serialized_tally_share else None
        ballot_shares = {
            ballot_id: from_raw(DecryptionShare, serialized_ballot_share) 
            for ballot_id, serialized_ballot_share in serialized_ballot_shares.items()
            if serialized_ballot_share
        }
        deserialized_shares.append((public_key, tally_share, ballot_shares))
    
    # Configure decryption mediator
    decryption_mediator = DecryptionMediator("decryption-mediator", context)
    
    # Add all guardian shares
    for guardian_public_key, tally_share, ballot_shares in deserialized_shares:
        decryption_mediator.announce(
            guardian_public_key,
            get_optional(tally_share),
            ballot_shares
        )
    
    # Get plaintext results
    plaintext_tally = get_optional(decryption_mediator.get_plaintext_tally(ciphertext_tally, manifest))
    plaintext_spoiled_ballots = get_optional(decryption_mediator.get_plaintext_ballots(submitted_ballots, manifest))
    
    # Create sets of cast and spoiled ballot IDs for quick lookup
    cast_ballot_ids = ciphertext_tally.cast_ballot_ids
    spoiled_ballot_ids = ciphertext_tally.spoiled_ballot_ids
    
    # Format the complete results
    results = {
        'election': {
            'name': manifest.name,
            'scope_id': manifest.election_scope_id,
            'type': str(manifest.type),
            'start_date': manifest.start_date.isoformat(),
            'end_date': manifest.end_date.isoformat(),
            'geopolitical_units': [{
                'id': unit.object_id,
                'name': unit.name,
                'type': str(unit.type)
            } for unit in manifest.geopolitical_units],
            'parties': [{
                'id': party.object_id,
                'name': party.name
            } for party in manifest.parties],
            'candidates': [{
                'id': candidate.object_id,
                'name': candidate.name,
                'party_id': candidate.party_id
            } for candidate in manifest.candidates],
            'contests': [{
                'id': contest.object_id,
                'name': contest.name,
                'selections': [{
                    'id': selection.object_id,
                    'candidate_id': selection.candidate_id
                } for selection in contest.ballot_selections]
            } for contest in manifest.contests]
        },
        'results': {
            'total_ballots_cast': len(submitted_ballots),
            'total_valid_ballots': len(cast_ballot_ids),
            'total_spoiled_ballots': len(spoiled_ballot_ids),
            'candidates': {},
            'spoiled_ballots': []
        },
        'verification': {
            'ballots': [],
            'guardians': []
        }
    }
    
    # Process election results
    for contest in plaintext_tally.contests.values():
        for selection in contest.selections.values():
            candidate = selection.object_id
            results['results']['candidates'][candidate] = {
                'votes': str(selection.tally),  # Convert to string
                'percentage': str(round(selection.tally / len(cast_ballot_ids) * 100, 2)) if len(cast_ballot_ids) > 0 else "0"  # Convert to string
            }
    
    # Process spoiled ballots
    for ballot_id, ballot in plaintext_spoiled_ballots.items():
        if isinstance(ballot, PlaintextBallot):
            # Get initial hash (now guaranteed to exist due to ensure_ballot_hashes_populated)
            initial_hash = ballot_hashes[ballot_id]
            
            ballot_info = {
                'ballot_id': ballot_id,
                'initial_hash': initial_hash,
                'decrypted_hash': generate_ballot_hash(ballot),
                'status': 'spoiled',
                'selections': []
            }
            
            for contest in ballot.contests:
                for selection in contest.ballot_selections:
                    if selection.vote == 1:
                        ballot_info['selections'].append({
                            'contest_id': contest.object_id,
                            'selection_id': selection.object_id,
                            'vote': str(selection.vote)  # Convert to string
                        })
            
            results['results']['spoiled_ballots'].append(ballot_info)
    
    # Add ballot verification information
    for ballot in submitted_ballots:
        # Get initial hash (now guaranteed to exist due to ensure_ballot_hashes_populated)
        initial_hash = ballot_hashes[ballot.object_id]
        
        ballot_info = {
            'ballot_id': ballot.object_id,
            'initial_hash': initial_hash,
            'status': 'spoiled' if ballot.object_id in spoiled_ballot_ids else 'cast'
        }
        
        if ballot.object_id in spoiled_ballot_ids:
            # For spoiled ballots, generate hash from decrypted plaintext
            spoiled_ballot = plaintext_spoiled_ballots.get(ballot.object_id)
            if spoiled_ballot:
                ballot_info['decrypted_hash'] = generate_ballot_hash(spoiled_ballot)
                ballot_info['verification'] = 'success'
            else:
                ballot_info['decrypted_hash'] = 'N/A'
                ballot_info['verification'] = 'failed'
        else:
            # For cast ballots, the initial hash IS the encrypted ballot hash
            # Cast ballots are not decrypted individually, only tallied
            ballot_info['decrypted_hash'] = initial_hash
            ballot_info['verification'] = 'success'
        
        results['verification']['ballots'].append(ballot_info)
    
    # Add guardian information
    for i, (guardian_public_key, _, _) in enumerate(deserialized_shares):
        results['verification']['guardians'].append({
            'id': guardian_public_key.owner_id,
            'sequence_order': str(guardian_public_key.sequence_order),  # Convert to string
            'public_key': str(guardian_public_key.key)
        })
    
    return results

def ensure_ballot_hashes_populated(submitted_ballots: List[SubmittedBallot]) -> None:
    """Ensure that all submitted ballots have their hashes stored in the global ballot_hashes dictionary."""
    for ballot in submitted_ballots:
        if ballot.object_id not in ballot_hashes:
            # Generate and store the hash for this ballot using ElectionGuard's native hash
            # Note: This should rarely be called as hashes should be stored during encryption/tally
            ballot_hashes[ballot.object_id] = generate_ballot_hash_electionguard(ballot)

def clear_ballot_hashes() -> None:
    """Clear all stored ballot hashes. Useful for resetting state between elections."""
    global ballot_hashes
    ballot_hashes.clear()

@app.route('/clear_ballot_hashes', methods=['POST'])
def api_clear_ballot_hashes():
    """API endpoint to clear all stored ballot hashes."""
    try:
        clear_ballot_hashes()
        return jsonify({'status': 'success', 'message': 'Ballot hashes cleared'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/get_ballot_hashes', methods=['POST'])
def api_get_ballot_hashes():
    """API endpoint to get ballot hashes from a list of encrypted ballots."""
    try:
        data = request.json
        encrypted_ballots = data['encrypted_ballots']
        
        if not encrypted_ballots:
            return jsonify({'status': 'error', 'message': 'No encrypted ballots provided'}), 400
        
        ballot_hash_list = []
        
        for encrypted_ballot_json in encrypted_ballots:
            # Deserialize the encrypted ballot to get the object
            encrypted_ballot = from_raw(CiphertextBallot, encrypted_ballot_json)
            
            # Generate hash using ElectionGuard's native hash function
            ballot_hash = generate_ballot_hash_electionguard(encrypted_ballot)
            
            # Store the hash in global storage (optional, for consistency)
            ballot_hashes[encrypted_ballot.object_id] = ballot_hash
            
            # Add to result list
            ballot_hash_list.append({
                'object_id': encrypted_ballot.object_id,
                'ballot_hash': ballot_hash
            })
        
        response = {
            'status': 'success',
            'ballot_hashes': ballot_hash_list
        }
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)