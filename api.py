from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
from datetime import datetime
import uuid
from electionguard_tools.helpers.election_builder import ElectionBuilder
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
    ContactInformation
)
from electionguard.election import CiphertextElectionContext
from electionguard.guardian import Guardian
from electionguard.key_ceremony import (
    ElectionPartialKeyBackup,
    ElectionPartialKeyVerification
)
from electionguard.ballot import (
    PlaintextBallot,
    CiphertextBallot,
    SubmittedBallot
)
from electionguard.tally import CiphertextTally, PlaintextTally
from electionguard.decryption_share import DecryptionShare

# Import the functions from your existing code
from main import (
    create_election_manifest,
    create_plaintext_ballots,
    run_election_demo
)

app = FastAPI(
    title="ElectionGuard Microservice",
    description="Microservice for end-to-end verifiable elections using ElectionGuard",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for demo purposes (in production, use a database)
election_db = {
    "manifests": {},
    "guardians": {},
    "key_ceremonies": {},
    "ballots": {},
    "tallies": {}
}

# Pydantic models for request/response schemas
class ElectionManifestRequest(BaseModel):
    name: str = "Test Election"
    geopolitical_units: Optional[List[Dict]] = None
    parties: Optional[List[Dict]] = None
    candidates: Optional[List[Dict]] = None
    contests: Optional[List[Dict]] = None
    ballot_styles: Optional[List[Dict]] = None

class ElectionManifestResponse(BaseModel):
    election_id: str
    manifest: Dict
    created_at: datetime

class GuardianRequest(BaseModel):
    guardian_id: str
    sequence_order: int
    number_of_guardians: int
    quorum: int

class GuardianResponse(BaseModel):
    guardian_id: str
    sequence_order: int
    public_key: Dict

class KeyCeremonyRequest(BaseModel):
    guardian_ids: List[str]
    quorum: int

class KeyCeremonyResponse(BaseModel):
    ceremony_id: str
    guardian_public_keys: Dict[str, Dict]
    status: str

class BackupRequest(BaseModel):
    ceremony_id: str
    sending_guardian_id: str
    designated_guardian_id: str

class BackupResponse(BaseModel):
    backup_id: str
    sending_guardian_id: str
    designated_guardian_id: str
    backup_data: Dict

class VerificationRequest(BaseModel):
    ceremony_id: str
    sending_guardian_id: str
    designated_guardian_id: str

class VerificationResponse(BaseModel):
    verification_id: str
    is_valid: bool
    message: str

class JointKeyResponse(BaseModel):
    ceremony_id: str
    joint_public_key: Dict
    commitment_hash: str
    status: str

class EncryptionDeviceRequest(BaseModel):
    device_id: int
    session_id: int
    launch_code: int
    location: str

class EncryptionDeviceResponse(BaseModel):
    device_id: int
    uuid: str
    created_at: datetime

class PlaintextBallotRequest(BaseModel):
    ballot_style_id: str
    contests: List[Dict]

class PlaintextBallotResponse(BaseModel):
    ballot_id: str
    ballot_style_id: str
    contests: List[Dict]
    status: str

class CiphertextBallotResponse(BaseModel):
    ballot_id: str
    ballot_style_id: str
    contests: List[Dict]
    tracking_id: str
    status: str

class SubmitBallotRequest(BaseModel):
    ballot_id: str
    action: str  # 'cast' or 'spoil'

class SubmitBallotResponse(BaseModel):
    ballot_id: str
    state: str
    tracking_id: str
    timestamp: datetime

class TallyRequest(BaseModel):
    election_id: str

class TallyResponse(BaseModel):
    tally_id: str
    contest_results: Dict
    cast_ballot_count: int
    spoiled_ballot_count: int

class DecryptionShareRequest(BaseModel):
    guardian_id: str
    tally_id: str

class DecryptionShareResponse(BaseModel):
    share_id: str
    guardian_id: str
    tally_share: Dict
    ballot_shares: Dict[str, Dict]

class DecryptedTallyResponse(BaseModel):
    tally_id: str
    plaintext_tally: Dict
    spoiled_ballots: Dict[str, Dict]
    verification_status: str

# Helper functions for serialization
def serialize_manifest(manifest: Manifest) -> Dict:
    return manifest.to_json()

def serialize_guardian(guardian: Guardian) -> Dict:
    return {
        "id": guardian.id,
        "sequence_order": guardian.sequence_order,
        "public_key": guardian.share_key().to_json() if guardian.share_key() else None
    }

# API Endpoints
@app.post("/elections", response_model=ElectionManifestResponse, status_code=status.HTTP_201_CREATED)
async def create_election(request: ElectionManifestRequest):
    """Create a new election manifest"""
    try:
        # For demo, we'll use the hardcoded manifest from the example
        # In a real implementation, you'd build this from the request data
        manifest = create_election_manifest()
        
        election_id = f"election-{uuid.uuid4()}"
        election_db["manifests"][election_id] = manifest
        
        return {
            "election_id": election_id,
            "manifest": serialize_manifest(manifest),
            "created_at": datetime.now()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating election: {str(e)}"
        )

@app.post("/guardians", response_model=GuardianResponse, status_code=status.HTTP_201_CREATED)
async def create_guardian(request: GuardianRequest):
    """Create a new election guardian"""
    try:
        guardian = Guardian.from_nonce(
            request.guardian_id,
            request.sequence_order,
            request.number_of_guardians,
            request.quorum
        )
        
        election_db["guardians"][request.guardian_id] = guardian
        
        return {
            "guardian_id": guardian.id,
            "sequence_order": guardian.sequence_order,
            "public_key": guardian.share_key().to_json()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating guardian: {str(e)}"
        )

@app.post("/key-ceremonies", response_model=KeyCeremonyResponse, status_code=status.HTTP_201_CREATED)
async def start_key_ceremony(request: KeyCeremonyRequest):
    """Start a new key ceremony"""
    try:
        ceremony_id = f"ceremony-{uuid.uuid4()}"
        guardians = [election_db["guardians"][gid] for gid in request.guardian_ids]
        
        # In a real implementation, we'd use the KeyCeremonyMediator
        # For this demo, we'll just store the guardian public keys
        public_keys = {}
        for guardian in guardians:
            public_keys[guardian.id] = guardian.share_key().to_json()
        
        election_db["key_ceremonies"][ceremony_id] = {
            "guardian_ids": request.guardian_ids,
            "quorum": request.quorum,
            "public_keys": public_keys,
            "status": "public_keys_shared"
        }
        
        return {
            "ceremony_id": ceremony_id,
            "guardian_public_keys": public_keys,
            "status": "public_keys_shared"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting key ceremony: {str(e)}"
        )

@app.post("/key-ceremonies/{ceremony_id}/backups", response_model=BackupResponse, status_code=status.HTTP_201_CREATED)
async def create_backup(ceremony_id: str, request: BackupRequest):
    """Create a partial key backup for a designated guardian"""
    try:
        ceremony = election_db["key_ceremonies"].get(ceremony_id)
        if not ceremony:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Key ceremony not found"
            )
            
        sending_guardian = election_db["guardians"].get(request.sending_guardian_id)
        if not sending_guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sending guardian not found"
            )
            
        # Generate backups (simplified for demo)
        sending_guardian.generate_election_partial_key_backups()
        backup = sending_guardian.share_election_partial_key_backup(request.designated_guardian_id)
        
        # Store backup (in real implementation, this would go to the mediator)
        backup_id = f"backup-{uuid.uuid4()}"
        
        return {
            "backup_id": backup_id,
            "sending_guardian_id": request.sending_guardian_id,
            "designated_guardian_id": request.designated_guardian_id,
            "backup_data": get_optional(backup).to_json()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating backup: {str(e)}"
        )

@app.post("/key-ceremonies/{ceremony_id}/verify", response_model=VerificationResponse)
async def verify_backup(ceremony_id: str, request: VerificationRequest):
    """Verify a guardian's backup"""
    try:
        ceremony = election_db["key_ceremonies"].get(ceremony_id)
        if not ceremony:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Key ceremony not found"
            )
            
        designated_guardian = election_db["guardians"].get(request.designated_guardian_id)
        if not designated_guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Designated guardian not found"
            )
            
        # In a real implementation, we'd get the backup from the mediator and verify it
        verification_id = f"verification-{uuid.uuid4()}"
        
        return {
            "verification_id": verification_id,
            "is_valid": True,  # Simplified for demo
            "message": "Backup verified successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verifying backup: {str(e)}"
        )

@app.post("/key-ceremonies/{ceremony_id}/joint-key", response_model=JointKeyResponse)
async def publish_joint_key(ceremony_id: str):
    """Publish the joint election key"""
    try:
        ceremony = election_db["key_ceremonies"].get(ceremony_id)
        if not ceremony:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Key ceremony not found"
            )
            
        # In a real implementation, we'd use the mediator to compute the joint key
        # For demo, we'll return a mock response
        joint_key = {
            "joint_public_key": {
                "key": "mock-joint-key",
                "coefficients": []
            },
            "commitment_hash": "mock-commitment-hash"
        }
        
        ceremony["status"] = "joint_key_published"
        ceremony["joint_key"] = joint_key
        
        return {
            "ceremony_id": ceremony_id,
            "joint_public_key": joint_key["joint_public_key"],
            "commitment_hash": joint_key["commitment_hash"],
            "status": "completed"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error publishing joint key: {str(e)}"
        )

@app.post("/encryption-devices", response_model=EncryptionDeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_encryption_device(request: EncryptionDeviceRequest):
    """Create a new encryption device"""
    try:
        # In a real implementation, we'd create an EncryptionDevice
        device_uuid = str(uuid.uuid4())
        
        return {
            "device_id": request.device_id,
            "uuid": device_uuid,
            "created_at": datetime.now()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating encryption device: {str(e)}"
        )

@app.post("/elections/{election_id}/ballots/plaintext", response_model=PlaintextBallotResponse, status_code=status.HTTP_201_CREATED)
async def create_plaintext_ballot(election_id: str, request: PlaintextBallotRequest):
    """Create a plaintext ballot"""
    try:
        manifest = election_db["manifests"].get(election_id)
        if not manifest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Election not found"
            )
            
        # In a real implementation, we'd validate the ballot against the manifest
        ballot_id = f"ballot-{uuid.uuid4()}"
        
        # Store the plaintext ballot (in production, this would be ephemeral)
        if "ballots" not in election_db:
            election_db["ballots"] = {}
        election_db["ballots"][ballot_id] = {
            "type": "plaintext",
            "data": request.dict(),
            "election_id": election_id
        }
        
        return {
            "ballot_id": ballot_id,
            "ballot_style_id": request.ballot_style_id,
            "contests": request.contests,
            "status": "created"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating plaintext ballot: {str(e)}"
        )

@app.post("/elections/{election_id}/ballots/encrypt", response_model=CiphertextBallotResponse)
async def encrypt_ballot(election_id: str, ballot_id: str):
    """Encrypt a plaintext ballot"""
    try:
        manifest = election_db["manifests"].get(election_id)
        if not manifest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Election not found"
            )
            
        ballot_data = election_db["ballots"].get(ballot_id)
        if not ballot_data or ballot_data["type"] != "plaintext":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Plaintext ballot not found"
            )
            
        # In a real implementation, we'd use the EncryptionMediator
        # For demo, we'll return a mock encrypted ballot
        tracking_id = str(uuid.uuid4())
        
        # Store the ciphertext ballot
        election_db["ballots"][ballot_id] = {
            "type": "ciphertext",
            "tracking_id": tracking_id,
            "election_id": election_id,
            "status": "encrypted"
        }
        
        return {
            "ballot_id": ballot_id,
            "ballot_style_id": ballot_data["data"]["ballot_style_id"],
            "contests": ballot_data["data"]["contests"],  # In real implementation, these would be encrypted
            "tracking_id": tracking_id,
            "status": "encrypted"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error encrypting ballot: {str(e)}"
        )

@app.post("/elections/{election_id}/ballots/submit", response_model=SubmitBallotResponse)
async def submit_ballot(election_id: str, request: SubmitBallotRequest):
    """Submit a ballot (cast or spoil)"""
    try:
        manifest = election_db["manifests"].get(election_id)
        if not manifest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Election not found"
            )
            
        ballot_data = election_db["ballots"].get(request.ballot_id)
        if not ballot_data or ballot_data["type"] != "ciphertext":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ciphertext ballot not found"
            )
            
        # In a real implementation, we'd use the BallotBox
        state = "CAST" if request.action.lower() == "cast" else "SPOILED"
        
        # Update ballot status
        election_db["ballots"][request.ballot_id]["state"] = state
        election_db["ballots"][request.ballot_id]["submitted_at"] = datetime.now()
        
        return {
            "ballot_id": request.ballot_id,
            "state": state,
            "tracking_id": ballot_data["tracking_id"],
            "timestamp": datetime.now()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error submitting ballot: {str(e)}"
        )

@app.post("/elections/{election_id}/tally", response_model=TallyResponse)
async def tally_ballots(election_id: str):
    """Tally the cast ballots"""
    try:
        manifest = election_db["manifests"].get(election_id)
        if not manifest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Election not found"
            )
            
        # In a real implementation, we'd tally the actual ballots
        # For demo, we'll return mock results
        tally_id = f"tally-{uuid.uuid4()}"
        
        # Count cast and spoiled ballots
        cast_count = sum(1 for b in election_db["ballots"].values() if b.get("state") == "CAST")
        spoiled_count = sum(1 for b in election_db["ballots"].values() if b.get("state") == "SPOILED")
        
        # Mock contest results
        contest_results = {}
        for contest in manifest.contests:
            contest_results[contest.object_id] = {
                "name": contest.name,
                "selections": {
                    sel.object_id: {
                        "candidate_id": sel.candidate_id,
                        "tally": random.randint(0, cast_count)
                    }
                    for sel in contest.ballot_selections
                }
            }
        
        # Store the tally
        election_db["tallies"][tally_id] = {
            "election_id": election_id,
            "contest_results": contest_results,
            "cast_count": cast_count,
            "spoiled_count": spoiled_count
        }
        
        return {
            "tally_id": tally_id,
            "contest_results": contest_results,
            "cast_ballot_count": cast_count,
            "spoiled_ballot_count": spoiled_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error tallying ballots: {str(e)}"
        )

@app.post("/tallies/{tally_id}/decryption-shares", response_model=DecryptionShareResponse)
async def create_decryption_share(tally_id: str, request: DecryptionShareRequest):
    """Create a decryption share for a tally"""
    try:
        tally = election_db["tallies"].get(tally_id)
        if not tally:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tally not found"
            )
            
        guardian = election_db["guardians"].get(request.guardian_id)
        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Guardian not found"
            )
            
        # In a real implementation, we'd compute the actual shares
        # For demo, we'll return mock data
        share_id = f"share-{uuid.uuid4()}"
        
        return {
            "share_id": share_id,
            "guardian_id": request.guardian_id,
            "tally_share": {
                "guardian_id": request.guardian_id,
                "tally_id": tally_id,
                "share": "mock-tally-share"
            },
            "ballot_shares": {
                "mock-ballot-id": {
                    "guardian_id": request.guardian_id,
                    "ballot_id": "mock-ballot-id",
                    "share": "mock-ballot-share"
                }
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating decryption share: {str(e)}"
        )

@app.post("/tallies/{tally_id}/decrypt", response_model=DecryptedTallyResponse)
async def decrypt_tally(tally_id: str):
    """Decrypt a tally using the collected shares"""
    try:
        tally = election_db["tallies"].get(tally_id)
        if not tally:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tally not found"
            )
            
        # In a real implementation, we'd use the DecryptionMediator
        # For demo, we'll return mock decrypted results
        plaintext_tally = {}
        for contest_id, contest in tally["contest_results"].items():
            plaintext_tally[contest_id] = {
                "name": contest["name"],
                "selections": {
                    sel_id: {
                        "candidate_id": sel["candidate_id"],
                        "tally": sel["tally"],
                        "decrypted": True
                    }
                    for sel_id, sel in contest["selections"].items()
                }
            }
        
        # Mock spoiled ballots
        spoiled_ballots = {
            bid: {
                "contests": {
                    contest.object_id: {
                        "selections": {
                            sel.object_id: {
                                "vote": random.randint(0, 1),
                                "decrypted": True
                            }
                            for sel in contest.ballot_selections
                        }
                    }
                    for contest in tally["manifest"].contests
                }
            }
            for bid, b in election_db["ballots"].items() 
            if b.get("state") == "SPOILED"
        }
        
        return {
            "tally_id": tally_id,
            "plaintext_tally": plaintext_tally,
            "spoiled_ballots": spoiled_ballots,
            "verification_status": "verified"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error decrypting tally: {str(e)}"
        )

@app.get("/elections/{election_id}/results")
async def get_election_results(election_id: str):
    """Get the final election results"""
    try:
        manifest = election_db["manifests"].get(election_id)
        if not manifest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Election not found"
            )
            
        # Find the most recent tally for this election
        tally = next(
            (t for t_id, t in election_db["tallies"].items() 
            if t["election_id"] == election_id),
            None
        )
        
        if not tally:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No tally found for this election"
            )
            
        # Format results for display
        results = {
            "election_id": election_id,
            "total_ballots": tally["cast_count"] + tally["spoiled_count"],
            "cast_ballots": tally["cast_count"],
            "spoiled_ballots": tally["spoiled_count"],
            "contests": []
        }
        
        for contest_id, contest in tally["contest_results"].items():
            contest_data = {
                "contest_id": contest_id,
                "name": contest["name"],
                "selections": []
            }
            
            for sel_id, sel in contest["selections"].items():
                candidate = next(
                    (c for c in manifest.candidates 
                    if c.object_id == sel["candidate_id"]),
                    None
                )
                party = next(
                    (p for p in manifest.parties 
                    if candidate and p.object_id == candidate.party_id),
                    None
                )
                
                contest_data["selections"].append({
                    "selection_id": sel_id,
                    "candidate_id": sel["candidate_id"],
                    "candidate_name": candidate.name if candidate else "Unknown",
                    "party_name": party.name if party else "Independent",
                    "votes": sel["tally"],
                    "is_winner": False  # Would be determined based on votes
                })
            
            # Determine winner(s)
            if contest_data["selections"]:
                max_votes = max(s["votes"] for s in contest_data["selections"])
                for sel in contest_data["selections"]:
                    sel["is_winner"] = sel["votes"] == max_votes
                    
            results["contests"].append(contest_data)
        
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting election results: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)