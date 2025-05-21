#!/usr/bin/env python
from flask import Flask, request, jsonify
from typing import Dict, List, Optional, Tuple, Any
import random
from datetime import datetime, timedelta
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

app = Flask(__name__)

# In-memory storage for election state
election_db = {
    "elections": {},
    "sessions": {}
}

class ElectionState:
    """Class to maintain state for an election process"""
    def __init__(self):
        self.manifest = None
        self.guardians = []
        self.joint_key = None
        self.context = None
        self.internal_manifest = None
        self.plaintext_ballots = []
        self.ciphertext_ballots = []
        self.ballot_store = DataStore()
        self.ciphertext_tally = None
        self.plaintext_tally = None

@app.route('/api/election/create', methods=['POST'])
def create_election():
    """Create a new election manifest"""
    try:
        data = request.json
        session_id = str(uuid.uuid4())
        
        # Create manifest from request data
        manifest = Manifest(
            election_scope_id=data.get('election_scope_id', f"election-{uuid.uuid4()}"),
            spec_version=SpecVersion.EG0_95,
            type=ElectionType.general,
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(days=1),
            geopolitical_units=[GeopoliticalUnit(
                object_id=unit['object_id'],
                name=unit['name'],
                type=ReportingUnitType.county,
            ) for unit in data['geopolitical_units']],
            parties=[Party(
                object_id=party['object_id'],
                name=party['name'],
                abbreviation=party.get('abbreviation', party['name'][:3].upper()),
            ) for party in data['parties']],
            candidates=[Candidate(
                object_id=candidate['object_id'],
                name=candidate['name'],
                party_id=candidate['party_id'],
            ) for candidate in data['candidates']],
            contests=[Contest(
                object_id=contest['object_id'],
                sequence_order=i,
                electoral_district_id=contest['electoral_district_id'],
                vote_variation=VoteVariationType.one_of_m,
                name=contest['name'],
                ballot_selections=[SelectionDescription(
                    object_id=f"{contest['object_id']}-selection-{j+1}",
                    candidate_id=selection['candidate_id'],
                    sequence_order=j,
                ) for j, selection in enumerate(contest['ballot_selections'])],
                votes_allowed=contest.get('votes_allowed', 1),
                number_elected=contest.get('number_elected', 1),
            ) for i, contest in enumerate(data['contests'])],
            ballot_styles=[BallotStyle(
                object_id=style['object_id'],
                geopolitical_unit_ids=style['geopolitical_unit_ids'],
            ) for style in data['ballot_styles']],
            name=data.get('name', 'General Election'),
        )
        
        # Initialize election state
        election_state = ElectionState()
        election_state.manifest = manifest
        
        # Store in database
        election_db['elections'][session_id] = election_state
        election_db['sessions'][session_id] = {
            'step': 'created',
            'manifest': manifest,
        }
        
        return jsonify({
            'status': 'success',
            'session_id': session_id,
            'manifest': manifest,
            'next_step': 'key_ceremony',
            'required_params': {
                'number_of_guardians': 'int',
                'quorum': 'int'
            }
        }), 201
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/election/key_ceremony', methods=['POST'])
def key_ceremony():
    """Conduct the key ceremony"""
    try:
        data = request.json
        session_id = data['session_id']
        
        if session_id not in election_db['elections']:
            return jsonify({'status': 'error', 'message': 'Invalid session ID'}), 404
            
        election_state = election_db['elections'][session_id]
        
        number_of_guardians = data['number_of_guardians']
        quorum = data['quorum']
        
        if quorum > number_of_guardians:
            quorum = number_of_guardians
        
        # Create guardians
        guardians = []
        for i in range(number_of_guardians):
            guardian_id = data.get('guardian_ids', [str(i+1) for i in range(number_of_guardians)])[i]
            guardian = Guardian.from_nonce(
                guardian_id,
                i + 1,
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
        
        # ROUND 2: Partial Key Backup Sharing
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
        
        # Build election context
        election_builder = ElectionBuilder(
            number_of_guardians, 
            quorum,
            election_state.manifest
        )
        election_builder.set_public_key(joint_key.joint_public_key)
        election_builder.set_commitment_hash(joint_key.commitment_hash)
        internal_manifest, context = get_optional(election_builder.build())
        
        # Update election state
        election_state.guardians = guardians
        election_state.joint_key = joint_key
        election_state.context = context
        election_state.internal_manifest = internal_manifest
        
        # Update session
        election_db['sessions'][session_id]['step'] = 'key_ceremony_complete'
        election_db['sessions'][session_id]['joint_public_key'] = str(joint_key.joint_public_key)
        
        return jsonify({
            'status': 'success',
            'joint_public_key': str(joint_key.joint_public_key),
            'guardians': [{
                'id': g.id,
                'sequence_order': g.sequence_order,
                'public_key': str(g.share_key().key)
            } for g in guardians],
            'next_step': 'voting',
            'required_params': {
                'ballots': 'list of ballot objects'
            }
        }), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/election/vote', methods=['POST'])
def vote():
    """Process voting"""
    try:
        data = request.json
        session_id = data['session_id']
        
        if session_id not in election_db['elections']:
            return jsonify({'status': 'error', 'message': 'Invalid session ID'}), 404
            
        election_state = election_db['elections'][session_id]
        
        # Create encryption device and mediator
        device = EncryptionDevice(
            device_id=1, 
            session_id=1, 
            launch_code=1, 
            location="polling-place"
        )
        encrypter = EncryptionMediator(
            election_state.internal_manifest, 
            election_state.context, 
            device
        )
        
        plaintext_ballots = []
        ciphertext_ballots = []
        
        for ballot_data in data['ballots']:
            # Create ballot contests from input
            ballot_contests = []
            
            for contest_data in ballot_data['contests']:
                # Create selections
                ballot_selections = []
                for j, selection_data in enumerate(contest_data['selections']):
                    ballot_selections.append(
                        PlaintextBallotSelection(
                            object_id=selection_data['object_id'],
                            vote=selection_data['vote'],
                            is_placeholder_selection=False,
                        )
                    )
                
                ballot_contests.append(
                    PlaintextBallotContest(
                        object_id=contest_data['object_id'],
                        ballot_selections=ballot_selections
                    )
                )
            
            # Create and encrypt ballot
            plaintext_ballot = PlaintextBallot(
                object_id=ballot_data['object_id'],
                style_id=ballot_data['style_id'],
                contests=ballot_contests,
            )
            
            encrypted_ballot = encrypter.encrypt(plaintext_ballot)
            if encrypted_ballot:
                ciphertext_ballot = get_optional(encrypted_ballot)
                plaintext_ballots.append(plaintext_ballot)
                ciphertext_ballots.append(ciphertext_ballot)
        
        # Update election state
        election_state.plaintext_ballots = plaintext_ballots
        election_state.ciphertext_ballots = ciphertext_ballots
        
        # Update session
        election_db['sessions'][session_id]['step'] = 'voting_complete'
        election_db['sessions'][session_id]['ballots_count'] = len(ciphertext_ballots)
        
        return jsonify({
            'status': 'success',
            'ballots_encrypted': len(ciphertext_ballots),
            'next_step': 'tally',
            'required_params': {}
        }), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/election/tally', methods=['POST'])
def tally():
    """Tally the votes"""
    try:
        data = request.json
        session_id = data['session_id']
        
        if session_id not in election_db['elections']:
            return jsonify({'status': 'error', 'message': 'Invalid session ID'}), 404
            
        election_state = election_db['elections'][session_id]
        
        # Cast all ballots
        ballot_box = BallotBox(
            election_state.internal_manifest, 
            election_state.context, 
            election_state.ballot_store
        )
        
        for ballot in election_state.ciphertext_ballots:
            submitted_ballot = ballot_box.cast(ballot)
            if not submitted_ballot:
                return jsonify({
                    'status': 'error', 
                    'message': f'Failed to cast ballot: {ballot.object_id}'
                }), 400
        
        # Tally the ballots
        ciphertext_tally = get_optional(
            tally_ballots(
                election_state.ballot_store, 
                election_state.internal_manifest, 
                election_state.context
            )
        )
        
        # Update election state
        election_state.ciphertext_tally = ciphertext_tally
        
        # Update session
        election_db['sessions'][session_id]['step'] = 'tally_complete'
        election_db['sessions'][session_id]['cast_ballots'] = ciphertext_tally.cast()
        
        return jsonify({
            'status': 'success',
            'cast_ballots': ciphertext_tally.cast(),
            'next_step': 'decrypt',
            'required_params': {
                'guardian_ids': 'list of guardian IDs participating in decryption'
            }
        }), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/election/decrypt', methods=['POST'])
def decrypt():
    """Decrypt the tally"""
    try:
        data = request.json
        session_id = data['session_id']
        
        if session_id not in election_db['elections']:
            return jsonify({'status': 'error', 'message': 'Invalid session ID'}), 404
            
        election_state = election_db['elections'][session_id]
        
        # Setup decryption mediator
        decryption_mediator = DecryptionMediator(
            "decryption-mediator",
            election_state.context,
        )
        
        # Get participating guardians
        guardian_ids = data['guardian_ids']
        participating_guardians = [
            g for g in election_state.guardians 
            if g.id in guardian_ids
        ]
        
        if len(participating_guardians) < election_state.context.quorum:
            return jsonify({
                'status': 'error',
                'message': f'Need at least {election_state.context.quorum} guardians for decryption'
            }), 400
        
        # Add guardian shares
        for guardian in participating_guardians:
            guardian_key = guardian.share_key()
            tally_share = guardian.compute_tally_share(
                election_state.ciphertext_tally, 
                election_state.context
            )
            
            decryption_mediator.announce(
                guardian_key, 
                get_optional(tally_share),
                {}  # No ballot shares in this version
            )
        
        # Get Lagrange coefficients
        lagrange_coefficients = LagrangeCoefficientsRecord(
            decryption_mediator.get_lagrange_coefficients()
        )
        
        # Decrypt the tally
        plaintext_tally = get_optional(
            decryption_mediator.get_plaintext_tally(
                election_state.ciphertext_tally, 
                election_state.manifest
            )
        )
        
        if not plaintext_tally:
            return jsonify({
                'status': 'error',
                'message': 'Failed to decrypt tally'
            }), 400
        
        # Update election state
        election_state.plaintext_tally = plaintext_tally
        
        # Prepare results
        results = {}
        for contest in election_state.manifest.contests:
            contest_results = plaintext_tally.contests.get(contest.object_id)
            if contest_results:
                results[contest.object_id] = {
                    'name': contest.name,
                    'results': {
                        selection.object_id: {
                            'candidate_id': selection.candidate_id,
                            'tally': contest_results.selections[selection.object_id].tally
                        }
                        for selection in contest.ballot_selections
                    }
                }
        
        # Update session
        election_db['sessions'][session_id]['step'] = 'decryption_complete'
        election_db['sessions'][session_id]['results'] = results
        
        return jsonify({
            'status': 'success',
            'results': results,
            'next_step': None,
            'message': 'Election complete'
        }), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/election/status/<session_id>', methods=['GET'])
def get_status(session_id):
    """Get election status"""
    if session_id not in election_db['sessions']:
        return jsonify({'status': 'error', 'message': 'Invalid session ID'}), 404
    
    return jsonify(election_db['sessions'][session_id]), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)