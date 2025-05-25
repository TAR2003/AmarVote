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
from electionguard.group import ElementModQ, ElementModP, g_pow_p, int_to_p, int_to_q, rand_q
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
    print("\n🔹 Creating election manifest")
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
    
    start_date = datetime.now()
    end_date = datetime.now()
    
    manifest = Manifest(
        election_scope_id=f"election-{uuid.uuid4()}",
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
    
    print(f"✅ Created manifest with {len(parties)} parties and {len(candidates)} candidates")
    return manifest

def create_plaintext_ballot(party_names, candidate_names, candidate_name: str, ballot_id: str) -> PlaintextBallot:
    """Create a single plaintext ballot for a specific candidate."""
    print(f"\n🔹 Creating plaintext ballot for {candidate_name}")
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
    
    ballot_selections = []
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
        ballot_contests = [
            PlaintextBallotContest(
                object_id=contest.object_id,
                ballot_selections=selections
            )
        ]
    
    ballot = PlaintextBallot(
        object_id=ballot_id,
        style_id=ballot_style.object_id,
        contests=ballot_contests,
    )
    
    print(f"✅ Created plaintext ballot {ballot_id} for {candidate_name}")
    return ballot

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
        assert announced_keys is not None, "Failed to get announced keys"
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
                assert backup is not None, f"Failed to create backup from {sending_guardian.id} to {designated_guardian.id}"
                backups.append(backup)
                print(f"   ✅ Guardian {sending_guardian.id} created backup for Guardian {designated_guardian.id}")
        
        mediator.receive_backups(backups)
        print(f"   ✅ Mediator received {len(backups)} backups from Guardian {sending_guardian.id}")
    
    # Receive Backups
    for designated_guardian in guardians:
        backups = get_optional(mediator.share_backups(designated_guardian.id))
        assert backups is not None, f"Failed to get backups for guardian {designated_guardian.id}"
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
                verified = get_optional(verification)
                assert verified is not None, f"Verification failed for backup from {backup_owner.id} to {designated_guardian.id}"
                verifications.append(verified)
                print(f"   ✅ Guardian {designated_guardian.id} verified backup from Guardian {backup_owner.id}")
        
        mediator.receive_backup_verifications(verifications)
        print(f"   ✅ Mediator received {len(verifications)} verifications from Guardian {designated_guardian.id}")
    
    # FINAL: Publish Joint Key
    joint_key = get_optional(mediator.publish_joint_key())
    assert joint_key is not None, "Failed to publish joint key"
    print(f"✅ Joint election key published: {joint_key.joint_public_key}")
    print(f"✅ Commitment hash: {joint_key.commitment_hash}")
    
    guardian_public_keys_json = [int(g._election_keys.key_pair.public_key) for g in guardians]  # List of ElementModP
    guardian_private_keys_json = [int(g._election_keys.key_pair.secret_key) for g in guardians]  # List of ElementModQ 
    guardian_polynomials_json = [to_raw(g._election_keys.polynomial) for g in guardians]
    
    return guardian_public_keys_json, guardian_private_keys_json, guardian_polynomials_json, joint_key.joint_public_key, joint_key.commitment_hash

def encrypt_ballot(
    party_names,
    candidate_names,
    joint_public_key_json,
    commitment_hash_json,
    plaintext_ballot_json
) -> Optional[CiphertextBallot]:
    """
    Second function: Encrypt a single ballot.
    Returns the encrypted ballot or None if encryption fails.
    """
    try:
        joint_public_key = int_to_p(joint_public_key_json)
        commitment_hash = int_to_q(commitment_hash_json)
        plaintext_ballot = from_raw(PlaintextBallot, plaintext_ballot_json)
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
        assert internal_manifest is not None and context is not None, "Failed to build election context"
        
        # Create encryption device and mediator
        device = EncryptionDevice(device_id=1, session_id=1, launch_code=1, location="polling-place")
        encrypter = EncryptionMediator(internal_manifest, context, device)
        
        # Encrypt the ballot
        encrypted_ballot = encrypter.encrypt(plaintext_ballot)
        if encrypted_ballot:
            encrypted = get_optional(encrypted_ballot)
            print(f"✅ Successfully encrypted ballot: {plaintext_ballot.object_id}")
            return encrypted
        else:
            print(f"❌ Failed to encrypt ballot: {plaintext_ballot.object_id}")
            return None
    except Exception as e:
        print(f"❌ Error encrypting ballot: {str(e)}")
        return None


def tally_encrypted_ballots(
    party_names: List[str],
    candidate_names: List[str],
    joint_public_key_json: int,
    commitment_hash_json: int,
    encrypted_ballots_json: List[Dict[str, Any]],
    encryption_seed: str
) -> Tuple[CiphertextTally, List[SubmittedBallot]]:
    """
    Tally encrypted ballots with full validation and proper cryptographic checks.
    
    Args:
        party_names: List of political parties in the election
        candidate_names: List of candidates in the election
        joint_public_key_json: The joint public key for the election
        commitment_hash_json: The commitment hash for the election
        encrypted_ballots_json: List of encrypted ballots in JSON format
        encryption_seed: The seed used during ballot encryption
        
    Returns:
        Tuple containing:
        - CiphertextTally: The encrypted tally results
        - List[SubmittedBallot]: The submitted ballots that were counted
        
    Raises:
        ValueError: If any validation fails during the tallying process
    """
    print("\n=== STARTING BALLOT TALLYING PROCESS ===")
    
    try:
        # ======================
        # 1. Input Validation
        # ======================
        print("\n🔹 Validating inputs...")
        if not party_names:
            raise ValueError("No party names provided")
        if not candidate_names:
            raise ValueError("No candidate names provided")
        if not encrypted_ballots_json:
            raise ValueError("No encrypted ballots provided")
        if not encryption_seed:
            raise ValueError("No encryption seed provided")
            
        print("✓ Input validation passed")

        # ======================
        # 2. Convert Crypto Parameters
        # ======================
        print("\n🔹 Converting cryptographic parameters...")
        try:
            joint_public_key = int_to_p(joint_public_key_json)
            commitment_hash = int_to_q(commitment_hash_json)
            print("✓ Crypto parameters converted")
        except Exception as e:
            raise ValueError(f"Failed to convert crypto parameters: {str(e)}")

        # ======================
        # 3. Create Election Context
        # ======================
        print("\n🔹 Building election context...")
        try:
            manifest = create_election_manifest(party_names, candidate_names)
            election_builder = ElectionBuilder(
                number_of_guardians=1,  # Doesn't matter for tally
                quorum=1,              # Doesn't matter for tally
                manifest=manifest
            )
            election_builder.set_public_key(joint_public_key)
            election_builder.set_commitment_hash(commitment_hash)
            
            internal_manifest, context = get_optional(election_builder.build())
            if not internal_manifest or not context:
                raise ValueError("Failed to build election context")
                
            crypto_extended_base_hash = context.crypto_extended_base_hash
            if not crypto_extended_base_hash:
                raise ValueError("Missing crypto extended base hash in context")
                
            print("✓ Election context created")
        except Exception as e:
            raise ValueError(f"Election setup failed: {str(e)}")

        # ======================
        # 4. Validate Ballots
        # ======================
        print("\n🔹 Validating encrypted ballots...")
        encrypted_ballots = []
        for idx, ballot_json in enumerate(encrypted_ballots_json):
            try:
                # Deserialize ballot
                ballot = from_raw(CiphertextBallot, ballot_json)
                if not ballot:
                    raise ValueError("Deserialization returned None")
                
                # Validate encryption
                if not ballot.is_valid_encryption(
                    encryption_seed,
                    joint_public_key,
                    crypto_extended_base_hash
                ):
                    raise ValueError("Ballot failed encryption validation")
                
                encrypted_ballots.append(ballot)
                print(f"✓ Ballot {idx} validated: {ballot.object_id}")
            except Exception as e:
                raise ValueError(f"Invalid ballot {idx}: {str(e)}") from e

        # ======================
        # 5. Process Ballots
        # ======================
        print("\n🔹 Processing ballots...")
        ballot_store = DataStore()
        ballot_box = BallotBox(internal_manifest, context, ballot_store)
        submitted_ballots = []
        
        for ballot in encrypted_ballots:
            try:
                # In production, decide cast/spoil based on ballot metadata
                # Here we cast all ballots for simplicity
                submitted = ballot_box.cast(ballot)
                if not submitted:
                    raise ValueError(f"Failed to submit ballot {ballot.object_id}")
                
                submitted_ballot = get_optional(submitted)
                if not submitted_ballot:
                    raise ValueError(f"Failed to get submitted ballot {ballot.object_id}")
                
                submitted_ballots.append(submitted_ballot)
                print(f"✓ Processed ballot: {ballot.object_id}")
            except Exception as e:
                raise ValueError(f"Error processing ballot {ballot.object_id}: {str(e)}") from e

        # ======================
        # 6. Tally Ballots
        # ======================
        print("\n🔹 Tallying ballots...")
        try:
            ciphertext_tally = get_optional(
                tally_ballots(ballot_store, internal_manifest, context)
            )
            if not ciphertext_tally:
                raise ValueError("Tally returned None")
                
            print(f"✓ Successfully tallied {len(submitted_ballots)} ballots")
            print("=== TALLYING COMPLETE ===")
            return ciphertext_tally, submitted_ballots
        except Exception as e:
            raise ValueError(f"Tallying failed: {str(e)}")

    except Exception as e:
        print(f"\n❌ Tallying failed: {str(e)}")
        raise ValueError(f"Ballot tallying error: {str(e)}") from e



def compute_tally_share(
        _election_keys: ElectionKeyPair,
        tally: CiphertextTally, context: CiphertextElectionContext
    ) -> Optional[DecryptionShare]:
        """
        Compute the decryption share of tally.
        """
        print(f"\n🔹 Computing tally share for guardian {_election_keys.owner_id}")
        share = compute_decryption_share(
            _election_keys,
            tally,
            context,
        )
        if share is None:
            print(f"❌ Failed to compute tally share for guardian {_election_keys.owner_id}")
        else:
            print(f"✅ Computed tally share for guardian {_election_keys.owner_id}")
        return share

def compute_ballot_shares(
    _election_keys: ElectionKeyPair,
    ballots: List[SubmittedBallot], context: CiphertextElectionContext
) -> Dict[BallotId, Optional[DecryptionShare]]:
    """
    Compute the decryption shares of ballots.
    """
    print(f"\n🔹 Computing ballot shares for guardian {_election_keys.owner_id}")
    shares = {}
    for ballot in ballots:
        share = compute_decryption_share_for_ballot(
            _election_keys,
            ballot,
            context,
        )
        if share is None:
            print(f"❌ Failed to compute ballot share for ballot {ballot.object_id}")
        else:
            print(f"✅ Computed ballot share for ballot {ballot.object_id}")
        shares[ballot.object_id] = share
    return shares

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
        print("\n🔹 Starting decryption process")
        
        # 1. Create election manifest and setup
        manifest = create_election_manifest(party_names, candidate_names)
        print("✅ Created manifest for decryption")
        
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
        print("✅ Set election parameters")
        
        # 3. Prepare guardian data
        guardian_ids = [f"guardian-{i}" for i in range(len(guardian_public_keys_json))]
        _election_keys = []
        for i in range(len(guardian_public_keys_json)):
            key_pair = ElGamalKeyPair(
                int_to_q(guardian_private_keys_json[i]),
                int_to_p(guardian_public_keys_json[i])
            )
            polynomial = from_raw(ElectionPolynomial, guardian_polynomials_json[i])
            assert polynomial is not None, f"Failed to deserialize polynomial for guardian {i}"
            
            election_key = ElectionKeyPair(
                owner_id=guardian_ids[i],
                sequence_order=i,
                key_pair=key_pair,
                polynomial=polynomial
            )
            _election_keys.append(election_key)
            print(f"✅ Prepared election keys for guardian {guardian_ids[i]}")
        
        # 4. Build election context
        internal_manifest, context = get_optional(election_builder.build())
        assert internal_manifest is not None and context is not None, "Failed to build election context"
        print("✅ Built election context")
        
        # 5. Prepare tally and ballots
        ciphertext_tally = raw_to_ciphertext_tally(ciphertext_tally_json, manifest=manifest)
        assert ciphertext_tally is not None, "Failed to deserialize ciphertext tally"
        print("✅ Deserialized ciphertext tally")
        
        submitted_ballots = []
        for ballot_json in submitted_ballots_json:
            ballot = from_raw(SubmittedBallot, ballot_json)
            assert ballot is not None, "Failed to deserialize submitted ballot"
            submitted_ballots.append(ballot)
        print(f"✅ Deserialized {len(submitted_ballots)} submitted ballots")
        
        # 6. Configure decryption mediator
        decryption_mediator = DecryptionMediator(
            "decryption-mediator",
            context,
        )
        print("✅ Configured decryption mediator")
        
        # 7. Process each guardian's shares
        for election_key in _election_keys:
            print(f"\nProcessing guardian {election_key.owner_id}")
            
            guardian_key = election_key.share()
            assert guardian_key is not None, f"Failed to get guardian key for {election_key.owner_id}"
            
            tally_share = compute_tally_share(election_key, ciphertext_tally, context)
            assert tally_share is not None, f"Failed to compute tally share for {election_key.owner_id}"
            
            ballot_shares = compute_ballot_shares(election_key, submitted_ballots, context)
            assert ballot_shares is not None, f"Failed to compute ballot shares for {election_key.owner_id}"
            
            decryption_mediator.announce(
                guardian_key,
                tally_share,
                ballot_shares
            )
            print(f"✅ Guardian {election_key.owner_id} announced shares")

        # 8. Get decrypted results
        plaintext_tally = get_optional(
            decryption_mediator.get_plaintext_tally(ciphertext_tally, manifest)
        )
        assert plaintext_tally is not None, "Failed to decrypt tally"
        print("✅ Decrypted tally")
        
        plaintext_spoiled_ballots = get_optional(
            decryption_mediator.get_plaintext_ballots(submitted_ballots, manifest)
        )
        assert plaintext_spoiled_ballots is not None, "Failed to decrypt spoiled ballots"
        print(f"✅ Decrypted {len(plaintext_spoiled_ballots)} spoiled ballots")
        
        # Process the results
        election_results = {}
        for contest_id, contest in plaintext_tally.contests.items():
            election_results[contest_id] = {}
            for selection_id, selection in contest.selections.items():
                election_results[contest_id][selection_id] = {
                    "tally": selection.tally,
                    "name": selection_id
                }
        
        spoiled_ballots_info = get_spoiled_ballot_info(
            plaintext_spoiled_ballots,
            party_names,
            candidate_names
        )

        return {
            "election_results": election_results,
            "spoiled_ballots": spoiled_ballots_info,
            "success": True,
            "message": "Decryption completed successfully"
        }

    except Exception as e:
        print(f"❌ Decryption failed: {str(e)}")
        return {
            "success": False,
            "message": f"Decryption failed: {str(e)}"
        }

def get_spoiled_ballot_info(
    plaintext_spoiled_ballots: Dict[BallotId, PlaintextTally],
    party_names,
    candidate_names
) -> List[Dict[str, Any]]:
    """
    Extract meaningful information from spoiled ballots.
    """
    print("\n🔹 Processing spoiled ballots info")
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
    
    print(f"✅ Processed {len(spoiled_ballot_info)} spoiled ballots")
    return spoiled_ballot_info

def ciphertext_tally_to_raw(tally: CiphertextTally) -> Dict:
    """Convert a CiphertextTally to a raw dictionary for serialization."""
    print("\n🔹 Serializing ciphertext tally")
    try:
        result = {
            "_encryption": to_raw(tally._encryption),
            "cast_ballot_ids": list(tally.cast_ballot_ids),
            "spoiled_ballot_ids": list(tally.spoiled_ballot_ids),
            "contests": {contest_id: to_raw(contest) for contest_id, contest in tally.contests.items()},
            "_internal_manifest": to_raw(tally._internal_manifest),
            "_manifest": to_raw(tally._internal_manifest.manifest)
        }
        print("✅ Serialized ciphertext tally")
        return result
    except Exception as e:
        print(f"❌ Failed to serialize ciphertext tally: {str(e)}")
        raise

def raw_to_ciphertext_tally(raw: Dict, manifest: Manifest = None) -> CiphertextTally:
    """Reconstruct a CiphertextTally from its raw dictionary representation."""
    print("\n🔹 Deserializing ciphertext tally")
    try:
        # Handle manifest (either from parameter or raw data)
        if manifest is None and "_manifest" in raw:
            manifest = from_raw(Manifest, raw["_manifest"])
        
        assert manifest is not None, "Manifest is required for deserialization"
        internal_manifest = InternalManifest(manifest)
        
        # Create tally
        tally = CiphertextTally(
            object_id=raw.get("object_id", ""),
            _internal_manifest=internal_manifest,
            _encryption=from_raw(CiphertextElectionContext, raw["_encryption"]),
        )
        
        # Convert lists back to sets
        tally.cast_ballot_ids = set(raw["cast_ballot_ids"])
        tally.spoiled_ballot_ids = set(raw["spoiled_ballot_ids"])
        
        # Handle contests
        tally.contests = {
            contest_id: from_raw(CiphertextTallyContest, contest_raw)
            for contest_id, contest_raw in raw["contests"].items()
        }
        
        print("✅ Deserialized ciphertext tally")
        return tally
    except Exception as e:
        print(f"❌ Failed to deserialize ciphertext tally: {str(e)}")
        raise

def run_demo(party_names, candidate_names, voter_no, number_of_guardians, quorum):
    """Demonstration of the complete workflow using the four functions."""
    print("\n" + "="*50)
    print("Starting ElectionGuard Demo")
    print("="*50)

    try:
        # Step 1: Setup guardians and create joint key
        print("\n" + "-"*20)
        print("STEP 1: Guardian Setup and Key Ceremony")
        print("-"*20)
        guardian_public_keys_json, guardian_private_keys_json, guardian_polynomials_json, joint_public_key, commitment_hash = setup_guardians_and_joint_key(
            number_of_guardians=number_of_guardians,
            quorum=quorum
        )
        
        # Step 2: Create manifest and ballots
        print("\n" + "-"*20)
        print("STEP 2: Ballot Creation and Encryption")
        print("-"*20)
        manifest = create_election_manifest(
            party_names,
            candidate_names,
        )
        
        # Create some plaintext ballots
        plaintext_ballots = []
        for i in range(voter_no):
            plaintext_ballots.append(create_plaintext_ballot(party_names, candidate_names, "Joe Biden", f"ballot-{i*2}"))
            plaintext_ballots.append(create_plaintext_ballot(party_names, candidate_names, "Donald Trump", f"ballot-{i*2 + 1}"))
        
        # Encrypt the ballots
        plaintext_ballots_json = [to_raw(plaintext_ballot) for plaintext_ballot in plaintext_ballots]
        encrypted_ballots = []
        for ballot_json in plaintext_ballots_json:
            encrypted = encrypt_ballot(party_names, candidate_names, joint_public_key, commitment_hash, ballot_json)
            if encrypted:
                encrypted_ballots.append(encrypted)
        
        assert len(encrypted_ballots) > 0, "No ballots were successfully encrypted"
        encrypted_ballots_json = [to_raw(encrypted_ballot) for encrypted_ballot in encrypted_ballots]
        
        # Step 3: Tally the encrypted ballots
        print("\n" + "-"*20)
        print("STEP 3: Tallying Encrypted Ballots")
        print("-"*20)
        election_seed =str(rand_q)
        ciphertext_tally, submitted_ballots = tally_encrypted_ballots(
            party_names, candidate_names, joint_public_key, commitment_hash, encrypted_ballots_json, election_seed
        )
        print('Talyying donme')
        
        ciphertext_tally_json = ciphertext_tally_to_raw(ciphertext_tally)
        submitted_ballots_json = [to_raw(submitted_ballot) for submitted_ballot in submitted_ballots]
        
        # Step 4: Decrypt the tally and ballots
        print("\n" + "-"*20)
        print("STEP 4: Decryption Process")
        print("-"*20)
        result = decrypt_tally_and_ballots(
            guardian_public_keys_json=guardian_public_keys_json,
            guardian_private_keys_json=guardian_private_keys_json,
            guardian_polynomials_json=guardian_polynomials_json,
            party_names=party_names,
            candidate_names=candidate_names,
            ciphertext_tally_json=ciphertext_tally_json,
            submitted_ballots_json=submitted_ballots_json,
            joint_public_key_json=joint_public_key,
            commitment_hash_json=commitment_hash
        )
        
        if result.get("success"):
            print("\n" + "="*20)
            print("FINAL ELECTION RESULTS")
            print("="*20)
            print("\nContest Results:")
            for contest_id, contest in result["election_results"].items():
                print(f"\nContest: {contest_id}")
                for selection_id, selection in contest.items():
                    print(f"  {selection['name']}: {selection['tally']} votes")
            
            print("\nSpoiled Ballots:")
            for ballot in result["spoiled_ballots"]:
                print(f"\nBallot ID: {ballot['ballot_id']}")
                for selection in ballot["selections"]:
                    print(f"  Voted for: {selection['candidate']}")
        else:
            print(f"\nError: {result['message']}")
        
        print("\n🎉 Demo completed successfully!")
    except Exception as e:
        print(f"\n❌ Demo failed with error: {str(e)}")

if __name__ == "__main__":
    run_demo(
        party_names=["Party A", "Party B"],
        candidate_names=["Joe Biden", "Donald Trump"], 
        voter_no=10,
        number_of_guardians=3,
        quorum=2)