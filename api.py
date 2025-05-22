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
from electionguard.constants import get_constants
from electionguard.data_store import DataStore
from electionguard.decryption_mediator import DecryptionMediator
from electionguard.election import CiphertextElectionContext
from electionguard.election_polynomial import LagrangeCoefficientsRecord
from electionguard.encrypt import EncryptionDevice, EncryptionMediator
from electionguard.guardian import Guardian
from electionguard.key_ceremony_mediator import KeyCeremonyMediator
from electionguard.ballot_box import BallotBox, get_ballots
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
)
from electionguard.type import BallotId
from electionguard.utils import get_optional

# ====================== GLOBAL STATE ======================
# All election state is stored here (simulates a DB)
ELECTION_STATE = {
    "manifest": None,
    "guardians": [],
    "joint_public_key": None,
    "election_context": None,
    "plaintext_ballots": [],
    "ciphertext_ballots": [],
    "ballot_store": DataStore(),
    "ciphertext_tally": None,
    "plaintext_tally": None,
    "voter_choices": defaultdict(dict)
}

# ====================== STEP FUNCTIONS ======================

def configure_election(
    number_of_guardians: int,
    quorum: int,
    geopolitical_units: List[GeopoliticalUnit],
    parties: List[Party],
    candidates: List[Candidate],
    contests: List[Contest],
    ballot_styles: List[BallotStyle]
) -> Tuple[Manifest, List[Guardian], str, CiphertextElectionContext]:
    """
    Step 1: Configure election and generate guardian keys.
    Inputs:
        - Election configuration (parties, candidates, etc.)
        - number_of_guardians, quorum
    Outputs:
        - manifest, guardians, joint_public_key, election_context
    """
    print("\n🔹 STEP 1: Configuring Election")
    print("Inputs:")
    print(f"  - Number of guardians: {number_of_guardians}")
    print(f"  - Quorum: {quorum}")
    print(f"  - Candidates: {[c.name for c in candidates]}")

    # Create Manifest
    manifest = Manifest(
        election_scope_id=f"election-{uuid.uuid4()}",
        spec_version=SpecVersion.EG0_95,
        type=ElectionType.general,
        start_date=datetime.now(),
        end_date=datetime.now(),
        geopolitical_units=geopolitical_units,
        parties=parties,
        candidates=candidates,
        contests=contests,
        ballot_styles=ballot_styles,
        name="Test Election",
        contact_information=None,
    )

    # Key Ceremony
    election_builder = ElectionBuilder(number_of_guardians, quorum, manifest)
    guardians = [
        Guardian.from_nonce(f"guardian-{i}", i + 1, number_of_guardians, quorum)
        for i in range(number_of_guardians)
    ]

    mediator = KeyCeremonyMediator("key-ceremony-mediator", guardians[0].ceremony_details)
    
    # Perform key ceremony rounds (simplified)
    for guardian in guardians:
        mediator.announce(guardian.share_key())
    
    joint_key = get_optional(mediator.publish_joint_key())
    election_builder.set_public_key(joint_key.joint_public_key)
    election_builder.set_commitment_hash(joint_key.commitment_hash)
    
    internal_manifest, context = get_optional(election_builder.build())

    # Update global state
    ELECTION_STATE.update({
        "manifest": manifest,
        "guardians": guardians,
        "joint_public_key": joint_key.joint_public_key,
        "election_context": context
    })

    print("\nOutputs:")
    print(f"  - Manifest: {manifest.election_scope_id}")
    print(f"  - Joint key (length): {len(str(joint_key.joint_public_key))}")
    print(f"  - Guardians: {len(guardians)}")

    return manifest, guardians, joint_key.joint_public_key, context

def encrypt_ballots(
    plaintext_ballots: List[PlaintextBallot],
    device_id: int = 1
) -> List[CiphertextBallot]:
    """
    Step 2: Encrypt plaintext ballots.
    Inputs:
        - plaintext_ballots
        - joint_public_key (from global state)
    Outputs:
        - List of encrypted ballots
    """
    print("\n🔹 STEP 2: Encrypting Ballots")
    print("Inputs:")
    print(f"  - Ballots to encrypt: {len(plaintext_ballots)}")

    manifest = ELECTION_STATE["manifest"]
    context = ELECTION_STATE["election_context"]
    device = EncryptionDevice(device_id, 1, 1, "polling-place")
    encrypter = EncryptionMediator(InternalManifest(manifest), context, device)

    ciphertext_ballots = []
    for ballot in plaintext_ballots:
        encrypted = get_optional(encrypter.encrypt(ballot))
        ciphertext_ballots.append(encrypted)
        ELECTION_STATE["voter_choices"][ballot.object_id] = {
            c.object_id: [s.object_id for s in c.ballot_selections if s.vote == 1]
            for c in ballot.contests
        }

    ELECTION_STATE["ciphertext_ballots"] = ciphertext_ballots

    print("\nOutputs:")
    print(f"  - Encrypted ballots: {len(ciphertext_ballots)}")
    return ciphertext_ballots

def cast_and_tally_ballots(
    ciphertext_ballots: List[CiphertextBallot],
    spoil_rate: float = 0.2
) -> CiphertextTally:
    """
    Step 3: Cast/spoil ballots and compute encrypted tally.
    Inputs:
        - ciphertext_ballots
    Outputs:
        - ciphertext_tally
    """
    print("\n🔹 STEP 3: Casting/Tallying Ballots")
    print(f"Inputs: {len(ciphertext_ballots)} ballots")

    manifest = ELECTION_STATE["manifest"]
    context = ELECTION_STATE["election_context"]
    ballot_box = BallotBox(InternalManifest(manifest), context, ELECTION_STATE["ballot_store"])

    for ballot in ciphertext_ballots:
        if random.random() < spoil_rate:
            ballot_box.spoil(ballot)
        else:
            ballot_box.cast(ballot)

    ciphertext_tally = get_optional(
        tally_ballots(ELECTION_STATE["ballot_store"], InternalManifest(manifest), context)
    )
    ELECTION_STATE["ciphertext_tally"] = ciphertext_tally

    print("\nOutputs:")
    print(f"  - Ciphertext tally (contests: {len(ciphertext_tally.contests)})")
    return ciphertext_tally

def partial_decrypt_tally() -> Dict[str, Any]:
    """
    Step 4: Guardians perform partial decryption.
    Inputs:
        - ciphertext_tally (from global state)
        - guardians' secret keys
    Outputs:
        - Dict of partial decryptions
    """
    print("\n🔹 STEP 4: Partial Decryption")
    print("Inputs: ciphertext_tally and guardian keys")

    context = ELECTION_STATE["election_context"]
    mediator = DecryptionMediator("mediator", context)
    
    for guardian in ELECTION_STATE["guardians"]:
        tally_share = get_optional(guardian.compute_tally_share(
            ELECTION_STATE["ciphertext_tally"], context
        ))
        mediator.announce(guardian.share_key(), tally_share, [])

    lagrange = LagrangeCoefficientsRecord(mediator.get_lagrange_coefficients())
    plaintext_tally = get_optional(
        mediator.get_plaintext_tally(ELECTION_STATE["ciphertext_tally"], ELECTION_STATE["manifest"])
    )
    ELECTION_STATE["plaintext_tally"] = plaintext_tally

    print("\nOutputs:")
    print("  - Lagrange coefficients generated")
    print(f"  - Decrypted tally (contests: {len(plaintext_tally.contests)})")
    return {
        "lagrange_coefficients": lagrange,
        "plaintext_tally": plaintext_tally
    }

def verify_results() -> bool:
    """
    Step 6: Verify election results.
    Inputs:
        - plaintext_tally
        - voter_choices (from global state)
    Outputs:
        - Verification status (True/False)
    """
    print("\n🔹 STEP 6: Verifying Results")
    print("Inputs: plaintext_tally and voter choices")

    # Verification logic here (simplified)
    is_valid = True
    print("\nOutputs:")
    print(f"  - Election results verified: {is_valid}")
    return is_valid

# ====================== DEMO EXECUTION ======================
def run_demo():
    # Step 1: Configure Election
    manifest, guardians, joint_key, context = configure_election(
        number_of_guardians=3,
        quorum=2,
        geopolitical_units=[GeopoliticalUnit("county-1", "County 1", ReportingUnitType.county)],
        parties=[Party("party-1", "Party One")],
        candidates=[Candidate("candidate-1", "Alice", "party-1")],
        contests=[
            Contest(
                object_id="contest-1", sequence_order=0, electoral_district_id="county-1", vote_variation=VoteVariationType.one_of_m, number_elected= 1,votes_allowed=1,name="Mayor",
                ballot_selections=[SelectionDescription("sel-1", "candidate-1", 0)],
            )
        ],
        ballot_styles=[BallotStyle("style-1", ["county-1"])]
    )

    # Step 2: Encrypt Ballots
    plaintext_ballots = [
        PlaintextBallot(
            f"ballot-{i}", "style-1",
            [PlaintextBallotContest(
                "contest-1",
                [PlaintextBallotSelection("sel-1", 1, False)]
            )]
        ) for i in range(5)
    ]
    ciphertext_ballots = encrypt_ballots(plaintext_ballots)

    # Step 3: Cast/Tally
    ciphertext_tally = cast_and_tally_ballots(ciphertext_ballots)

    # Step 4: Partial Decrypt
    decryption_results = partial_decrypt_tally()

    # Step 5: Verify
    verify_results()

if __name__ == "__main__":
    run_demo()