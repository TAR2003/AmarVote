"""
Service for creating partial decryption shares for a guardian.
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



def create_partial_decryption_service(
    party_names: List[str],
    candidate_names: List[str],
    guardian_id: str,
    guardian_data: List[Dict],
    ciphertext_tally_json: Dict,
    submitted_ballots_json: List[Dict],
    joint_public_key: str,
    commitment_hash: str,
    number_of_guardians: int,
    quorum: int,
    create_election_manifest_func,
    raw_to_ciphertext_tally_func,
    compute_ballot_shares_func
) -> Dict[str, Any]:
    """
    Service function to compute decryption shares for a single guardian.
    
    Args:
        party_names: List of party names
        candidate_names: List of candidate names
        guardian_id: ID of the guardian to compute shares for
        guardian_data: List of all guardian data
        ciphertext_tally_json: Serialized ciphertext tally
        submitted_ballots_json: List of serialized submitted ballots
        joint_public_key: Joint public key as string
        commitment_hash: Commitment hash as string
        number_of_guardians: Number of guardians
        quorum: Quorum for the election
        create_election_manifest_func: Function to create election manifest
        raw_to_ciphertext_tally_func: Function to deserialize ciphertext tally
        compute_ballot_shares_func: Function to compute ballot shares
        
    Returns:
        Dictionary containing the decryption shares
        
    Raises:
        ValueError: If guardian not found
    """
    # Convert string inputs to integers for internal processing
    joint_public_key_int = int(joint_public_key)
    commitment_hash_int = int(commitment_hash)
    
    shares = compute_guardian_decryption_shares(
        party_names,
        candidate_names,
        guardian_id,
        guardian_data,
        ciphertext_tally_json,
        submitted_ballots_json,
        joint_public_key_int,
        commitment_hash_int,
        number_of_guardians,
        quorum,
        create_election_manifest_func,
        raw_to_ciphertext_tally_func,
        compute_ballot_shares_func
    )
    
    return {
        'guardian_public_key': shares['guardian_public_key'],
        'tally_share': shares['tally_share'],
        'ballot_shares': shares['ballot_shares']
    }


def compute_guardian_decryption_shares(
    party_names: List[str],
    candidate_names: List[str],
    guardian_id: str,
    guardian_data: List[Dict],
    ciphertext_tally_json: Dict,
    submitted_ballots_json: List[Dict],
    joint_public_key_json: int,
    commitment_hash_json: int,
    number_of_guardians: int,
    quorum: int,
    create_election_manifest_func,
    raw_to_ciphertext_tally_func,
    compute_ballot_shares_func
) -> Dict[str, Any]:
    """
    Compute decryption shares for a single guardian.
    
    Args:
        party_names: List of party names
        candidate_names: List of candidate names
        guardian_id: ID of the guardian to compute shares for
        guardian_data: List of all guardian data
        ciphertext_tally_json: Serialized ciphertext tally
        submitted_ballots_json: List of serialized submitted ballots
        joint_public_key_json: Joint public key as integer
        commitment_hash_json: Commitment hash as integer
        number_of_guardians: Number of guardians
        quorum: Quorum for the election
        create_election_manifest_func: Function to create election manifest
        raw_to_ciphertext_tally_func: Function to deserialize ciphertext tally
        compute_ballot_shares_func: Function to compute ballot shares
        
    Returns:
        Dictionary containing the decryption shares
        
    Raises:
        ValueError: If guardian not found
    """
    # Find the guardian data for this guardian
    guardian_info = None
    for gd in guardian_data:
        if gd['id'] == guardian_id:
            guardian_info = gd
            break
    
    if not guardian_info:
        raise ValueError(f"Guardian {guardian_id} not found in guardian data")
    
    # Convert inputs to proper types
    public_key = int_to_p(int(guardian_info['public_key']))
    private_key = int_to_q(int(guardian_info['private_key']))
    polynomial = from_raw(ElectionPolynomial, guardian_info['polynomial'])
    
    # Create election key pair for this guardian
    election_key = ElectionKeyPair(
        owner_id=guardian_id,
        sequence_order=guardian_info['sequence_order'],
        key_pair=ElGamalKeyPair(private_key, public_key),
        polynomial=polynomial
    )
    
    manifest = create_election_manifest_func(party_names, candidate_names)
    
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
    ciphertext_tally = raw_to_ciphertext_tally_func(ciphertext_tally_json, manifest=manifest)
    submitted_ballots = [
        from_raw(SubmittedBallot, ballot_json)
        for ballot_json in submitted_ballots_json
    ]

    # Compute shares
    guardian_public_key = election_key.share()
    tally_share = compute_decryption_share(election_key, ciphertext_tally, context)
    ballot_shares = compute_ballot_shares_func(election_key, submitted_ballots, context)
    
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
