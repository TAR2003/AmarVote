
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
import json
import os
import logging
import hashlib
from typing import Optional
import time
from datetime import datetime
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Blockchain Ballot API",
    description="Secure blockchain-backed ballot recording and verification system",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer(auto_error=False)

# Pydantic models with enhanced validation


class BallotRecordRequest(BaseModel):
    election_id: str
    tracking_code: str
    ballot_data: str  # The actual ballot data to be hashed
    voter_signature: str  # Signature from the voter's private key

    @validator('election_id')
    def validate_election_id(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Election ID cannot be empty')
        if len(v) > 100:
            raise ValueError('Election ID too long')
        return v.strip()

    @validator('tracking_code')
    def validate_tracking_code(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Tracking code cannot be empty')
        if len(v) > 100:
            raise ValueError('Tracking code too long')
        return v.strip()

    @validator('ballot_data')
    def validate_ballot_data(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Ballot data cannot be empty')
        return v.strip()


class BallotVerifyRequest(BaseModel):
    election_id: str
    tracking_code: str
    ballot_data: str

    @validator('election_id', 'tracking_code', 'ballot_data')
    def validate_fields(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Field cannot be empty')
        return v.strip()


class BallotRecordResponse(BaseModel):
    success: bool
    transaction_hash: str
    timestamp: int
    ballot_commitment: str
    message: str


class BallotVerifyResponse(BaseModel):
    exists: bool
    timestamp: Optional[int] = None
    voter_address: Optional[str] = None
    message: str


class ElectionCreateRequest(BaseModel):
    election_id: str
    start_time: int
    end_time: int


class VoterRegisterRequest(BaseModel):
    election_id: str
    voter_address: str


# Global variables for Web3 and contract
w3: Web3 = None
contract = None
deployer_account = None


def initialize_web3_connection():
    """Initialize Web3 connection and contract"""
    global w3, contract, deployer_account

    try:
        # Connect to Hardhat node
        hardhat_url = os.getenv("HARDHAT_URL", "http://hardhat:8545")
        w3 = Web3(Web3.HTTPProvider(hardhat_url))

        # Wait for connection
        max_retries = 30
        for i in range(max_retries):
            if w3.is_connected():
                logger.info(f"Connected to Web3 at {hardhat_url}")
                break
            logger.info(
                f"Waiting for Web3 connection... ({i+1}/{max_retries})")
            time.sleep(2)
        else:
            raise Exception("Could not connect to Web3")

        # Load deployer account
        deployer_private_key = os.getenv("DEPLOYER_PRIVATE_KEY")
        if not deployer_private_key:
            raise Exception("DEPLOYER_PRIVATE_KEY not found in environment")

        deployer_account = Account.from_key(deployer_private_key)
        logger.info(f"Loaded deployer account: {deployer_account.address}")

        # Load contract
        contract_info_path = "/app/BallotContract.json"
        max_retries = 30
        for i in range(max_retries):
            if os.path.exists(contract_info_path):
                with open(contract_info_path, 'r') as f:
                    contract_info = json.load(f)
                break
            logger.info(
                f"Waiting for contract deployment... ({i+1}/{max_retries})")
            time.sleep(2)
        else:
            raise Exception("Contract deployment file not found")

        contract_address = w3.to_checksum_address(contract_info["address"])
        contract_abi = contract_info["abi"]

        contract = w3.eth.contract(address=contract_address, abi=contract_abi)
        logger.info(f"Loaded contract at: {contract_address}")

        return True

    except Exception as e:
        logger.error(f"Failed to initialize Web3: {e}")
        return False


def create_ballot_commitment(ballot_data: str) -> str:
    """Create a cryptographic commitment for the ballot data"""
    # Create a hash of the ballot data with salt for privacy
    salt = os.urandom(32).hex()
    commitment_data = f"{ballot_data}:{salt}"
    commitment = hashlib.sha256(commitment_data.encode()).hexdigest()
    return f"0x{commitment}"


def verify_voter_signature(election_id: str, tracking_code: str, ballot_data: str, signature: str, voter_address: str) -> bool:
    """Verify that the signature came from the claimed voter address"""
    try:
        # Create the message that was signed
        message_hash = Web3.keccak(
            text=f"{election_id}{tracking_code}{ballot_data}")
        message = encode_defunct(message_hash)

        # Recover the address from the signature
        recovered_address = Account.recover_message(
            message, signature=signature)

        return recovered_address.lower() == voter_address.lower()
    except Exception as e:
        logger.error(f"Signature verification failed: {e}")
        return False


@app.on_event("startup")
async def startup_event():
    """Initialize the application"""
    logger.info("Starting Blockchain Ballot API...")

    # Initialize Web3 connection in a background task
    success = initialize_web3_connection()
    if not success:
        logger.error("Failed to initialize Web3 connection")
        raise Exception("Could not connect to blockchain")

    logger.info("Application startup complete")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        if w3 and w3.is_connected():
            latest_block = w3.eth.block_number
            return {
                "status": "healthy",
                "blockchain_connected": True,
                "latest_block": latest_block,
                "contract_address": contract.address if contract else None
            }
        else:
            return {"status": "unhealthy", "blockchain_connected": False}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@app.post("/admin/create-election", response_model=dict)
async def create_election(request: ElectionCreateRequest):
    """Create a new election (admin only)"""
    try:
        if not contract or not deployer_account:
            raise HTTPException(
                status_code=500, detail="Service not initialized")

        # Build transaction
        function = contract.functions.createElection(
            request.election_id,
            request.start_time,
            request.end_time
        )

        # Estimate gas
        gas_estimate = function.estimate_gas(
            {'from': deployer_account.address})

        # Build transaction
        transaction = function.build_transaction({
            'from': deployer_account.address,
            'gas': gas_estimate + 50000,  # Add buffer
            'gasPrice': w3.to_wei('20', 'gwei'),
            'nonce': w3.eth.get_transaction_count(deployer_account.address),
        })

        # Sign and send transaction
        signed_txn = w3.eth.account.sign_transaction(
            transaction, deployer_account.key)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)

        # Wait for transaction receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        logger.info(f"Election created: {request.election_id}")

        return {
            "success": True,
            "transaction_hash": receipt.transactionHash.hex(),
            "election_id": request.election_id
        }

    except Exception as e:
        logger.error(f"Failed to create election: {e}")
        raise HTTPException(
            status_code=400, detail=f"Failed to create election: {str(e)}")


@app.post("/admin/register-voter", response_model=dict)
async def register_voter(request: VoterRegisterRequest):
    """Register a voter for an election (admin only)"""
    try:
        if not contract or not deployer_account:
            raise HTTPException(
                status_code=500, detail="Service not initialized")

        voter_address = w3.to_checksum_address(request.voter_address)

        # Build transaction
        function = contract.functions.registerVoter(
            request.election_id, voter_address)

        # Estimate gas
        gas_estimate = function.estimate_gas(
            {'from': deployer_account.address})

        # Build transaction
        transaction = function.build_transaction({
            'from': deployer_account.address,
            'gas': gas_estimate + 50000,
            'gasPrice': w3.to_wei('20', 'gwei'),
            'nonce': w3.eth.get_transaction_count(deployer_account.address),
        })

        # Sign and send transaction
        signed_txn = w3.eth.account.sign_transaction(
            transaction, deployer_account.key)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)

        # Wait for transaction receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        logger.info(
            f"Voter registered: {voter_address} for election {request.election_id}")

        return {
            "success": True,
            "transaction_hash": receipt.transactionHash.hex(),
            "voter_address": voter_address
        }

    except Exception as e:
        logger.error(f"Failed to register voter: {e}")
        raise HTTPException(
            status_code=400, detail=f"Failed to register voter: {str(e)}")


@app.post("/record-ballot", response_model=BallotRecordResponse)
async def record_ballot(request: BallotRecordRequest):
    """Record a ballot on the blockchain"""
    try:
        if not contract:
            raise HTTPException(
                status_code=500, detail="Service not initialized")

        # Create ballot commitment
        ballot_commitment_bytes = Web3.keccak(text=request.ballot_data)

        # For demo purposes, we'll use a predefined voter account
        # In production, the frontend would handle signing with the user's private key
        voter_private_key = os.getenv(
            "VOTER1_PRIVATE_KEY")  # Use first test voter
        if not voter_private_key:
            raise HTTPException(
                status_code=400, detail="Voter authentication failed")

        voter_account = Account.from_key(voter_private_key)

        # Verify voter is registered
        is_registered = contract.functions.isVoterRegistered(
            request.election_id, voter_account.address).call()
        if not is_registered:
            raise HTTPException(
                status_code=403, detail="Voter not registered for this election")

        # Create signature for the contract call
        signature_message = Web3.keccak(
            text=f"{request.election_id}{request.tracking_code}{ballot_commitment_bytes.hex()}")
        signature_message_encoded = encode_defunct(signature_message)
        signature = voter_account.sign_message(
            signature_message_encoded).signature

        # Build transaction
        function = contract.functions.recordBallot(
            request.election_id,
            request.tracking_code,
            ballot_commitment_bytes,
            signature
        )

        # Estimate gas
        gas_estimate = function.estimate_gas({'from': voter_account.address})

        # Build transaction
        transaction = function.build_transaction({
            'from': voter_account.address,
            'gas': gas_estimate + 100000,
            'gasPrice': w3.to_wei('20', 'gwei'),
            'nonce': w3.eth.get_transaction_count(voter_account.address),
        })

        # Sign and send transaction
        signed_txn = w3.eth.account.sign_transaction(
            transaction, voter_account.key)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)

        # Wait for transaction receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        # Get the timestamp from the blockchain
        block = w3.eth.get_block(receipt.blockNumber)
        timestamp = block.timestamp

        logger.info(
            f"Ballot recorded successfully. TX: {receipt.transactionHash.hex()}")

        return BallotRecordResponse(
            success=True,
            transaction_hash=receipt.transactionHash.hex(),
            timestamp=timestamp,
            ballot_commitment=ballot_commitment_bytes.hex(),
            message="Ballot recorded successfully"
        )

    except Exception as e:
        logger.error(f"Failed to record ballot: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to record ballot: {str(e)}"
        )


@app.post("/verify-ballot", response_model=BallotVerifyResponse)
async def verify_ballot(request: BallotVerifyRequest):
    """Verify a ballot exists on the blockchain"""
    try:
        if not contract:
            raise HTTPException(
                status_code=500, detail="Service not initialized")

        # Create ballot commitment from the provided data
        ballot_commitment_bytes = Web3.keccak(text=request.ballot_data)

        logger.info(
            f"Verifying ballot with commitment: {ballot_commitment_bytes.hex()}")

        # Call the smart contract verify function
        exists, timestamp, voter_address = contract.functions.verifyBallot(
            request.election_id,
            request.tracking_code,
            ballot_commitment_bytes
        ).call()

        if exists:
            logger.info(f"Ballot verification successful")
            return BallotVerifyResponse(
                exists=True,
                timestamp=timestamp,
                voter_address=voter_address,
                message="Ballot verification successful"
            )
        else:
            logger.info(f"Ballot not found or verification failed")
            return BallotVerifyResponse(
                exists=False,
                message="Ballot not found or verification failed"
            )

    except Exception as e:
        logger.error(f"Ballot verification error: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Ballot verification failed: {str(e)}"
        )


@app.get("/election/{election_id}")
async def get_election_details(election_id: str):
    """Get election details"""
    try:
        if not contract:
            raise HTTPException(
                status_code=500, detail="Service not initialized")

        is_active, start_time, end_time = contract.functions.getElectionDetails(
            election_id).call()

        return {
            "election_id": election_id,
            "is_active": is_active,
            "start_time": start_time,
            "end_time": end_time,
            "start_date": datetime.fromtimestamp(start_time).isoformat() if start_time > 0 else None,
            "end_date": datetime.fromtimestamp(end_time).isoformat() if end_time > 0 else None
        }

    except Exception as e:
        logger.error(f"Failed to get election details: {e}")
        raise HTTPException(
            status_code=400, detail=f"Failed to get election details: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
