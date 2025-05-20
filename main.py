from electionguard.ballot import (
    CiphertextBallot,
    PlaintextBallot,
    SubmittedBallot,
)
from electionguard.election import (
    CiphertextElectionContext,
    make_ciphertext_election_context,
)
from electionguard.encrypt import EncryptionDevice, encrypt_ballot
from electionguard.guardian import Guardian
from electionguard.key_ceremony import (
    CeremonyDetails,
    ElectionJointKey,
    PublicKeySet,
    generate_election_key_pair,
)
from electionguard.tally import CiphertextTally, tally_ballots
from electionguard.verify import verify_tally
from electionguard.serializable import write_json_file, read_json_file
from electionguard.ballot_box import BallotBox
from electionguard.manifest import (
    Manifest,
    ContestDescription,
    SelectionDescription,
    ElectionType,
    SpecVersion,
    VoteVariationType,
    InternationalizedText,
    Language,
)
from electionguard.group import ElementModP, ElementModQ
import os
from typing import List, Dict, Tuple
import json
from datetime import datetime, timedelta

class ElectionManager:
    def __init__(self, number_of_guardians: int = 3, quorum: int = 2):
        """Initialize the election manager with specified number of guardians and quorum."""
        self.number_of_guardians = number_of_guardians
        self.quorum = quorum
        self.guardians: List[Guardian] = []
        self.device = EncryptionDevice("device-1")
        self.election_description = None
        self.context = None
        self.joint_key = None
        self.ballot_box = None
        self.encrypted_tally = None

    def create_election_manifest(self) -> Manifest:
        """Create a sample election manifest."""
        # Create selection descriptions
        selection1 = SelectionDescription(
            "selection-1",
            "Candidate 1",
            1,
            "candidate-1"
        )
        selection2 = SelectionDescription(
            "selection-2",
            "Candidate 2",
            2,
            "candidate-2"
        )

        # Create contest description
        contest = ContestDescription(
            "contest-1",
            "President",
            1,
            "president",
            [selection1, selection2],
            1,  # Number of selections allowed
            1,  # Votes allowed
            VoteVariationType.one_of_m
        )

        # Create manifest
        manifest = Manifest(
            election_scope_id="election-1",
            spec_version=SpecVersion.EG1_0,
            type=ElectionType.general,
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(days=1),
            geopolitical_units=[],  # Required but empty for this example
            parties=[],  # Required but empty for this example
            candidates=[],  # Required but empty for this example
            contests=[contest],
            ballot_styles=[],  # Required but empty for this example
            name=InternationalizedText([Language("General Election")])
        )

        return manifest

    def configure_election(self):
        """Configure the election using a manifest."""
        # Create election manifest
        manifest = self.create_election_manifest()
        
        # Create election description
        self.election_description = manifest
        
        # Create internal election description
        internal_description = manifest
        
        # Initialize ballot box
        self.ballot_box = BallotBox(internal_description, self.context)

    def setup_guardians(self):
        """Create and setup guardians for the election."""
        # Create guardians with unique IDs
        for i in range(self.number_of_guardians):
            guardian = Guardian(
                f"guardian-{i+1}",
                i+1,
                self.number_of_guardians,
                self.quorum
            )
            self.guardians.append(guardian)

    def generate_joint_key(self):
        """Generate the joint public key from all guardians."""
        # Generate key pairs for each guardian
        for guardian in self.guardians:
            guardian.generate_election_key_pair()

        # Create ceremony details
        ceremony_details = CeremonyDetails(
            self.number_of_guardians,
            self.quorum
        )

        # Generate joint key
        self.joint_key = ElectionJointKey(
            ceremony_details,
            [guardian.share_public_key() for guardian in self.guardians]
        )

        # Create election context
        self.context = make_ciphertext_election_context(
            self.number_of_guardians,
            self.quorum,
            self.joint_key.joint_public_key,
            self.joint_key.commitment_hash,
            self.election_description.crypto_hash()
        )

    def encrypt_ballot(self, plaintext_ballot: PlaintextBallot) -> SubmittedBallot:
        """Encrypt a single ballot."""
        encrypted_ballot = encrypt_ballot(
            plaintext_ballot,
            self.election_description,
            self.context,
            self.device.crypto_hash()
        )
        return self.ballot_box.cast(encrypted_ballot)

    def tally_ballots(self):
        """Tally all cast ballots."""
        self.encrypted_tally = tally_ballots(
            self.ballot_box.get_cast_ballots(),
            self.election_description,
            self.context
        )

    def decrypt_tally(self) -> Dict:
        """Decrypt the tally using guardian private keys."""
        if not self.encrypted_tally:
            raise ValueError("No encrypted tally available")

        # Decrypt the tally using each guardian's private key
        for guardian in self.guardians:
            self.encrypted_tally.decrypt(guardian)

        return self.encrypted_tally.get_plaintext_tally()

    def verify_election(self) -> bool:
        """Verify the election results."""
        if not self.encrypted_tally:
            raise ValueError("No encrypted tally available")

        return verify_tally(
            self.encrypted_tally,
            self.ballot_box.get_cast_ballots(),
            self.election_description,
            self.context
        )

    def save_election_data(self, output_dir: str):
        """Save election data for future verification."""
        os.makedirs(output_dir, exist_ok=True)
        
        # Save election description
        write_json_file(
            self.election_description.to_json(),
            os.path.join(output_dir, "election_description.json")
        )

        # Save context
        write_json_file(
            self.context.to_json(),
            os.path.join(output_dir, "election_context.json")
        )

        # Save encrypted tally
        write_json_file(
            self.encrypted_tally.to_json(),
            os.path.join(output_dir, "encrypted_tally.json")
        )

        # Save cast ballots
        cast_ballots = [ballot.to_json() for ballot in self.ballot_box.get_cast_ballots()]
        write_json_file(
            cast_ballots,
            os.path.join(output_dir, "cast_ballots.json")
        )

def create_sample_ballot() -> PlaintextBallot:
    """Create a sample ballot for testing."""
    return PlaintextBallot(
        object_id="ballot-1",
        ballot_style="default",
        contests=[
            {
                "object_id": "contest-1",
                "sequence_order": 1,
                "ballot_selections": [
                    {
                        "object_id": "selection-1",
                        "sequence_order": 1,
                        "vote": 1
                    }
                ]
            }
        ]
    )

def main():
    # Example usage
    election_manager = ElectionManager(number_of_guardians=3, quorum=2)
    
    # Configure election
    election_manager.configure_election()
    
    # Setup guardians and generate joint key
    election_manager.setup_guardians()
    election_manager.generate_joint_key()
    
    # Create and encrypt a sample ballot
    sample_ballot = create_sample_ballot()
    encrypted_ballot = election_manager.encrypt_ballot(sample_ballot)
    
    # Tally ballots
    election_manager.tally_ballots()
    
    # Decrypt results
    results = election_manager.decrypt_tally()
    print("Election Results:", results)
    
    # Verify election
    is_valid = election_manager.verify_election()
    print(f"Election verification result: {'Valid' if is_valid else 'Invalid'}")
    
    # Save election data for future verification
    election_manager.save_election_data("election_data")

if __name__ == "__main__":
    main()
