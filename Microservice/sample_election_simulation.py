#!/usr/bin/env python

from typing import Dict, List, Optional, Tuple, Any
import random
from datetime import datetime
import uuid
from collections import defaultdict

# ElectionGuard imports
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
from electionguard.group import *
from electionguard.decryption_share import DecryptionShare
from electionguard.decryption import compute_decryption_share, compute_decryption_share_for_ballot

# Global variable to track voter choices
voter_choices = defaultdict(dict)

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
        ballot_contests.append(  # Fixed: Now properly creating list of contests
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
def setup_guardians_and_joint_key(number_of_guardians: int, quorum: int) -> Tuple[List[Guardian], ElementModP, ElementModQ]:
    """
    First function: Setup guardians and create joint key.
    Returns list of guardians, the joint public key, and commitment hash.
    """
    print("\n🔹 Setting up guardians and creating joint key")
    
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
        print(f"✅ Created Guardian {i+1} with ID: {guardian.id}")
    
    # Setup Key Ceremony Mediator
    mediator = KeyCeremonyMediator(
        "key-ceremony-mediator", 
        guardians[0].ceremony_details
    )
    
    # ROUND 1: Public Key Sharing
    for guardian in guardians:
        mediator.announce(guardian.share_key())
        print(f"   ✅ Guardian {guardian.id} announced public key")
        
    # Share Keys
    for guardian in guardians:
        announced_keys = get_optional(mediator.share_announced())
        for key in announced_keys:
            if guardian.id != key.owner_id:
                guardian.save_guardian_key(key)
                print(f"   ✅ Guardian {guardian.id} saved key from Guardian {key.owner_id}")
    
    # ROUND 2: Election Partial Key Backup Sharing
    for sending_guardian in guardians:
        sending_guardian.generate_election_partial_key_backups()
        print(f"   ✅ Guardian {sending_guardian.id} generated partial key backups")
        
        backups = []
        for designated_guardian in guardians:
            if designated_guardian.id != sending_guardian.id:
                backup = get_optional(
                    sending_guardian.share_election_partial_key_backup(
                        designated_guardian.id
                    )
                )
                backups.append(backup)
                print(f"   ✅ Guardian {sending_guardian.id} created backup for Guardian {designated_guardian.id}")
        
        mediator.receive_backups(backups)
        print(f"   ✅ Mediator received {len(backups)} backups from Guardian {sending_guardian.id}")
    
    # Receive Backups
    for designated_guardian in guardians:
        backups = get_optional(mediator.share_backups(designated_guardian.id))
        print(f"   ✅ Mediator shared {len(backups)} backups for Guardian {designated_guardian.id}")
        
        for backup in backups:
            designated_guardian.save_election_partial_key_backup(backup)
            print(f"   ✅ Guardian {designated_guardian.id} saved backup from Guardian {backup.owner_id}")
    
    # ROUND 3: Verification of Backups
    for designated_guardian in guardians:
        verifications = []
        for backup_owner in guardians:
            if designated_guardian.id != backup_owner.id:
                verification = designated_guardian.verify_election_partial_key_backup(
                    backup_owner.id
                )
                verifications.append(get_optional(verification))
                print(f"   ✅ Guardian {designated_guardian.id} verified backup from Guardian {backup_owner.id}")
        
        mediator.receive_backup_verifications(verifications)
        print(f"   ✅ Mediator received {len(verifications)} verifications from Guardian {designated_guardian.id}")
    
    # FINAL: Publish Joint Key
    joint_key = get_optional(mediator.publish_joint_key())
    print(f"✅ Joint election key published: {joint_key.joint_public_key}")
    print(f"✅ Commitment hash: {joint_key.commitment_hash}")
    
    guardian_public_keys_json = [int(g._election_keys.key_pair.public_key) for g in guardians]  # List of ElementModP
    guardian_private_keys_json = [int(g._election_keys.key_pair.secret_key) for g in guardians]  # List of ElementModQ 
    guardian_polynomials_json = [to_raw(g._election_keys.polynomial) for g in guardians]
    joint_public_key = ElementModP(joint_key.joint_public_key)
    commitment_hash = ElementModQ(joint_key.commitment_hash)
    return guardian_public_keys_json, guardian_private_keys_json, guardian_polynomials_json, joint_public_key, commitment_hash

def encrypt_ballot(
    party_names,
    candidate_names,
    joint_public_key_json,
    commitment_hash_json,
    plaintext_ballot
) -> Optional[CiphertextBallot]:
    """
    Second function: Encrypt a single ballot.
    Returns the encrypted ballot or None if encryption fails.
    """
    joint_public_key = int_to_p(joint_public_key_json)
    commitment_hash = int_to_q(commitment_hash_json)
    # plaintext_ballot = from_raw(PlaintextBallot, plaintext_ballot_json)
    manifest = create_election_manifest(
        party_names,
        candidate_names,
    )
    print(f"\n🔹 Encrypting ballot: {plaintext_ballot.object_id}")
    
    # Create election builder and set public key and commitment hash
    election_builder = ElectionBuilder(
        number_of_guardians=1,  # Doesn't matter for encryption
        quorum=1,              # Doesn't matter for encryption
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
        print(f"✅ Successfully encrypted ballot: {plaintext_ballot.object_id}")
        return get_optional(encrypted_ballot)
    else:
        print(f"❌ Failed to encrypt ballot: {plaintext_ballot.object_id}")
        return None

def tally_encrypted_ballots(
    party_names,
    candidate_names,
    joint_public_key_json,
    commitment_hash_json,
    encrypted_ballots_json
) -> Tuple[CiphertextTally, List[SubmittedBallot]]:
    """
    Third function: Tally encrypted ballots.
    Returns the ciphertext tally and list of submitted ballots.
    """
    print("\n🔹 Tallying encrypted ballots")
    joint_public_key = int_to_p(joint_public_key_json)
    commitment_hash = int_to_q(commitment_hash_json)
    encrypted_ballots : List[CiphertextBallot] = []
    for encrypted_ballot_json in encrypted_ballots_json:
        encrypted_ballots.append(from_raw(CiphertextBallot, encrypted_ballot_json))
    manifest = create_election_manifest(
        party_names,
        candidate_names,
    )
    
    
    # Create election builder and set public key and commitment hash
    election_builder = ElectionBuilder(
        number_of_guardians=1,  # Doesn't matter for tally
        quorum=1,               # Doesn't matter for tally
        manifest=manifest
    )
    election_builder.set_public_key(joint_public_key)
    election_builder.set_commitment_hash(commitment_hash)
    
    # Build the election context
    internal_manifest, context = get_optional(election_builder.build())
    
    # Create ballot store and ballot box
    ballot_store = DataStore()
    ballot_box = BallotBox(internal_manifest, context, ballot_store)
    print(f"All ballots: {encrypted_ballots}")
    # Submit all ballots (cast or spoil randomly)
    submitted_ballots = []
    for ballot in encrypted_ballots:
        submitted = ballot_box.cast(ballot)
        if submitted:
            submitted_ballots.append(get_optional(submitted))
            print(f"✅ Cast ballot: {ballot.object_id}")
        
    
    # Tally the ballots
    
    ciphertext_tally = get_optional(
        tally_ballots(ballot_store, internal_manifest, context)
    )
    print(f"✅ Created encrypted tally with {ciphertext_tally.cast()} cast ballots")
    print(f"Submitted Ballots: {submitted_ballots}" )
    # print(f"submitter ballots: {submitted_ballots}")
    ciphertext_tally_json = ciphertext_tally_to_raw(ciphertext_tally)
    
    submitted_ballots = [to_raw(submitted_ballot) for submitted_ballot in submitted_ballots]
    return ciphertext_tally_json, submitted_ballots


def compute_tally_share(
        _election_keys: ElectionKeyPair,
        tally: CiphertextTally, context: CiphertextElectionContext
    ) -> Optional[DecryptionShare]:
        """
        Compute the decryption share of tally.

        :param tally: Ciphertext tally to get share of
        :param context: Election context
        :return: Decryption share of tally or None if failure
        """
        return compute_decryption_share(
            _election_keys,
            tally,
            context,
        )

def compute_ballot_shares(
    _election_keys: ElectionKeyPair,
    ballots: List[SubmittedBallot], context: CiphertextElectionContext
) -> Dict[BallotId, Optional[DecryptionShare]]:
    """
    Compute the decryption shares of ballots.    :param ballots: List of ciphertext ballots to gethares of
    :param context: Election context
    :return: Decryption shares of ballots or None ifailure
    """
    shares = {}
    for ballot in ballots:
        share = compute_decryption_share_for_ballot(
            _election_keys,
            ballot,
            context,
        )
        shares[ballot.object_id] = share
    return shares


def newfunction(
    _election_keys: List[ElectionKeyPair],
    manifest: Manifest,
    ciphertext_tally: CiphertextTally,
    submitted_ballots: List[SubmittedBallot],
    election_builder: ElectionBuilder
) -> Tuple[PlaintextTally, Dict[BallotId, PlaintextTally]]:
    """
    Fourth function: Decrypt tally and spoiled ballots.
    Returns the plaintext tally and dictionary of spoiled ballot decryptions.
    """
    print("\n🔹 Decrypting tally and spoiled ballots")
    

    
    # For decryption, we don't actually need to set the public key or commitment hash
    internal_manifest, context = get_optional(election_builder.build())
    
    # Configure the Decryption Mediator
    decryption_mediator = DecryptionMediator(
        "decryption-mediator",
        context,
    )
    
    # Have each guardian participate in the decryption
    for election_key in _election_keys:
        # Each guardian computes their share of the tally
        guardian_key = election_key.share()
        tally_share = compute_tally_share(election_key, ciphertext_tally, context)
        ballot_shares = compute_ballot_shares(election_key, submitted_ballots, context)
        
        # Guardian announces their share
        decryption_mediator.announce(
            guardian_key, 
            get_optional(tally_share),
            ballot_shares
        )

        print(f"✅ Guardian {election_key.owner_id} computed and shared decryption shares")
    
    # Get the plaintext tally
    plaintext_tally = get_optional(
        decryption_mediator.get_plaintext_tally(ciphertext_tally, manifest)
    )
    print("✅ Successfully decrypted tally")
    
    # Get the plaintext spoiled ballots
    plaintext_spoiled_ballots = get_optional(
        decryption_mediator.get_plaintext_ballots(submitted_ballots, manifest)
    )
    print(f"✅ Successfully decrypted {len(plaintext_spoiled_ballots)} spoiled ballots")
    
    return plaintext_tally, plaintext_spoiled_ballots


def decrypt_tally_and_ballots(
    guardian_public_keys_json,
    guardian_private_keys_json,
    guardian_polynomials_json,
    party_names,
    candidate_names,
    ciphertext_tally_json,
    submitted_ballots_json,
    joint_public_key_json,
    commitment_hash_json
) -> Dict[str, Any]:
    try:
        # 1. Create election manifest and setup
        manifest = create_election_manifest(party_names, candidate_names)
        election_builder = ElectionBuilder(
            number_of_guardians=len(guardian_public_keys_json),
            quorum=len(guardian_public_keys_json),
            manifest=manifest
        )
        
        # 2. Set election parameters
        joint_public_key = int_to_p(joint_public_key_json)
        commitment_hash = int_to_q(commitment_hash_json)
        election_builder.set_public_key(joint_public_key)
        election_builder.set_commitment_hash(commitment_hash)
        
        # 3. Prepare guardian data
        guardian_ids = [f"guardian-{i}" for i in range(len(guardian_public_keys_json))]
        _election_keys = [
            ElectionKeyPair(
                owner_id=guardian_ids[i],
                sequence_order=i,
                key_pair=ElGamalKeyPair(
                    int_to_q(guardian_private_keys_json[i]),
                    int_to_p(guardian_public_keys_json[i])
                ),
                polynomial=from_raw(ElectionPolynomial, guardian_polynomials_json[i])
            )
            for i in range(len(guardian_public_keys_json))
        ]

        # 4. Build election context
        internal_manifest, context = get_optional(election_builder.build())
        
        # 5. Prepare tally and ballots
        ciphertext_tally = raw_to_ciphertext_tally(ciphertext_tally_json, manifest=manifest)
        submitted_ballots = [
            from_raw(SubmittedBallot, ballot_json)
            for ballot_json in submitted_ballots_json
        ]

        # 6. Configure decryption mediator
        decryption_mediator = DecryptionMediator(
            "decryption-mediator",
            context,
        )

        # 7. Process each guardian's shares
        for election_key in _election_keys:
            guardian_key = election_key.share()
            tally_share = compute_tally_share(election_key, ciphertext_tally, context)
            ballot_shares = compute_ballot_shares(election_key, submitted_ballots, context)
            
            decryption_mediator.announce(
                guardian_key,
                get_optional(tally_share),
                ballot_shares
            )

        # 8. Get decrypted results
        plaintext_tally = get_optional(
            decryption_mediator.get_plaintext_tally(ciphertext_tally, manifest)
        )
        plaintext_spoiled_ballots = get_optional(
            decryption_mediator.get_plaintext_ballots(submitted_ballots, manifest)
        )
        
        # Process the results
        election_results = {}
        for contest_id, contest in plaintext_tally.contests.items():
            election_results[contest_id] = {}
            for selection_id, selection in contest.selections.items():
                election_results[contest_id][selection_id] = {
                    "tally": selection.tally,
                    "name": selection_id  # or get candidate name from manifest
                }
        
        spoiled_ballots_info = get_spoiled_ballot_info(
            plaintext_spoiled_ballots,
            party_names,
            candidate_names
        )

        result = {
            "election_results": election_results,
            "spoiled_ballots": spoiled_ballots_info,
            "success": True,
            "message": "Decryption completed successfully"
        }
        if result.get("success"):
            print("\nElection Results:")
            for contest_id, contest in result["election_results"].items():
                print(f"\nContest: {contest_id}")
                for selection_id, selection in contest.items():
                    print(f"  {selection_id}: {selection['tally']} votes")

            print("\nSpoiled Ballots:")
            for ballot in result["spoiled_ballots"]:
                print(f"\nBallot ID: {ballot['ballot_id']}")
                for selection in ballot["selections"]:
                    print(f"  Voted for: {selection['candidate']}")
        else:
            print(f"\nError: {result['message']}")

    except Exception as e:
        return {
            "success": False,
            "message": f"Decryption failed: {str(e)}"
        }
from electionguard.serialize import to_raw, from_raw
from electionguard.manifest import Manifest, InternalManifest
import json


from electionguard.tally import CiphertextTally, CiphertextTallyContest, CiphertextTallySelection
from electionguard.elgamal import ElGamalCiphertext
from typing import Dict

import json
import inspect
from enum import Enum

 
def compute_guardian_decryption_shares(
    guardian_id: str,
    sequence_order: int,
    guardian_public_key: int,
    guardian_private_key: int,
    guardian_polynomial: dict,
    ciphertext_tally: CiphertextTally,
    submitted_ballots: List[SubmittedBallot],
    election_builder: ElectionBuilder
) -> Tuple[ElectionPublicKey, Optional[DecryptionShare], Dict[BallotId, Optional[DecryptionShare]]]:
    """
    Compute decryption shares for a single guardian.
    Returns the guardian's public key, tally share, and ballot shares.
    """
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
    
    # Build the election context
    internal_manifest, context = get_optional(election_builder.build())
    
    # Compute shares
    guardian_public_key = election_key.share()
    tally_share = compute_decryption_share(election_key, ciphertext_tally, context)
    ballot_shares = compute_ballot_shares(election_key, submitted_ballots, context)
    
    print(f"✅ Guardian {guardian_id} computed decryption shares")

    public_key = guardian_public_key

    # Serialize each component
    serialized_public_key = to_raw(public_key) if public_key else None
    serialized_tally_share = to_raw(tally_share) if tally_share else None

    serialized_ballot_shares = {}
    for ballot_id, ballot_share in ballot_shares.items():
        serialized_ballot_shares[ballot_id] = to_raw(ballot_share) if ballot_share else None

    
    return serialized_public_key, serialized_tally_share,  serialized_ballot_shares


def compute_ballot_shares(
    _election_keys: ElectionKeyPair,
    ballots: List[SubmittedBallot], context: CiphertextElectionContext
) -> Dict[BallotId, Optional[DecryptionShare]]:
    """
    Compute the decryption shares of ballots.    :param ballots: List of ciphertext ballots to gethares of
    :param context: Election context
    :return: Decryption shares of ballots or None ifailure
    """
    shares = {}
    for ballot in ballots:
        share = compute_decryption_share_for_ballot(
            _election_keys,
            ballot,
            context,
        )
        shares[ballot.object_id] = share
    return shares

def combine_decryption_shares(
    manifest: Manifest,
    ciphertext_tally: CiphertextTally,
    submitted_ballots: List[SubmittedBallot],
    election_builder: ElectionBuilder,
    guardian_shares) -> Tuple[PlaintextTally, Dict[BallotId, PlaintextTally]]:
    """
    Combine decryption shares from all guardians to produce final results.
    Returns the plaintext tally and dictionary of spoiled ballot decryptions.
    """
    # Build the election context
    internal_manifest, context = get_optional(election_builder.build())

    serialized_shares = guardian_shares

    deserialized_shares = []
    for serialized_tuple in serialized_shares:
        serialized_public_key, serialized_tally_share, serialized_ballot_shares = serialized_tuple

        # Deserialize each component
        public_key = from_raw(ElectionPublicKey, serialized_public_key) if serialized_public_key else   None
        tally_share = from_raw(DecryptionShare, serialized_tally_share) if serialized_tally_share else  None

        ballot_shares = {}
        for ballot_id, serialized_ballot_share in serialized_ballot_shares.items():
            ballot_shares[ballot_id] = from_raw(DecryptionShare, serialized_ballot_share) if    serialized_ballot_share else None

        deserialized_shares.append((public_key, tally_share, ballot_shares))


    guardian_shares = deserialized_shares
    
    # Configure the Decryption Mediator
    decryption_mediator = DecryptionMediator(
        "decryption-mediator",
        context,
    )
    
    # Add all guardian shares to the mediator
    for guardian_public_key, tally_share, ballot_shares in guardian_shares:
        decryption_mediator.announce(
            guardian_public_key,
            get_optional(tally_share),
            ballot_shares
        )
        print(f"✅ Added decryption shares from guardian {guardian_public_key.owner_id}")
    
    # Get the plaintext tally
    plaintext_tally = get_optional(
        decryption_mediator.get_plaintext_tally(ciphertext_tally, manifest)
    )
    print("✅ Successfully decrypted tally")
    
    # Get the plaintext spoiled ballots
    plaintext_spoiled_ballots = get_optional(
        decryption_mediator.get_plaintext_ballots(submitted_ballots, manifest)
    )
    print(f"✅ Successfully decrypted {len(plaintext_spoiled_ballots)} spoiled ballots")
    
    return plaintext_tally, plaintext_spoiled_ballots



def get_spoiled_ballot_info(
    plaintext_spoiled_ballots: Dict[BallotId, PlaintextTally],
    party_names,
    candidate_names
) -> List[Dict[str, Any]]:
    """
    Extract meaningful information from spoiled ballots.
    
    Args:
        plaintext_spoiled_ballots: Dictionary of spoiled ballot decryptions
        manifest: The election manifest
        
    Returns:
        List of dictionaries containing ballot ID and selected candidate information
    """
    manifest = create_election_manifest(
        party_names,
        candidate_names,
    )
    spoiled_ballot_info = []
    
    # Create a mapping from selection IDs to candidate names
    selection_to_candidate = {}
    for contest in manifest.contests:
        for selection in contest.ballot_selections:
            selection_to_candidate[selection.object_id] = selection.candidate_id
    
    for ballot_id, ballot_tally in plaintext_spoiled_ballots.items():
        ballot_data = {
            "ballot_id": ballot_id,
            "selections": []
        }
        
        for contest_id, contest_tally in ballot_tally.contests.items():
            for selection_id, selection_tally in contest_tally.selections.items():
                if selection_tally.tally == 1:  # This selection was chosen
                    candidate_name = selection_to_candidate.get(selection_id, "Unknown")
                    ballot_data["selections"].append({
                        "contest_id": contest_id,
                        "selection_id": selection_id,
                        "candidate": candidate_name
                    })
        
        spoiled_ballot_info.append(ballot_data)
    
    return spoiled_ballot_info


    
from typing import Set, Dict, List
import json
from electionguard.tally import CiphertextTally
from electionguard.manifest import Manifest, InternalManifest
from electionguard.election import CiphertextElectionContext

def ciphertext_tally_to_raw(tally: CiphertextTally) -> Dict:
    """Convert a CiphertextTally to a raw dictionary for serialization."""
    return {
        "_encryption": to_raw(tally._encryption),
        "cast_ballot_ids": list(tally.cast_ballot_ids),  # Convert set to list
        "spoiled_ballot_ids": list(tally.spoiled_ballot_ids),  # Convert set to list
        "contests": {contest_id: to_raw(contest) for contest_id, contest in tally.contests.items()},
        "_internal_manifest": to_raw(tally._internal_manifest),
        "_manifest": to_raw(tally._internal_manifest.manifest)
    }

def raw_to_ciphertext_tally(raw: Dict, manifest: Manifest = None) -> CiphertextTally:
    """Reconstruct a CiphertextTally from its raw dictionary representation."""
    # Handle manifest (either from parameter or raw data)
    internal_manifest = InternalManifest(manifest)
    
    # Create tally
    tally = CiphertextTally(
        object_id=raw.get("object_id", ""),
        _internal_manifest=internal_manifest,
        _encryption=from_raw(CiphertextElectionContext, raw["_encryption"]),
    )
    
    # Convert lists back to sets (no need for from_raw on simple sets)
    tally.cast_ballot_ids = set(raw["cast_ballot_ids"])
    tally.spoiled_ballot_ids = set(raw["spoiled_ballot_ids"])
    
    # Handle contests
    tally.contests = {
        contest_id: from_raw(CiphertextTallyContest, contest_raw)
        for contest_id, contest_raw in raw["contests"].items()
    }
    
    return tally

def create_encrypted_ballot(
    party_names,
    candidate_names,
    candidate_name,
    ballot_id,
    joint_public_key_json,
    commitment_hash_json
):
    """"""
    ballot = create_plaintext_ballot(party_names, candidate_names, candidate_name, ballot_id)
    ret = encrypt_ballot(party_names, candidate_names, joint_public_key_json, commitment_hash_json, ballot)
    ret = to_raw(ret)
    return ret


def run_demo(party_names, candidate_names, voter_no, number_of_guardians, quorum):
    """Demonstration of the complete workflow using the four functions."""

    # Step 1: Setup guardians and create joint key
    guardian_public_keys_json, guardian_private_keys_json, guardian_polynomials_json, joint_public_key_json, commitment_hash_json = setup_guardians_and_joint_key(
        number_of_guardians=number_of_guardians,
        quorum=quorum
    )

   
    

   
    # plaintext_ballots = [to_raw(plaintext_ballot) for plaintext_ballot in plaintext_ballots]
    encrypted_ballots = []
    for i in range(voter_no):
        encrypted_ballots.append(create_encrypted_ballot(party_names, candidate_names, "Joe Biden", f"ballot-{i*2}", joint_public_key_json, commitment_hash_json))
        encrypted_ballots.append(create_encrypted_ballot(party_names, candidate_names, "Donald Trump", f"ballot-{i*2 + 1}", joint_public_key_json, commitment_hash_json))
    
    # encrypted_ballots = [to_raw(e) for e in encrypted_ballots]
    
    ciphertext_tally_json, submitted_ballots = tally_encrypted_ballots(
        party_names, candidate_names, joint_public_key_json, commitment_hash_json, encrypted_ballots
    )
    # print('Publishing Now:',ciphertext_tally.publish())
    
    
    result = decrypt_tally_and_ballots(
        guardian_public_keys_json=guardian_public_keys_json,
        guardian_private_keys_json=guardian_private_keys_json,
        guardian_polynomials_json=guardian_polynomials_json,
        party_names=party_names,
        candidate_names=candidate_names,
        ciphertext_tally_json=ciphertext_tally_json,
        submitted_ballots_json=submitted_ballots,
        joint_public_key_json=joint_public_key_json,
        commitment_hash_json=commitment_hash_json

    )
    
    print(f"The election results: {result}")
    print('=='*20)
    
    
    
    

if __name__ == "__main__":
    run_demo(
        party_names=["Party A", "Party B"],
        candidate_names=[ "Joe Biden", "Donald Trump"], 
        voter_no=2,
        number_of_guardians=3,
        quorum=2)
    print("\n🎉 Demo completed successfully!")