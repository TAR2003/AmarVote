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

app = Flask(__name__)



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


def compute_compensated_ballot_shares(
    missing_guardian_coordinate: ElementModQ,
    present_guardian_key: ElectionPublicKey,
    missing_guardian_key: ElectionPublicKey,
    ballots: List[SubmittedBallot],
    context: CiphertextElectionContext
) -> Dict[BallotId, Optional[CompensatedDecryptionShare]]:
    """Compute compensated decryption shares for ballots."""
    shares = {}
    for ballot in ballots:
        share = compute_compensated_decryption_share_for_ballot(
            missing_guardian_coordinate,
            missing_guardian_key,
            present_guardian_key,
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
        
        # Validate quorum
        if quorum > number_of_guardians:
            return jsonify({'status': 'error', 'message': 'Quorum cannot be greater than number of guardians'}), 400
        
        if quorum < 1:
            return jsonify({'status': 'error', 'message': 'Quorum must be at least 1'}), 400
        
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
        election_data['number_of_guardians'] = number_of_guardians
        election_data['quorum'] = quorum
        
        # Prepare guardian data including backups for quorum decryption
        guardian_data = []
        private_keys = []
        public_keys = []
        polynomials = []
        
        for guardian in guardians:
            guardian_info = {
                'id': guardian.id,
                'sequence_order': guardian.sequence_order,
                'election_public_key': to_raw(guardian.share_key()),
                'backups': {}
            }
            
            # Store backups for compensated decryption
            for other_guardian in guardians:
                if other_guardian.id != guardian.id:
                    backup = guardian._guardian_election_partial_key_backups.get(other_guardian.id)
                    if backup:
                        guardian_info['backups'][other_guardian.id] = to_raw(backup)
            
            guardian_data.append(guardian_info)
            
            # Store separate keys and polynomials
            private_keys.append({
                'guardian_id': guardian.id,
                'private_key': str(int(guardian._election_keys.key_pair.secret_key))
            })
            public_keys.append({
                'guardian_id': guardian.id,
                'public_key': str(int(guardian._election_keys.key_pair.public_key))
            })
            polynomials.append({
                'guardian_id': guardian.id,
                'polynomial': to_raw(guardian._election_keys.polynomial)
            })
        
        response = {
            'status': 'success',
            'joint_public_key': election_data['joint_public_key'],
            'commitment_hash': election_data['commitment_hash'],
            'manifest': to_raw(election_data['manifest']),
            'guardian_data': guardian_data,
            'private_keys': private_keys,
            'public_keys': public_keys,
            'polynomials': polynomials,
            'number_of_guardians': number_of_guardians,
            'quorum': quorum
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
            # ballot_hashes[encrypted_ballot.object_id] = ballot_hash
            
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
    
    # Use stored election data for accurate setup
    number_of_guardians = election_data.get('number_of_guardians', 1)
    quorum = election_data.get('quorum', 1)
    
    # Create election builder and set public key and commitment hash
    election_builder = ElectionBuilder(
        number_of_guardians=number_of_guardians,
        quorum=quorum,
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
    
    # Use stored election data for accurate setup
    number_of_guardians = election_data.get('number_of_guardians', 1)
    quorum = election_data.get('quorum', 1)
    
    # Create election builder and set public key and commitment hash
    election_builder = ElectionBuilder(
        number_of_guardians=number_of_guardians,
        quorum=quorum,
        manifest=manifest
    )
    election_builder.set_public_key(joint_public_key)
    election_builder.set_commitment_hash(commitment_hash)
    
    # Build the election context
    internal_manifest, context = get_optional(election_builder.build())
    
    # Create ballot store and ballot box
    ballot_store = DataStore()
    ballot_box = BallotBox(internal_manifest, context, ballot_store)
    
    # Submit ballots - cast all ballots
    submitted_ballots = []
    for i, ballot in enumerate(encrypted_ballots):
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
        guardian_data = data['guardian_data']  # Now expecting single guardian data string
        private_key = data['private_key']      # Now expecting single private key string
        public_key = data['public_key']        # Now expecting single public key string
        polynomial = data['polynomial']        # Now expecting single polynomial string
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        ciphertext_tally_json = data['ciphertext_tally']
        submitted_ballots_json = data['submitted_ballots']
        joint_public_key = data['joint_public_key']
        commitment_hash = data['commitment_hash']
        
        # Convert string inputs to integers for internal processing
        joint_public_key_int = int(joint_public_key)
        commitment_hash_int = int(commitment_hash)
        
        shares = compute_guardian_decryption_shares(
            party_names=party_names,
            candidate_names=candidate_names,
            guardian_id=guardian_id,
            guardian_data=guardian_data,
            private_key=private_key,
            public_key=public_key,
            polynomial=polynomial,
            ciphertext_tally_json=ciphertext_tally_json,
            submitted_ballots_json=submitted_ballots_json,
            joint_public_key_json=joint_public_key_int,
            commitment_hash_json=commitment_hash_int
        )
        
        response = {
            'status': 'success',
            'guardian_public_key': shares['guardian_public_key'],
            'tally_share': shares['tally_share'],
            'ballot_shares': shares['ballot_shares']
        }
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

def compute_guardian_decryption_shares(
    party_names,
    candidate_names,
    guardian_id: str,
    guardian_data: Dict,
    private_key: Dict,
    public_key: Dict,
    polynomial: Dict,
    ciphertext_tally_json,
    submitted_ballots_json,
    joint_public_key_json,
    commitment_hash_json
) -> Dict[str, Any]:
    """Compute decryption shares for a single guardian."""
    # Use the guardian data directly since it's for this specific guardian
    guardian_info = guardian_data
    
    if guardian_info['id'] != guardian_id:
        raise ValueError(f"Guardian data ID {guardian_info['id']} does not match expected guardian ID {guardian_id}")
    
    # Use the provided key and polynomial data directly
    private_key_info = private_key
    public_key_info = public_key
    polynomial_info = polynomial
    
    if not private_key_info or not public_key_info or not polynomial_info:
        raise ValueError(f"Missing key or polynomial data for guardian {guardian_id}")
    
    # Convert inputs to proper types
    public_key_element = int_to_p(int(public_key_info['public_key']))
    private_key_element = int_to_q(int(private_key_info['private_key']))
    polynomial_element = from_raw(ElectionPolynomial, polynomial_info['polynomial'])
    
    # Create election key pair for this guardian
    election_key = ElectionKeyPair(
        owner_id=guardian_id,
        sequence_order=guardian_info['sequence_order'],
        key_pair=ElGamalKeyPair(private_key_element, public_key_element),
        polynomial=polynomial_element
    )
    
    manifest = create_election_manifest(party_names, candidate_names)
    
    # Use stored election data for accurate setup
    number_of_guardians = election_data.get('number_of_guardians', 3)  # Default reasonable value
    quorum = election_data.get('quorum', 2)  # Default reasonable value
    
    election_builder = ElectionBuilder(
        number_of_guardians=number_of_guardians,
        quorum=quorum,
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
    
    # Serialize each component
    serialized_public_key = to_raw(guardian_public_key) if guardian_public_key else None
    serialized_tally_share = to_raw(tally_share) if tally_share else None

    serialized_ballot_shares = {}
    for ballot_id, ballot_share in ballot_shares.items():
        serialized_ballot_shares[ballot_id] = to_raw(ballot_share) if ballot_share else None
    
    return {
        'guardian_public_key': serialized_public_key,
        'tally_share': serialized_tally_share,
        'ballot_shares': serialized_ballot_shares
    }

@app.route('/create_compensated_decryption', methods=['POST'])
def api_create_compensated_decryption():
    """API endpoint to compute compensated decryption shares for missing guardians."""
    try:
        data = request.json
        available_guardian_id = data['available_guardian_id']
        missing_guardian_id = data['missing_guardian_id']
        available_guardian_data = data['available_guardian_data']
        missing_guardian_data = data['missing_guardian_data']
        available_private_key = data['available_private_key']
        available_public_key = data['available_public_key']
        available_polynomial = data['available_polynomial']
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        ciphertext_tally_json = data['ciphertext_tally']
        submitted_ballots_json = data['submitted_ballots']
        joint_public_key = data['joint_public_key']
        commitment_hash = data['commitment_hash']
        
        # Convert string inputs to integers for internal processing
        joint_public_key_int = int(joint_public_key)
        commitment_hash_int = int(commitment_hash)
        
        shares = compute_compensated_guardian_decryption_shares(
            party_names=party_names,
            candidate_names=candidate_names,
            available_guardian_id=available_guardian_id,
            missing_guardian_id=missing_guardian_id,
            available_guardian_data=available_guardian_data,
            missing_guardian_data=missing_guardian_data,
            available_private_key=available_private_key,
            available_public_key=available_public_key,
            available_polynomial=available_polynomial,
            ciphertext_tally_json=ciphertext_tally_json,
            submitted_ballots_json=submitted_ballots_json,
            joint_public_key_json=joint_public_key_int,
            commitment_hash_json=commitment_hash_int
        )
        
        response = {
            'status': 'success',
            'compensated_tally_share': shares['compensated_tally_share'],
            'compensated_ballot_shares': shares['compensated_ballot_shares']
        }
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

def compute_compensated_guardian_decryption_shares(
    party_names,
    candidate_names,
    available_guardian_id: str,
    missing_guardian_id: str,
    available_guardian_data: Dict,
    missing_guardian_data: Dict,
    available_private_key: Dict,
    available_public_key: Dict,
    available_polynomial: Dict,
    ciphertext_tally_json,
    submitted_ballots_json,
    joint_public_key_json,
    commitment_hash_json
) -> Dict[str, Any]:
    """Compute compensated decryption shares for a missing guardian."""
    # Use the guardian data directly
    available_guardian_info = available_guardian_data
    missing_guardian_info = missing_guardian_data
    
    if available_guardian_info['id'] != available_guardian_id:
        raise ValueError(f"Available guardian data ID {available_guardian_info['id']} does not match expected ID {available_guardian_id}")
    if missing_guardian_info['id'] != missing_guardian_id:
        raise ValueError(f"Missing guardian data ID {missing_guardian_info['id']} does not match expected ID {missing_guardian_id}")
    
    # Get the backup for the missing guardian from the available guardian
    backup_data = available_guardian_info.get('backups', {}).get(missing_guardian_id)
    if not backup_data:
        raise ValueError(f"No backup found for missing guardian {missing_guardian_id} in available guardian {available_guardian_id}")
    
    # Create election public keys
    available_guardian_public_key = from_raw(ElectionPublicKey, available_guardian_info['election_public_key'])
    missing_guardian_public_key = from_raw(ElectionPublicKey, missing_guardian_info['election_public_key'])
    
    # Decrypt the backup to get the coordinate
    from electionguard.key_ceremony import ElectionPartialKeyBackup
    backup = from_raw(ElectionPartialKeyBackup, backup_data)
    
    # Use the provided key and polynomial data directly
    available_private_key_info = available_private_key
    available_polynomial_info = available_polynomial
    
    if not available_private_key_info or not available_polynomial_info:
        raise ValueError(f"Missing key or polynomial data for available guardian {available_guardian_id}")
    
    # Create available guardian's election key pair to decrypt backup
    available_private_key_element = int_to_q(int(available_private_key_info['private_key']))
    
    # Use the provided public key data directly
    available_public_key_info = available_public_key
    
    if not available_public_key_info:
        raise ValueError(f"Missing public key data for available guardian {available_guardian_id}")
    
    available_public_key_element = int_to_p(int(available_public_key_info['public_key']))
    available_polynomial_element = from_raw(ElectionPolynomial, available_polynomial_info['polynomial'])
    
    available_election_key = ElectionKeyPair(
        owner_id=available_guardian_id,
        sequence_order=available_guardian_info['sequence_order'],
        key_pair=ElGamalKeyPair(available_private_key_element, available_public_key_element),
        polynomial=available_polynomial_element
    )
    
    # Decrypt the backup to get the missing guardian's coordinate
    missing_guardian_coordinate = decrypt_backup(backup, available_election_key)
    if not missing_guardian_coordinate:
        raise ValueError(f"Failed to decrypt backup for missing guardian {missing_guardian_id}")
    
    manifest = create_election_manifest(party_names, candidate_names)
    
    # Use stored election data for accurate setup
    number_of_guardians = election_data.get('number_of_guardians', 3)  # Default reasonable value
    quorum = election_data.get('quorum', 2)  # Default reasonable value
    
    election_builder = ElectionBuilder(
        number_of_guardians=number_of_guardians,
        quorum=quorum,
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

    # Compute compensated shares
    compensated_tally_share = compute_compensated_decryption_share(
        missing_guardian_coordinate,
        available_guardian_public_key,
        missing_guardian_public_key,
        ciphertext_tally,
        context
    )
    
    compensated_ballot_shares = compute_compensated_ballot_shares(
        missing_guardian_coordinate,
        available_guardian_public_key,
        missing_guardian_public_key,
        submitted_ballots,
        context
    )
    
    # Serialize each component
    serialized_tally_share = to_raw(compensated_tally_share) if compensated_tally_share else None
    serialized_ballot_shares = {}
    for ballot_id, ballot_share in compensated_ballot_shares.items():
        serialized_ballot_shares[ballot_id] = to_raw(ballot_share) if ballot_share else None
    
    return {
        'compensated_tally_share': serialized_tally_share,
        'compensated_ballot_shares': serialized_ballot_shares
    }

@app.route('/combine_decryption_shares', methods=['POST'])
def api_combine_decryption_shares():
    """API endpoint to combine decryption shares with quorum support."""
    try:
        data = request.json
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        joint_public_key = data['joint_public_key']
        commitment_hash = data['commitment_hash']
        ciphertext_tally_json = data['ciphertext_tally']
        submitted_ballots_json = data['submitted_ballots']
        guardian_data = data['guardian_data']
        
        # Regular decryption shares from available guardians
        available_guardian_shares = data.get('available_guardian_shares', {})
        
        # Compensated decryption shares for missing guardians
        compensated_shares = data.get('compensated_shares', {})
        
        # Get the required quorum
        quorum = data.get('quorum', len(guardian_data))
        
        # Convert string inputs to integers for internal processing
        joint_public_key_int = int(joint_public_key)
        commitment_hash_int = int(commitment_hash)
        
        results = combine_decryption_shares_with_quorum(
            party_names=party_names,
            candidate_names=candidate_names,
            joint_public_key_json=joint_public_key_int,
            commitment_hash_json=commitment_hash_int,
            ciphertext_tally_json=ciphertext_tally_json,
            submitted_ballots_json=submitted_ballots_json,
            guardian_data=guardian_data,
            available_guardian_shares=available_guardian_shares,
            compensated_shares=compensated_shares,
            quorum=quorum
        )
        
        response = {
            'status': 'success',
            'results': results
        }
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

def combine_decryption_shares_with_quorum(
    party_names: List[str],
    candidate_names: List[str],
    joint_public_key_json: int,
    commitment_hash_json: int,
    ciphertext_tally_json: Dict,
    submitted_ballots_json: List[Dict],
    guardian_data: List[Dict],
    available_guardian_shares: Dict[str, Dict],
    compensated_shares: Dict[str, Dict],
    quorum: int
) -> Dict[str, Any]:
    """Combine decryption shares to produce final election results with quorum support."""
    # Build election context
    manifest = create_election_manifest(party_names, candidate_names)
    
    # Use stored election data for accurate setup
    number_of_guardians = len(guardian_data)
    
    election_builder = ElectionBuilder(
        number_of_guardians=number_of_guardians,
        quorum=quorum,
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
    
    # Configure decryption mediator
    decryption_mediator = DecryptionMediator("decryption-mediator", context)
    
    # First, get all guardian keys from guardian data
    all_guardian_keys = []
    for guardian_info in guardian_data:
        election_public_key = from_raw(ElectionPublicKey, guardian_info['election_public_key'])
        all_guardian_keys.append(election_public_key)
    
    # Add available guardian shares (normal decryption shares)
    for guardian_id, share_data in available_guardian_shares.items():
        guardian_public_key = from_raw(ElectionPublicKey, share_data['guardian_public_key'])
        tally_share = from_raw(DecryptionShare, share_data['tally_share']) if share_data['tally_share'] else None
        
        ballot_shares = {}
        for ballot_id, serialized_ballot_share in share_data['ballot_shares'].items():
            if serialized_ballot_share:
                ballot_shares[ballot_id] = from_raw(DecryptionShare, serialized_ballot_share)
        
        decryption_mediator.announce(guardian_public_key, tally_share, ballot_shares)
    
    # Announce missing guardians
    for missing_guardian_id in compensated_shares.keys():
        missing_guardian_info = next((gd for gd in guardian_data if gd['id'] == missing_guardian_id), None)
        if missing_guardian_info:
            missing_guardian_public_key = from_raw(ElectionPublicKey, missing_guardian_info['election_public_key'])
            decryption_mediator.announce_missing(missing_guardian_public_key)
    
    # Add compensated shares for missing guardians
    for missing_guardian_id, compensated_data in compensated_shares.items():
        for available_guardian_id, comp_share_data in compensated_data.items():
            if comp_share_data.get('compensated_tally_share'):
                compensated_tally_share = from_raw(CompensatedDecryptionShare, comp_share_data['compensated_tally_share'])
                decryption_mediator.receive_tally_compensation_share(compensated_tally_share)
            
            if comp_share_data.get('compensated_ballot_shares'):
                compensated_ballot_shares = {}
                for ballot_id, serialized_comp_ballot_share in comp_share_data['compensated_ballot_shares'].items():
                    if serialized_comp_ballot_share:
                        compensated_ballot_shares[ballot_id] = from_raw(CompensatedDecryptionShare, serialized_comp_ballot_share)
                
                decryption_mediator.receive_ballot_compensation_shares(compensated_ballot_shares)
    
    # Reconstruct shares for missing guardians
    decryption_mediator.reconstruct_shares_for_tally(ciphertext_tally)
    decryption_mediator.reconstruct_shares_for_ballots(submitted_ballots)
    
    # Validate that the mediator has all required guardian keys
    if not decryption_mediator.validate_missing_guardians(all_guardian_keys):
        raise ValueError("Failed to validate missing guardians")
    
    # Ensure announcement is complete
    if not decryption_mediator.announcement_complete():
        raise ValueError("Announcement not complete - insufficient guardians or shares")
    
    # Get plaintext results
    plaintext_tally = decryption_mediator.get_plaintext_tally(ciphertext_tally, manifest)
    if plaintext_tally is None:
        raise ValueError("Failed to decrypt tally - plaintext_tally is None")
    
    plaintext_spoiled_ballots = decryption_mediator.get_plaintext_ballots(submitted_ballots, manifest)
    if plaintext_spoiled_ballots is None:
        plaintext_spoiled_ballots = {}
    
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
            'number_of_guardians': number_of_guardians,
            'quorum': quorum,
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
                'votes': str(selection.tally),
                'percentage': str(round(selection.tally / len(cast_ballot_ids) * 100, 2)) if len(cast_ballot_ids) > 0 else "0"
            }
    
    # Process spoiled ballots
    for ballot_id, ballot in plaintext_spoiled_ballots.items():
        if isinstance(ballot, PlaintextBallot):
            # Find the original ballot to compute its initial hash
            original_ballot = next((b for b in submitted_ballots if b.object_id == ballot_id), None)
            initial_hash = generate_ballot_hash_electionguard(original_ballot) if original_ballot else "N/A"
            
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
                            'vote': str(selection.vote)
                        })
            
            results['results']['spoiled_ballots'].append(ballot_info)
    
    # Add ballot verification information
    for ballot in submitted_ballots:
        initial_hash = generate_ballot_hash_electionguard(ballot)
        
        ballot_info = {
            'ballot_id': ballot.object_id,
            'initial_hash': initial_hash,
            'status': 'spoiled' if ballot.object_id in spoiled_ballot_ids else 'cast'
        }
        
        if ballot.object_id in spoiled_ballot_ids:
            spoiled_ballot = plaintext_spoiled_ballots.get(ballot.object_id)
            if spoiled_ballot:
                ballot_info['decrypted_hash'] = generate_ballot_hash(spoiled_ballot)
                ballot_info['verification'] = 'success'
            else:
                ballot_info['decrypted_hash'] = 'N/A'
                ballot_info['verification'] = 'failed'
        else:
            ballot_info['decrypted_hash'] = initial_hash
            ballot_info['verification'] = 'success'
        
        results['verification']['ballots'].append(ballot_info)
    
    # Add guardian information
    for guardian_id, share_data in available_guardian_shares.items():
        guardian_public_key = from_raw(ElectionPublicKey, share_data['guardian_public_key'])
        results['verification']['guardians'].append({
            'id': guardian_public_key.owner_id,
            'sequence_order': str(guardian_public_key.sequence_order),
            'public_key': str(guardian_public_key.key),
            'status': 'available'
        })
    
    # Add missing guardian information
    for missing_guardian_id in compensated_shares.keys():
        guardian_info = next((gd for gd in guardian_data if gd['id'] == missing_guardian_id), None)
        if guardian_info:
            results['verification']['guardians'].append({
                'id': missing_guardian_id,
                'sequence_order': str(guardian_info['sequence_order']),
                'public_key': guardian_info['public_key'],
                'status': 'missing (compensated)'
            })
    
    return results





if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
