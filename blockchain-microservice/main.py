
# ...existing code...

import json
import os
from fastapi import FastAPI, HTTPException
from web3 import Web3
from pydantic import BaseModel
from dotenv import load_dotenv
from eth_account import Account
from eth_account.signers.local import LocalAccount


load_dotenv()
print(f"Using contract at: {os.getenv('CONTRACT_ADDRESS')}")
print(f"Connected to node at: {os.getenv('HARDHAT_URL')}")

app = FastAPI()

# Initialize Web3 connection
hardhat_url = os.getenv("HARDHAT_URL", "http://hardhat:8545")
w3 = Web3(Web3.HTTPProvider(hardhat_url))

# Initialize account from private key
private_key = os.getenv("PRIVATE_KEY")
if not private_key:
    raise RuntimeError("Private key not configured in environment variables")

account: LocalAccount = Account.from_key(private_key)

# Load contract
contract_address = os.getenv("CONTRACT_ADDRESS")
if not contract_address:
    raise RuntimeError("Contract address not configured in environment variables")

# Ensure contract address is a valid checksum address
contract_address = w3.to_checksum_address(contract_address)

abi_path = os.path.join(os.path.dirname(__file__), "BallotTracker.json")

with open(abi_path) as f:
    contract_json = json.load(f)
    contract_abi = contract_json["abi"]
print("Loaded contract ABI:")
for entry in contract_abi:
    print(entry)

# Verify Web3 connection
if not w3.is_connected():
    raise RuntimeError("Failed to connect to Hardhat node")

contract = w3.eth.contract(address=contract_address, abi=contract_abi)
print("Available contract functions:", list(contract.functions))

# Test basic connectivity by getting record count
try:
    record_count = contract.functions.getRecordCount().call({'from': account.address})
    print(f"Contract is accessible. Current record count: {record_count}")
except Exception as e:
    print(f"Warning: Contract accessibility test failed: {e}")
    print("This might indicate deployment or connection issues")

class BallotRecord(BaseModel):
    election_id: str
    tracking_code: str
    ballot_hash: str

class VerifyRequest(BaseModel):
    election_id: str
    tracking_code: str
    ballot_hash: str

@app.post("/record-ballot")
async def record_ballot(record: BallotRecord):
    try:
        # Build transaction
        nonce = w3.eth.get_transaction_count(account.address)
        
        tx = contract.functions.recordBallot(
            record.election_id,
            record.tracking_code,
            record.ballot_hash
        ).build_transaction({
            'chainId': 1337,  # Hardhat default chain ID for local node
            'gas': 1000000,
            'maxFeePerGas': w3.to_wei('2', 'gwei'),
            'maxPriorityFeePerGas': w3.to_wei('1', 'gwei'),
            'nonce': nonce,
        })
        
        # Sign and send transaction
        signed_tx = account.sign_transaction(tx)
        # web3.py v6+ uses 'raw_transaction' instead of 'rawTransaction'
        raw_tx = getattr(signed_tx, 'rawTransaction', None)
        if raw_tx is None:
            raw_tx = getattr(signed_tx, 'raw_transaction', None)
        if raw_tx is None:
            raise HTTPException(status_code=500, detail="Failed to access raw transaction bytes from signed transaction.")
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        
        # Wait for receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return {
            "status": "success",
            "transaction_hash": tx_hash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "from_address": account.address
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to record ballot: {str(e)}")



@app.post("/verify-ballot")
async def verify_ballot(request: VerifyRequest):
    try:
        print(f"Calling verifyBallot with: election_id={request.election_id}, tracking_code={request.tracking_code}, ballot_hash={request.ballot_hash}")
        
        # Check if function exists in contract
        if not hasattr(contract.functions, "verifyBallot"):
            raise HTTPException(status_code=500, detail="verifyBallot function not found in contract ABI.")
        
        # First check if Web3 is still connected
        if not w3.is_connected():
            raise HTTPException(status_code=500, detail="Connection to blockchain node lost.")
        
        # Verify contract is deployed and accessible
        try:
            # Try a simple call first to ensure contract is accessible
            record_count = contract.functions.getRecordCount().call({'from': account.address})
            print(f"Contract is accessible. Record count: {record_count}")
        except Exception as connectivity_error:
            print(f"Contract connectivity test failed: {connectivity_error}")
            raise HTTPException(status_code=500, detail=f"Contract not accessible: {str(connectivity_error)}")
        
        # First try the direct contract verifyBallot function with simpler call
        try:
            # Try without specifying gas limit first
            result = contract.functions.verifyBallot(
                request.election_id,
                request.tracking_code,
                request.ballot_hash
            ).call()
            print(f"verifyBallot result: {result}")
            
            if isinstance(result, (list, tuple)) and len(result) == 2:
                verified, timestamp = result
                if verified:
                    return {
                        "verified": True,
                        "timestamp": timestamp,
                        "election_id": request.election_id,
                        "tracking_code": request.tracking_code,
                        "ballot_hash": request.ballot_hash
                    }
                else:
                    # Contract verified that ballot doesn't exist, return 404 as expected
                    raise HTTPException(
                        status_code=404, 
                        detail="Ballot not found or verification failed. Please check your tracking code and ballot hash."
                    )
        except Exception as contract_error:
            print(f"verifyBallot contract call error: {contract_error}")
            # Contract call failed, try manual verification as fallback
            
        # Fallback: Manual verification by iterating through records
        try:
            record_count = contract.functions.getRecordCount().call({'from': account.address})
            print(f"Attempting manual verification with {record_count} records")
            
            for i in range(record_count):
                try:
                    record = contract.functions.getBallotRecord(i).call({'from': account.address})
                    election_id, tracking_code, ballot_hash, timestamp = record
                    if (election_id == request.election_id and 
                        tracking_code == request.tracking_code and 
                        ballot_hash == request.ballot_hash):
                        return {
                            "verified": True,
                            "timestamp": timestamp,
                            "election_id": request.election_id,
                            "tracking_code": request.tracking_code,
                            "ballot_hash": request.ballot_hash
                        }
                except Exception as record_error:
                    print(f"Error reading record {i}: {record_error}")
                    continue
            
            # If we get here, ballot was not found through manual verification
            raise HTTPException(
                status_code=404, 
                detail="Ballot not found or verification failed. Please check your tracking code and ballot hash."
            )
        except HTTPException:
            # Re-raise HTTPException as is
            raise
        except Exception as fallback_error:
            print(f"Fallback verification also failed: {fallback_error}")
            raise HTTPException(status_code=500, detail=f"Verification system error: {str(fallback_error)}")
            
    except HTTPException:
        # Re-raise HTTPException as is
        raise
    except Exception as e:
        print(f"verifyBallot error: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

@app.get("/record-count")
async def get_record_count():
    try:
        count = contract.functions.getRecordCount().call({'from': account.address})
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get record count: {str(e)}")

@app.get("/debug/records")
async def get_all_records():
    """Debug endpoint to list all records"""
    try:
        count = contract.functions.getRecordCount().call({'from': account.address})
        records = []
        for i in range(count):
            try:
                record = contract.functions.getBallotRecord(i).call({'from': account.address})
                election_id, tracking_code, ballot_hash, timestamp = record
                records.append({
                    "index": i,
                    "election_id": election_id,
                    "tracking_code": tracking_code,
                    "ballot_hash": ballot_hash,
                    "timestamp": timestamp
                })
            except Exception as e:
                records.append({
                    "index": i,
                    "error": str(e)
                })
        return {
            "total_count": count,
            "records": records
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get records: {str(e)}")

@app.get("/health")
async def health_check():
    try:
        # Test contract connectivity
        record_count = contract.functions.getRecordCount().call({'from': account.address})
        return {
            "status": "healthy",
            "connected": w3.is_connected(),
            "contract_initialized": contract_address is not None,
            "latest_block": w3.eth.block_number,
            "chain_id": w3.eth.chain_id,
            "contract_address": contract_address,
            "record_count": record_count
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "connected": w3.is_connected(),
            "contract_initialized": contract_address is not None,
            "error": str(e)
        }