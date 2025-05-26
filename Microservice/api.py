from flask import Flask, request, jsonify
from typing import Dict, List, Optional, Tuple, Any
import random
from datetime import datetime
import uuid
from collections import defaultdict
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

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Docker health monitoring."""
    return jsonify({"status": "healthy", "service": "electionguard"}), 200

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

def get_spoiled_ballot_info(
    plaintext_spoiled_ballots: Dict[BallotId, PlaintextTally],
    party_names,
    candidate_names
) -> List[Dict[str, Any]]:
    manifest = create_election_manifest(
        party_names,
        candidate_names,
    )
    spoiled_ballot_info = []
    
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
                if selection_tally.tally == 1:
                    candidate_name = selection_to_candidate.get(selection_id, "Unknown")
                    ballot_data["selections"].append({
                        "contest_id": contest_id,
                        "selection_id": selection_id,
                        "candidate": candidate_name
                    })
        
        spoiled_ballot_info.append(ballot_data)
    
    return spoiled_ballot_info

@app.route('/setup_guardians', methods=['POST'])
def api_setup_guardians():
    """API endpoint for setting up guardians and creating joint key."""
    try:
        data = request.json
        number_of_guardians = data['number_of_guardians']
        quorum = data['quorum']
        
        guardian_public_keys_json, guardian_private_keys_json, guardian_polynomials_json, joint_public_key_json, commitment_hash_json = setup_guardians_and_joint_key(
            number_of_guardians=number_of_guardians,
            quorum=quorum
        )
        
        return jsonify({
            "success": True,
            "guardian_public_keys": guardian_public_keys_json,
            "guardian_private_keys": guardian_private_keys_json,
            "guardian_polynomials": guardian_polynomials_json,
            "joint_public_key": int(joint_public_key_json),
            "commitment_hash": int(commitment_hash_json)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/create_encrypted_ballot', methods=['POST'])
def api_create_encrypted_ballot():
    """API endpoint for creating an encrypted ballot."""
    try:
        data = request.json
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        candidate_name = data['candidate_name']
        ballot_id = data['ballot_id']
        joint_public_key_json = data['joint_public_key']
        commitment_hash_json = data['commitment_hash']
        
        ballot = create_plaintext_ballot(party_names, candidate_names, candidate_name, ballot_id)
        encrypted_ballot = encrypt_ballot(
            party_names, 
            candidate_names, 
            joint_public_key_json, 
            commitment_hash_json, 
            ballot
        )
        
        return jsonify({
            "success": True,
            "encrypted_ballot": to_raw(encrypted_ballot)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/create_encrypted_tally', methods=['POST'])
def api_create_encrypted_tally():
    """API endpoint for creating an encrypted tally."""
    try:
        data = request.json
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        joint_public_key_json = data['joint_public_key']
        commitment_hash_json = data['commitment_hash']
        encrypted_ballots_json = data['encrypted_ballots']
        
        ciphertext_tally_json, submitted_ballots = tally_encrypted_ballots(
            party_names, 
            candidate_names, 
            joint_public_key_json, 
            commitment_hash_json, 
            encrypted_ballots_json
        )
        
        return jsonify({
            "success": True,
            "ciphertext_tally": ciphertext_tally_json,
            "submitted_ballots": submitted_ballots
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/decrypt_tally', methods=['POST'])
def api_decrypt_tally():
    """API endpoint for decrypting the tally."""
    try:
        data = request.json
        guardian_public_keys_json = data['guardian_public_keys']
        guardian_private_keys_json = data['guardian_private_keys']
        guardian_polynomials_json = data['guardian_polynomials']
        party_names = data['party_names']
        candidate_names = data['candidate_names']
        ciphertext_tally_json = data['ciphertext_tally']
        submitted_ballots_json = data['submitted_ballots']
        joint_public_key_json = data['joint_public_key']
        commitment_hash_json = data['commitment_hash']
        
        result = decrypt_tally_and_ballots(
            guardian_public_keys_json=guardian_public_keys_json,
            guardian_private_keys_json=guardian_private_keys_json,
            guardian_polynomials_json=guardian_polynomials_json,
            party_names=party_names,
            candidate_names=candidate_names,
            ciphertext_tally_json=ciphertext_tally_json,
            submitted_ballots_json=submitted_ballots_json,
            joint_public_key_json=joint_public_key_json,
            commitment_hash_json=commitment_hash_json
        )
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

def setup_guardians_and_joint_key(number_of_guardians: int, quorum: int) -> Tuple[List[Guardian], ElementModP, ElementModQ]:
    """Setup guardians and create joint key."""
    print("\n🔹 Setting up guardians and creating joint key")
    
    guardians: List[Guardian] = []
    for i in range(number_of_guardians):
        guardian = Guardian.from_nonce(
            str(i + 1),
            i + 1,
            number_of_guardians,
            quorum,
        )
        guardians.append(guardian)
        print(f"✅ Created Guardian {i+1} with ID: {guardian.id}")
    
    mediator = KeyCeremonyMediator(
        "key-ceremony-mediator", 
        guardians[0].ceremony_details
    )
    
    for guardian in guardians:
        mediator.announce(guardian.share_key())
        print(f"   ✅ Guardian {guardian.id} announced public key")
        
    for guardian in guardians:
        announced_keys = get_optional(mediator.share_announced())
        for key in announced_keys:
            if guardian.id != key.owner_id:
                guardian.save_guardian_key(key)
                print(f"   ✅ Guardian {guardian.id} saved key from Guardian {key.owner_id}")
    
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
    
    for designated_guardian in guardians:
        backups = get_optional(mediator.share_backups(designated_guardian.id))
        print(f"   ✅ Mediator shared {len(backups)} backups for Guardian {designated_guardian.id}")
        
        for backup in backups:
            designated_guardian.save_election_partial_key_backup(backup)
            print(f"   ✅ Guardian {designated_guardian.id} saved backup from Guardian {backup.owner_id}")
    
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
    
    joint_key = get_optional(mediator.publish_joint_key())
    print(f"✅ Joint election key published: {joint_key.joint_public_key}")
    print(f"✅ Commitment hash: {joint_key.commitment_hash}")
    
    guardian_public_keys_json = [int(g._election_keys.key_pair.public_key) for g in guardians]
    guardian_private_keys_json = [int(g._election_keys.key_pair.secret_key) for g in guardians]
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
    """Encrypt a single ballot."""
    joint_public_key = int_to_p(joint_public_key_json)
    commitment_hash = int_to_q(commitment_hash_json)
    manifest = create_election_manifest(
        party_names,
        candidate_names,
    )
    print(f"\n🔹 Encrypting ballot: {plaintext_ballot.object_id}")
    
    election_builder = ElectionBuilder(
        number_of_guardians=1,
        quorum=1,
        manifest=manifest
    )
    election_builder.set_public_key(joint_public_key)
    election_builder.set_commitment_hash(commitment_hash)
    
    internal_manifest, context = get_optional(election_builder.build())
    
    device = EncryptionDevice(device_id=1, session_id=1, launch_code=1, location="polling-place")
    encrypter = EncryptionMediator(internal_manifest, context, device)
    
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
    """Tally encrypted ballots."""
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
    
    election_builder = ElectionBuilder(
        number_of_guardians=1,
        quorum=1,
        manifest=manifest
    )
    election_builder.set_public_key(joint_public_key)
    election_builder.set_commitment_hash(commitment_hash)
    
    internal_manifest, context = get_optional(election_builder.build())
    
    ballot_store = DataStore()
    ballot_box = BallotBox(internal_manifest, context, ballot_store)
    print(f"All ballots: {encrypted_ballots}")
    
    submitted_ballots = []
    for ballot in encrypted_ballots:
        submitted = ballot_box.cast(ballot)
        if submitted:
            submitted_ballots.append(get_optional(submitted))
            print(f"✅ Cast ballot: {ballot.object_id}")
        
    ciphertext_tally = get_optional(
        tally_ballots(ballot_store, internal_manifest, context)
    )
    print(f"✅ Created encrypted tally with {ciphertext_tally.cast()} cast ballots")
    print(f"Submitted Ballots: {submitted_ballots}")
    ciphertext_tally_json = ciphertext_tally_to_raw(ciphertext_tally)
    
    submitted_ballots = [to_raw(submitted_ballot) for submitted_ballot in submitted_ballots]
    return ciphertext_tally_json, submitted_ballots

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
        manifest = create_election_manifest(party_names, candidate_names)
        election_builder = ElectionBuilder(
            number_of_guardians=len(guardian_public_keys_json),
            quorum=len(guardian_public_keys_json),
            manifest=manifest
        )
        
        joint_public_key = int_to_p(joint_public_key_json)
        commitment_hash = int_to_q(commitment_hash_json)
        election_builder.set_public_key(joint_public_key)
        election_builder.set_commitment_hash(commitment_hash)
        
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

        internal_manifest, context = get_optional(election_builder.build())
        
        ciphertext_tally = raw_to_ciphertext_tally(ciphertext_tally_json, manifest=manifest)
        submitted_ballots = [
            from_raw(SubmittedBallot, ballot_json)
            for ballot_json in submitted_ballots_json
        ]

        decryption_mediator = DecryptionMediator(
            "decryption-mediator",
            context,
        )

        for election_key in _election_keys:
            guardian_key = election_key.share()
            tally_share = compute_tally_share(election_key, ciphertext_tally, context)
            ballot_shares = compute_ballot_shares(election_key, submitted_ballots, context)
            
            decryption_mediator.announce(
                guardian_key,
                get_optional(tally_share),
                ballot_shares
            )

        plaintext_tally = get_optional(
            decryption_mediator.get_plaintext_tally(ciphertext_tally, manifest)
        )
        plaintext_spoiled_ballots = get_optional(
            decryption_mediator.get_plaintext_ballots(submitted_ballots, manifest)
        )
        
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

        return result

    except Exception as e:
        return {
            "success": False,
            "message": f"Decryption failed: {str(e)}"
        }

def compute_tally_share(
        _election_keys: ElectionKeyPair,
        tally: CiphertextTally, context: CiphertextElectionContext
    ) -> Optional[DecryptionShare]:
        return compute_decryption_share(
            _election_keys,
            tally,
            context,
        )

def compute_ballot_shares(
    _election_keys: ElectionKeyPair,
    ballots: List[SubmittedBallot], context: CiphertextElectionContext
) -> Dict[BallotId, Optional[DecryptionShare]]:
    shares = {}
    for ballot in ballots:
        share = compute_decryption_share_for_ballot(
            _election_keys,
            ballot,
            context,
        )
        shares[ballot.object_id] = share
    return shares

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)