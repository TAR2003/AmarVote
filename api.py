#!/usr/bin/env python
from fastapi import FastAPI, HTTPException
from typing import Dict, List, Optional
import uuid
from datetime import datetime

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


from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary storage for demonstration (in production, this would be handled by the client)
temp_storage = {
    "election_manifest": None,
    "internal_manifest": None,
    "context": None,
    "guardians": {},
    "ballot_store": DataStore(),
    "plaintext_ballots": {}
}

# Request/Response Models
class ElectionSetupRequest(BaseModel):
    number_of_guardians: int
    quorum: int
    election_manifest: Optional[Dict] = None

class GuardianInfo(BaseModel):
    id: str
    sequence_order: int
    number_of_guardians: int
    quorum: int

class JointPublicKeyResponse(BaseModel):
    joint_public_key: str
    commitment_hash: str
    guardian_ids: List[str]
    election_manifest: Dict

class BallotEncryptionRequest(BaseModel):
    plaintext_ballot: Dict
    device_id: int = 1

class BallotEncryptionResponse(BaseModel):
    encrypted_ballot: Dict
    ballot_id: str

class TallyRequest(BaseModel):
    ballot_ids: List[str]

class DecryptionRequest(BaseModel):
    guardian_shares: List[Dict]  # List of guardian decryption shares

# Helper Functions
def create_default_manifest() -> Manifest:
    """Create a default election manifest if none is provided"""
    geopolitical_units = [GeopoliticalUnit(
        object_id="county-1",
        name="County 1",
        type=ReportingUnitType.county,
        contact_information=None,
    )]
    
    parties = [
        Party(object_id="party-1", name="Party One", abbreviation="P1"),
        Party(object_id="party-2", name="Party Two", abbreviation="P2"),
    ]
    
    candidates = [
        Candidate(object_id="candidate-1", name="Candidate One", party_id="party-1"),
        Candidate(object_id="candidate-2", name="Candidate Two", party_id="party-2"),
    ]
    
    contests = [
        Contest(
            object_id="contest-1",
            sequence_order=0,
            electoral_district_id="county-1",
            vote_variation=VoteVariationType.one_of_m,
            name="County Executive",
            ballot_selections=[
                SelectionDescription(
                    object_id="contest-1-candidate-1",
                    candidate_id="candidate-1",
                    sequence_order=0,
                ),
                SelectionDescription(
                    object_id="contest-1-candidate-2",
                    candidate_id="candidate-2",
                    sequence_order=1,
                ),
            ],
            votes_allowed=1,
            number_elected=1,
        )
    ]
    
    ballot_styles = [
        BallotStyle(
            object_id="ballot-style-1",
            geopolitical_unit_ids=["county-1"],
        )
    ]
    
    return Manifest(
        election_scope_id=f"election-{uuid.uuid4()}",
        spec_version="1.0",
        type=ElectionType.general,
        start_date=datetime.now(),
        end_date=datetime.now(),
        geopolitical_units=geopolitical_units,
        parties=parties,
        candidates=candidates,
        contests=contests,
        ballot_styles=ballot_styles,
        name="Default Election",
    )

# API Endpoints
@app.post("/setup-election", response_model=JointPublicKeyResponse)
async def setup_election(request: ElectionSetupRequest):
    """Setup the election and generate the joint public key"""
    try:
        # Create or use provided manifest
        if request.election_manifest:
            # Convert dict to Manifest object (implementation depends on your serialization)
            manifest = Manifest.from_dict(request.election_manifest)
        else:
            manifest = create_default_manifest()
        
        # Store manifest temporarily
        temp_storage["election_manifest"] = manifest
        
        # Create election builder
        election_builder = ElectionBuilder(
            request.number_of_guardians,
            request.quorum,
            manifest
        )
        
        # Setup Guardians
        guardians = []
        guardian_ids = []
        for i in range(request.number_of_guardians):
            guardian = Guardian.from_nonce(
                str(uuid.uuid4()),  # guardian id
                i + 1,  # sequence order
                request.number_of_guardians,
                request.quorum,
            )
            guardians.append(guardian)
            guardian_ids.append(guardian.id)
            temp_storage["guardians"][guardian.id] = guardian
        
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
        
        # Set the joint key and commitment hash in the election builder
        election_builder.set_public_key(joint_key.joint_public_key)
        election_builder.set_commitment_hash(joint_key.commitment_hash)
        
        # Build the election
        internal_manifest, context = get_optional(election_builder.build())
        
        # Store election context and internal manifest
        temp_storage["internal_manifest"] = internal_manifest
        temp_storage["context"] = context
        
        return {
            "joint_public_key": str(joint_key.joint_public_key),
            "commitment_hash": str(joint_key.commitment_hash),
            "guardian_ids": guardian_ids,
            "election_manifest": manifest.to_dict()  # Implement to_dict() in your Manifest class
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/encrypt-ballot", response_model=BallotEncryptionResponse)
async def encrypt_ballot(request: BallotEncryptionRequest):
    """Encrypt a plaintext ballot"""
    try:
        if not temp_storage["internal_manifest"] or not temp_storage["context"]:
            raise HTTPException(status_code=400, detail="Election not set up. Call /setup-election first.")
        
        # Convert dict to PlaintextBallot (implementation depends on your serialization)
        plaintext_ballot = PlaintextBallot.from_dict(request.plaintext_ballot)
        
        # Store plaintext ballot for verification later
        temp_storage["plaintext_ballots"][plaintext_ballot.object_id] = plaintext_ballot
        
        # Create encryption device and mediator
        device = EncryptionDevice(
            device_id=request.device_id,
            session_id=1,
            launch_code=1,
            location="polling-place"
        )
        encrypter = EncryptionMediator(
            temp_storage["internal_manifest"],
            temp_storage["context"],
            device
        )
        
        # Encrypt the ballot
        encrypted_ballot = encrypter.encrypt(plaintext_ballot)
        if not encrypted_ballot:
            raise HTTPException(status_code=400, detail="Failed to encrypt ballot")
        
        ciphertext_ballot = get_optional(encrypted_ballot)
        
        return {
            "encrypted_ballot": ciphertext_ballot.to_dict(),  # Implement to_dict()
            "ballot_id": ciphertext_ballot.object_id
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/cast-ballot")
async def cast_ballot(ballot_id: str):
    """Cast an encrypted ballot"""
    try:
        if not temp_storage["internal_manifest"] or not temp_storage["context"]:
            raise HTTPException(status_code=400, detail="Election not set up. Call /setup-election first.")
        
        # In a real implementation, you would retrieve the encrypted ballot from your database
        # For this example, we'll assume it's in temp_storage
        encrypted_ballot = None  # Retrieve from your storage
        
        if not encrypted_ballot:
            raise HTTPException(status_code=404, detail="Ballot not found")
        
        # Create ballot box
        ballot_box = BallotBox(
            temp_storage["internal_manifest"],
            temp_storage["context"],
            temp_storage["ballot_store"]
        )
        
        # Cast the ballot
        submitted_ballot = ballot_box.cast(encrypted_ballot)
        if not submitted_ballot:
            raise HTTPException(status_code=400, detail="Failed to cast ballot")
        
        return {"status": "success", "ballot_id": ballot_id, "state": "CAST"}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/tally-ballots", response_model=Dict)
async def tally_ballots_endpoint(request: TallyRequest):
    """Tally the encrypted ballots"""
    try:
        if not temp_storage["internal_manifest"] or not temp_storage["context"]:
            raise HTTPException(status_code=400, detail="Election not set up. Call /setup-election first.")
        
        # In a real implementation, you would retrieve all ballots from your database
        # For this example, we'll use the temp_storage
        ballot_store = temp_storage["ballot_store"]
        
        # Tally the ballots
        ciphertext_tally = get_optional(
            tally_ballots(
                ballot_store,
                temp_storage["internal_manifest"],
                temp_storage["context"]
            )
        )
        
        return {
            "encrypted_tally": ciphertext_tally.to_dict(),  # Implement to_dict()
            "cast_ballot_count": ciphertext_tally.cast()
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/decrypt-tally", response_model=Dict)
async def decrypt_tally(request: DecryptionRequest):
    """Decrypt the tally using guardian shares"""
    try:
        if not temp_storage["internal_manifest"] or not temp_storage["context"]:
            raise HTTPException(status_code=400, detail="Election not set up. Call /setup-election first.")
        
        # Configure the Decryption Mediator
        decryption_mediator = DecryptionMediator(
            "decryption-mediator",
            temp_storage["context"],
        )
        
        # Process each guardian's share
        for share in request.guardian_shares:
            # In a real implementation, you would validate each share
            # For this example, we'll assume they're valid
            guardian_key = share["guardian_key"]
            tally_share = share["tally_share"]
            ballot_shares = share.get("ballot_shares", [])
            
            decryption_mediator.announce(
                guardian_key,
                tally_share,
                ballot_shares
            )
        
        # Check if we have enough shares to decrypt
        if len(request.guardian_shares) < temp_storage["context"].quorum:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough guardian shares. Need {temp_storage['context'].quorum}, got {len(request.guardian_shares)}"
            )
        
        # Get the encrypted tally (from previous step)
        ciphertext_tally = None  # Retrieve from your storage
        
        if not ciphertext_tally:
            raise HTTPException(status_code=400, detail="No tally found. Call /tally-ballots first.")
        
        # Get the plaintext tally
        plaintext_tally = get_optional(
            decryption_mediator.get_plaintext_tally(
                ciphertext_tally,
                temp_storage["election_manifest"]
            )
        )
        
        return {
            "plaintext_tally": plaintext_tally.to_dict(),  # Implement to_dict()
            "verification_status": "success"
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)