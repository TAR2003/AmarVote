"""
Service for creating compensated decryption shares.
"""

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
from electionguard.key_ceremony import ElectionKeyPair, ElectionPublicKey, ElectionPartialKeyBackup
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


def create_compensated_decryption_service(
    party_names: List[str],
    candidate_names: List[str],
    available_guardian_id: str,
    missing_guardian_id: str,
    guardian_data: List[Dict],
    ciphertext_tally_json: Dict,
    submitted_ballots_json: List[Dict],
    joint_public_key: str,
    commitment_hash: str,
    number_of_guardians: int,
    quorum: int,
    create_election_manifest_func,
    raw_to_ciphertext_tally_func,
    compute_compensated_ballot_shares_func
) -> Dict[str, Any]:
    """
    Service function to compute compensated decryption shares for missing guardians.
    
    Args:
        party_names: List of party names
        candidate_names: List of candidate names
        available_guardian_id: ID of the available guardian
        missing_guardian_id: ID of the missing guardian
        guardian_data: List of guardian data
        ciphertext_tally_json: Serialized ciphertext tally
        submitted_ballots_json: List of serialized submitted ballots
        joint_public_key: Joint public key as string
        commitment_hash: Commitment hash as string
        number_of_guardians: Number of guardians
        quorum: Quorum threshold
        create_election_manifest_func: Function to create election manifest
        raw_to_ciphertext_tally_func: Function to deserialize ciphertext tally
        compute_compensated_ballot_shares_func: Function to compute compensated ballot shares
        
    Returns:
        Dictionary containing compensated shares
        
    Raises:
        ValueError: If guardian data is invalid or backup cannot be decrypted
    """
    # Convert string inputs to integers for internal processing
    joint_public_key_int = int(joint_public_key)
    commitment_hash_int = int(commitment_hash)
    
    # Find the available and missing guardian data
    available_guardian_info = None
    missing_guardian_info = None
    
    for gd in guardian_data:
        if gd['id'] == available_guardian_id:
            available_guardian_info = gd
        elif gd['id'] == missing_guardian_id:
            missing_guardian_info = gd
    
    if not available_guardian_info:
        raise ValueError(f"Available guardian {available_guardian_id} not found in guardian data")
    if not missing_guardian_info:
        raise ValueError(f"Missing guardian {missing_guardian_id} not found in guardian data")
    
    # Get the backup for the missing guardian from the available guardian
    backup_data = available_guardian_info.get('backups', {}).get(missing_guardian_id)
    if not backup_data:
        raise ValueError(f"No backup found for missing guardian {missing_guardian_id} in available guardian {available_guardian_id}")
    
    # Create election public keys
    available_guardian_public_key = from_raw(ElectionPublicKey, available_guardian_info['election_public_key'])
    missing_guardian_public_key = from_raw(ElectionPublicKey, missing_guardian_info['election_public_key'])
    
    # Decrypt the backup to get the coordinate
    backup = from_raw(ElectionPartialKeyBackup, backup_data)
    
    # Create available guardian's election key pair to decrypt backup
    available_private_key = int_to_q(int(available_guardian_info['private_key']))
    available_public_key = int_to_p(int(available_guardian_info['public_key']))
    available_polynomial = from_raw(ElectionPolynomial, available_guardian_info['polynomial'])
    
    available_election_key = ElectionKeyPair(
        owner_id=available_guardian_id,
        sequence_order=available_guardian_info['sequence_order'],
        key_pair=ElGamalKeyPair(available_private_key, available_public_key),
        polynomial=available_polynomial
    )
    
    # Decrypt the backup to get the missing guardian's coordinate
    missing_guardian_coordinate = decrypt_backup(backup, available_election_key)
    if not missing_guardian_coordinate:
        raise ValueError(f"Failed to decrypt backup for missing guardian {missing_guardian_id}")
    
    manifest = create_election_manifest_func(party_names, candidate_names)
    
    election_builder = ElectionBuilder(
        number_of_guardians=number_of_guardians,
        quorum=quorum,
        manifest=manifest
    )
    
    # Set election parameters
    joint_public_key_element = int_to_p(joint_public_key_int)
    commitment_hash_element = int_to_q(commitment_hash_int)
    election_builder.set_public_key(joint_public_key_element)
    election_builder.set_commitment_hash(commitment_hash_element)
        
    # Build the election context
    internal_manifest, context = get_optional(election_builder.build())
    ciphertext_tally = raw_to_ciphertext_tally_func(ciphertext_tally_json, manifest=manifest)
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
    
    compensated_ballot_shares = compute_compensated_ballot_shares_func(
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
