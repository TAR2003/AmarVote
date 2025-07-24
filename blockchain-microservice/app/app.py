import os
import json
import time
from flask import Flask, request, jsonify
from web3 import Web3
from web3.middleware import geth_poa_middleware

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Load environment variables
GANACHE_URL = os.getenv('GANACHE_URL', 'http://ganache:8545')
NETWORK_ID = int(os.getenv('NETWORK_ID', '1337'))
CONTRACT_ARTIFACTS_PATH = os.getenv('CONTRACT_ARTIFACTS_PATH', '/app/contracts')

# Global variables for blockchain connection
w3 = None
voting_contract = None
contract_address = None
owner_account = None

def init_blockchain():
    """Initialize blockchain connection and contract"""
    global w3, voting_contract, contract_address, owner_account
    
    try:
        # Connect to Web3
        w3 = Web3(Web3.HTTPProvider(GANACHE_URL))
        
        # Add PoA middleware (required for some networks)
        w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        # Wait for connection
        max_retries = 30
        for i in range(max_retries):
            if w3.is_connected():
                break
            time.sleep(2)
            print(f"Waiting for Web3 connection... ({i+1}/{max_retries})")
        
        if not w3.is_connected():
            raise Exception("Could not connect to Ganache")
        
        print(f"Connected to Web3 at {GANACHE_URL}")
        
        # Wait for contract artifacts
        contract_path = os.path.join(CONTRACT_ARTIFACTS_PATH, 'VotingContract.json')
        for i in range(max_retries):
            if os.path.exists(contract_path):
                break
            time.sleep(2)
            print(f"Waiting for contract artifacts... ({i+1}/{max_retries})")
        
        if not os.path.exists(contract_path):
            raise Exception("Contract artifacts not found")
        
        # Load contract
        with open(contract_path) as f:
            contract_artifacts = json.load(f)
            
        if str(NETWORK_ID) not in contract_artifacts['networks']:
            raise Exception(f"Contract not deployed on network {NETWORK_ID}")
            
        contract_address = contract_artifacts['networks'][str(NETWORK_ID)]['address']
        voting_contract = w3.eth.contract(
            address=contract_address,
            abi=contract_artifacts['abi']
        )
        
        # Set the owner account (first account from Ganache)
        accounts = w3.eth.accounts
        if not accounts:
            raise Exception("No accounts available")
        
        owner_account = accounts[0]
        w3.eth.defaultAccount = owner_account
        
        print(f"Contract loaded at address: {contract_address}")
        print(f"Using owner account: {owner_account}")
        
        return True
        
    except Exception as e:
        print(f"Failed to initialize blockchain: {str(e)}")
        return False

# Initialize blockchain on startup
if not init_blockchain():
    print("WARNING: Blockchain initialization failed. Some endpoints may not work.")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    blockchain_status = 'connected' if w3 and w3.is_connected() else 'disconnected'
    contract_status = 'loaded' if voting_contract else 'not loaded'
    
    return jsonify({
        'status': 'healthy',
        'blockchain': blockchain_status,
        'contract': contract_status,
        'contract_address': contract_address
    })

@app.route('/create-election', methods=['POST'])
def create_election():
    """Create a new election on the blockchain"""
    
    # Check if blockchain is initialized
    if not w3 or not voting_contract or not owner_account:
        return jsonify({
            'status': 'error', 
            'message': 'Blockchain not properly initialized'
        }), 503
    
    # Validate request data
    if not request.is_json:
        return jsonify({
            'status': 'error', 
            'message': 'Request must be JSON'
        }), 400
    
    data = request.get_json()
    election_id = data.get('election_id')
    
    # Validate required fields
    if not election_id:
        return jsonify({
            'status': 'error',
            'message': 'Missing required field: election_id'
        }), 400
    
    # Validate field type and length
    if not isinstance(election_id, str) or len(election_id.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'election_id must be a non-empty string'
        }), 400
    
    try:
        # Check if election already exists
        exists = voting_contract.functions.checkElectionExists(election_id.strip()).call()
        if exists:
            return jsonify({
                'status': 'error',
                'message': 'Election already exists'
            }), 400
        
        # Create election on blockchain
        tx_hash = voting_contract.functions.createElection(
            election_id.strip()
        ).transact({'from': owner_account})
        
        # Wait for transaction confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return jsonify({
            'status': 'success',
            'message': 'Election created successfully',
            'election_id': election_id.strip(),
            'transaction_hash': tx_hash.hex(),
            'block_number': receipt.blockNumber,
            'timestamp': int(time.time())
        }), 201
        
    except ValueError as e:
        # Handle contract revert errors
        error_msg = str(e)
        if 'revert' in error_msg.lower():
            return jsonify({
                'status': 'error',
                'message': f'Contract error: {error_msg}'
            }), 400
        else:
            return jsonify({
                'status': 'error',
                'message': f'Transaction error: {error_msg}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/record-ballot', methods=['POST'])
def record_ballot():
    """Record a ballot on the blockchain (backend only)"""
    
    # Check if blockchain is initialized
    if not w3 or not voting_contract or not owner_account:
        return jsonify({
            'status': 'error', 
            'message': 'Blockchain not properly initialized'
        }), 503
    
    # Validate request data
    if not request.is_json:
        return jsonify({
            'status': 'error', 
            'message': 'Request must be JSON'
        }), 400
    
    data = request.get_json()
    election_id = data.get('election_id')
    tracking_code = data.get('tracking_code')
    ballot_hash = data.get('ballot_hash')
    
    # Validate required fields
    if not all([election_id, tracking_code, ballot_hash]):
        return jsonify({
            'status': 'error',
            'message': 'Missing required fields: election_id, tracking_code, ballot_hash'
        }), 400
    
    # Validate field types and lengths
    if not isinstance(election_id, str) or len(election_id.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'election_id must be a non-empty string'
        }), 400
        
    if not isinstance(tracking_code, str) or len(tracking_code.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'tracking_code must be a non-empty string'
        }), 400
        
    if not isinstance(ballot_hash, str) or len(ballot_hash.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'ballot_hash must be a non-empty string'
        }), 400
    
    try:
        # Check if election exists
        exists = voting_contract.functions.checkElectionExists(election_id.strip()).call()
        if not exists:
            return jsonify({
                'status': 'error',
                'message': 'Election does not exist. Please create the election first.'
            }), 400
        
        # Record ballot on blockchain
        tx_hash = voting_contract.functions.recordBallot(
            election_id.strip(), 
            tracking_code.strip(), 
            ballot_hash.strip()
        ).transact({'from': owner_account})
        
        # Wait for transaction confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return jsonify({
            'status': 'success',
            'message': 'Ballot recorded successfully',
            'transaction_hash': tx_hash.hex(),
            'block_number': receipt.blockNumber,
            'timestamp': int(time.time())
        }), 201
        
    except ValueError as e:
        # Handle contract revert errors
        error_msg = str(e)
        if 'revert' in error_msg.lower():
            return jsonify({
                'status': 'error',
                'message': f'Contract error: {error_msg}'
            }), 400
        else:
            return jsonify({
                'status': 'error',
                'message': f'Transaction error: {error_msg}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/verify-ballot', methods=['GET'])
def verify_ballot():
    """Verify a ballot exists on the blockchain (public endpoint)"""
    
    # Check if blockchain is initialized
    if not w3 or not voting_contract:
        return jsonify({
            'status': 'error', 
            'message': 'Blockchain not properly initialized'
        }), 503
    
    election_id = request.args.get('election_id')
    tracking_code = request.args.get('tracking_code')
    ballot_hash = request.args.get('ballot_hash')
    
    # Validate required parameters
    if not all([election_id, tracking_code, ballot_hash]):
        return jsonify({
            'status': 'error',
            'message': 'Missing required parameters: election_id, tracking_code, ballot_hash'
        }), 400
    
    # Validate parameter types and lengths
    if len(election_id.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'election_id must be a non-empty string'
        }), 400
        
    if len(tracking_code.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'tracking_code must be a non-empty string'
        }), 400
        
    if len(ballot_hash.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'ballot_hash must be a non-empty string'
        }), 400
    
    try:
        # Verify ballot on blockchain
        exists, timestamp = voting_contract.functions.verifyBallot(
            election_id.strip(), 
            tracking_code.strip(), 
            ballot_hash.strip()
        ).call()
        
        result = {
            'exists': exists,
            'timestamp': timestamp if exists else None,
            'election_id': election_id.strip(),
            'tracking_code': tracking_code.strip(),
            'ballot_hash': ballot_hash.strip()
        }
        
        return jsonify({
            'status': 'success',
            'result': result
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error verifying ballot: {str(e)}'
        }), 500

@app.route('/ballot/<election_id>/<tracking_code>', methods=['GET'])
def get_ballot_info(election_id, tracking_code):
    """Get ballot information by election ID and tracking code (public endpoint)"""
    
    # Check if blockchain is initialized
    if not w3 or not voting_contract:
        return jsonify({
            'status': 'error', 
            'message': 'Blockchain not properly initialized'
        }), 503
    
    if not election_id or len(election_id.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'election_id must be a non-empty string'
        }), 400
    
    if not tracking_code or len(tracking_code.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'tracking_code must be a non-empty string'
        }), 400
    
    try:
        # Get ballot information from blockchain
        election_id_result, ballot_hash, timestamp, exists = voting_contract.functions.getBallotByTrackingCode(
            election_id.strip(),
            tracking_code.strip()
        ).call()
        
        if not exists:
            return jsonify({
                'status': 'error',
                'message': 'Ballot not found'
            }), 404
        
        result = {
            'exists': exists,
            'election_id': election_id_result,
            'ballot_hash': ballot_hash,
            'timestamp': timestamp,
            'tracking_code': tracking_code.strip()
        }
        
        return jsonify({
            'status': 'success',
            'result': result
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error retrieving ballot: {str(e)}'
        }), 500

@app.route('/get-logs/<election_id>', methods=['GET'])
def get_election_logs(election_id):
    """Get all logs for an election (public endpoint)"""
    
    # Check if blockchain is initialized
    if not w3 or not voting_contract:
        return jsonify({
            'status': 'error', 
            'message': 'Blockchain not properly initialized'
        }), 503
    
    if not election_id or len(election_id.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'election_id must be a non-empty string'
        }), 400
    
    try:
        # Check if election exists
        exists = voting_contract.functions.checkElectionExists(election_id.strip()).call()
        if not exists:
            return jsonify({
                'status': 'error',
                'message': 'Election does not exist'
            }), 404
        
        # Get election logs from blockchain
        messages, timestamps = voting_contract.functions.getElectionLogs(
            election_id.strip()
        ).call()
        
        # Format logs
        logs = []
        for i in range(len(messages)):
            logs.append({
                'message': messages[i],
                'timestamp': timestamps[i],
                'formatted_time': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(timestamps[i]))
            })
        
        result = {
            'election_id': election_id.strip(),
            'log_count': len(logs),
            'logs': logs
        }
        
        return jsonify({
            'status': 'success',
            'result': result
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error retrieving election logs: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)