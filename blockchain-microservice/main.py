
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
abi_path = os.path.join(os.path.dirname(__file__), "BallotTracker.json")

with open(abi_path) as f:
    contract_json = json.load(f)
    contract_abi = contract_json["abi"]
print("Loaded contract ABI:")
for entry in contract_abi:
    print(entry)

contract = w3.eth.contract(address=contract_address, abi=contract_abi)
print("Available contract functions:", list(contract.functions))

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
        try:
            result = contract.functions.verifyBallot(
                request.election_id,
                request.tracking_code,
                request.ballot_hash
            ).call()
        except Exception as contract_error:
            print(f"verifyBallot contract call error: {contract_error}")
            raise HTTPException(status_code=404, detail="Ballot not found or verification failed. Please check your tracking code and ballot hash.")

        print(f"verifyBallot result: {result}")
        if not isinstance(result, (list, tuple)) or len(result) != 2:
            raise HTTPException(status_code=500, detail="Unexpected contract return value.")
        verified, timestamp = result
        if not verified:
            return {
                "verified": False,
                "message": "Ballot not verified. It may not exist or the hash does not match.",
                "election_id": request.election_id,
                "tracking_code": request.tracking_code,
                "ballot_hash": request.ballot_hash
            }
        return {
            "verified": True,
            "timestamp": timestamp,
            "election_id": request.election_id,
            "tracking_code": request.tracking_code,
            "ballot_hash": request.ballot_hash
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"verifyBallot error: {e}")
        raise HTTPException(status_code=400, detail=f"Verification failed: {str(e)}")

@app.get("/record-count")
async def get_record_count():
    try:
        count = contract.functions.getRecordCount().call()
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get record count: {str(e)}")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "connected": w3.is_connected(),
        "contract_initialized": contract_address is not None,
        "latest_block": w3.eth.block_number,
        "chain_id": w3.eth.chain_id
    }